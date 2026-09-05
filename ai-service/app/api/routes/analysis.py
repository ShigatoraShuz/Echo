from datetime import UTC, datetime
from hashlib import sha256
from hmac import new
from time import time
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.core.security import require_gateway_user

router = APIRouter()


class InferenceResult(BaseModel):
    request_id: UUID
    phq8_score: int = Field(ge=0, le=24)
    severity: Literal["minimal", "mild", "moderate", "moderately_severe", "severe"]
    urgent_language_detected: bool
    model_version: str
    processing_time_ms: int = Field(ge=0)


def internal_headers(request: Request, user_id: str, token: str) -> dict[str, str]:
    if not token:
        raise HTTPException(status_code=503, detail="Target service authentication is not configured.")
    timestamp = str(int(time() * 1000))
    request_id = request.state.request_id
    payload = f"{request_id}\n{user_id}\n{timestamp}".encode()
    return {
        "x-request-id": request_id,
        "x-echo-user": user_id,
        "x-echo-timestamp": timestamp,
        "x-echo-signature": new(token.encode(), payload, sha256).hexdigest(),
        "authorization": f"Bearer {token}",
    }


def db_headers(prefer: str | None = None) -> dict[str, str]:
    settings = get_settings()
    result = {
        "apikey": settings.supabase_database_key,
        "authorization": f"Bearer {settings.supabase_database_key}",
        "content-type": "application/json",
    }
    if prefer:
        result["prefer"] = prefer
    return result


async def checked_json(response: httpx.Response, service: str) -> Any:
    if response.status_code >= 400:
        if service == "ml-service" and response.status_code == 503:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Validated model currently unavailable.",
            )
        code = (
            status.HTTP_504_GATEWAY_TIMEOUT if response.status_code == 504 else response.status_code
        )
        raise HTTPException(
            status_code=code, detail=f"{service} rejected or could not complete the request."
        )
    try:
        return response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=502, detail=f"{service} returned an invalid response."
        ) from error


async def verify_access(
    client: httpx.AsyncClient, request: Request, user_id: str, *, require_consent: bool
) -> None:
    settings = get_settings()
    path = "analysis-access" if require_consent else "verification"
    response = await client.get(
        f"{settings.user_service_url.rstrip('/')}/api/v1/internal/{path}",
        headers=internal_headers(request, user_id, settings.user_service_token),
    )
    await checked_json(response, "user-service")


@router.post("/api/v1/journals/{journal_id}/analyze", status_code=201)
async def analyze(
    journal_id: UUID, request: Request, user_id: Annotated[str, Depends(require_gateway_user)]
) -> dict[str, Any]:
    settings = get_settings()
    request_id = request.state.request_id or str(uuid4())
    now = datetime.now(UTC).isoformat()
    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.request_timeout_seconds)) as client:
        pending_id: str | None = None
        try:
            await verify_access(client, request, user_id, require_consent=True)
            journal_response = await client.get(
                f"{settings.journal_service_url.rstrip('/')}/api/v1/internal/journals/{journal_id}/analysis-input",
                headers=internal_headers(request, user_id, settings.journal_service_token),
            )
            journal = (await checked_json(journal_response, "journal-service"))["data"]
            if not journal.get("analysisConsent"):
                raise HTTPException(
                    status_code=403, detail="Journal analysis requires explicit consent."
                )
            pending_response = await client.post(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses",
                headers=db_headers("return=representation"),
                json={
                    "journal_id": str(journal_id),
                    "user_id": user_id,
                    "request_id": request_id,
                    "status": "processing",
                    "started_at": now,
                },
            )
            pending = await checked_json(pending_response, "database")
            if not isinstance(pending, list) or not pending:
                raise HTTPException(
                    status_code=503, detail="Analysis request could not be persisted."
                )
            pending_id = pending[0]["id"]
            ml_response = await client.post(
                f"{settings.ml_service_url.rstrip('/')}/v1/infer",
                headers={
                    "authorization": f"Bearer {settings.ml_service_token}",
                    "x-request-id": request_id,
                },
                json={
                    "request_id": request_id,
                    "journal_text": journal["journalText"],
                    "language": "en",
                },
            )
            inference = InferenceResult.model_validate(
                await checked_json(ml_response, "ml-service")
            )
            recommendation_response = await client.post(
                f"{settings.recommendation_service_url.rstrip('/')}/api/v1/internal/recommendations",
                headers={
                    "authorization": f"Bearer {settings.recommendation_service_token}",
                    "x-request-id": request_id,
                },
                json={
                    "severity": inference.severity,
                    "urgentLanguageDetected": inference.urgent_language_detected,
                },
            )
            recommendation = (
                await checked_json(recommendation_response, "recommendation-service")
            )["data"]
            # Validate the fields used below before committing a completed result.
            if not isinstance(recommendation.get("title"), str) or not isinstance(
                recommendation.get("clinicalDisclaimer"), str
            ) or not recommendation.get("steps"):
                raise HTTPException(status_code=502, detail="Invalid recommendation response.")
            completed_response = await client.patch(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses?id=eq.{pending_id}",
                headers=db_headers("return=representation"),
                json={
                    "status": "completed",
                    "phq8_score": inference.phq8_score,
                    "severity": inference.severity,
                    "urgent_language_detected": inference.urgent_language_detected,
                    "processing_time_ms": inference.processing_time_ms,
                    "analyzed_at": datetime.now(UTC).isoformat(),
                    "completed_at": datetime.now(UTC).isoformat(),
                },
            )
            completed = await checked_json(completed_response, "database")
            row = completed[0]
            return {
                "success": True,
                "data": {
                    "id": row["id"],
                    "entry_id": str(journal_id),
                    "summary": recommendation["title"],
                    "perspective": recommendation["clinicalDisclaimer"],
                    "mood_insight": recommendation["steps"][0],
                    "risk_indication": inference.severity,
                    "is_demo_data": False,
                    "created_at": row["created_at"],
                    "status": "completed",
                    "phq8_score": inference.phq8_score,
                    "severity": inference.severity,
                    "urgent_language_detected": inference.urgent_language_detected,
                    "provider": "ml-service",
                    "recommendation": recommendation,
                },
                "meta": {"requestId": request_id},
            }
        except HTTPException:
            if pending_id:
                try:
                    await client.patch(
                        f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses?id=eq.{pending_id}",
                        headers=db_headers(),
                        json={
                            "status": "failed",
                            "failure_code": "DEPENDENCY_REJECTED",
                            "completed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                except httpx.HTTPError:
                    pass
            raise
        except (httpx.TimeoutException, httpx.RequestError, ValidationError, KeyError, TypeError, IndexError) as error:
            if pending_id:
                try:
                    await client.patch(
                        f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses?id=eq.{pending_id}",
                        headers=db_headers(),
                        json={
                            "status": "failed",
                            "failure_code": "DEPENDENCY_UNAVAILABLE" if isinstance(error, httpx.HTTPError) else "INVALID_DEPENDENCY_RESPONSE",
                            "completed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                except httpx.HTTPError:
                    pass
            code = 504 if isinstance(error, httpx.TimeoutException) else 503 if isinstance(error, httpx.HTTPError) else 502
            raise HTTPException(
                status_code=code, detail="A dependent service is unavailable."
            ) from error


@router.get("/api/v1/journals/{journal_id}/analyses")
async def latest_analysis(
    journal_id: UUID, request: Request, user_id: Annotated[str, Depends(require_gateway_user)]
) -> dict[str, Any]:
    settings = get_settings()
    query = f"journal_id=eq.{journal_id}&user_id=eq.{user_id}&order=created_at.desc&limit=1"
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        try:
            await verify_access(client, request, user_id, require_consent=False)
            rows = await checked_json(
                await client.get(
                    f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses?{query}",
                    headers=db_headers(),
                ),
                "database",
            )
        except httpx.TimeoutException as error:
            raise HTTPException(status_code=504, detail="The database timed out.") from error
        except httpx.RequestError as error:
            raise HTTPException(status_code=503, detail="The database is unavailable.") from error
    if not rows:
        return {"success": True, "data": None, "meta": {"requestId": request.state.request_id}}
    row = rows[0]
    return {
        "success": True,
        "data": {
            "id": row["id"],
            "entry_id": str(journal_id),
            "summary": "Analysis completed." if row["status"] == "completed" else "Analysis has not completed.",
            "perspective": "Review this screening result with a qualified professional if you are concerned." if row["status"] == "completed" else "No screening result is available. Your journal remains saved.",
            "mood_insight": "Use the recommendation endpoint for structured next steps." if row["status"] == "completed" else "",
            "risk_indication": row.get("severity"),
            "is_demo_data": False,
            "created_at": row["created_at"],
            "status": row["status"],
            "failure_code": row.get("failure_code"),
            "phq8_score": row.get("phq8_score"),
            "severity": row.get("severity"),
            "urgent_language_detected": row.get("urgent_language_detected", False),
            "provider": "ml-service",
        },
        "meta": {"requestId": request.state.request_id},
    }
