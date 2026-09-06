from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import new
from time import time
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.core.safety import support_signal
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
    if response.status_code == 403:
        body = response.json()
        if body.get("error", {}).get("code") == "FEATURE_REQUIREMENTS_NOT_MET":
            raise HTTPException(status_code=403, detail=body["error"])
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
        inference: InferenceResult | None = None
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
            if inference.urgent_language_detected:
                # Urgent support is returned even when recommendation delivery fails.
                recommendation = {"title": "Your immediate safety matters", "clinicalDisclaimer": "ECHO noticed a signal that may need immediate support. This is not a diagnosis.", "steps": ["Open crisis support and contact someone you trust."]}
            else:
                recommendation = None
            if recommendation is None:
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
            safety = await evaluate_support(client, user_id, str(journal_id), row, inference.urgent_language_detected)
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
                    "safety": safety,
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
                            "urgent_language_detected": bool(inference and inference.urgent_language_detected),
                            "completed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                except httpx.HTTPError:
                    pass
            if inference and inference.urgent_language_detected and pending_id:
                return await urgent_unsaved(client, user_id, str(journal_id), pending_id, request_id, now)
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
                            "urgent_language_detected": bool(inference and inference.urgent_language_detected),
                            "completed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                except httpx.HTTPError:
                    pass
            if inference and inference.urgent_language_detected and pending_id:
                return await urgent_unsaved(client, user_id, str(journal_id), pending_id, request_id, now)
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
            "safety": await saved_safety(user_id, str(journal_id), row),
        },
        "meta": {"requestId": request.state.request_id},
    }


async def evaluate_support(client: httpx.AsyncClient, user_id: str, journal_id: str,
                           row: dict[str, Any], urgent: bool) -> dict[str, Any]:
    settings = get_settings()
    signal = "immediate" if urgent else "none"
    try:
        if not urgent and row.get("severity") == "severe":
            cutoff = (datetime.now(UTC) - timedelta(days=settings.alarming_analysis_window_days)).isoformat()
            rows = await checked_json(await client.get(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/journal_analyses",
                headers=db_headers(), params={"user_id": f"eq.{user_id}", "status": "eq.completed",
                "completed_at": f"gte.{cutoff}", "order": "completed_at.desc", "limit": "1000"}), "database")
            signal = support_signal(rows, urgent=False, threshold=settings.alarming_analysis_streak_threshold,
                                    window_days=settings.alarming_analysis_window_days)
        if signal == "none":
            return {"kind": "none"}
        if signal == "professional_support":
            cutoff = (datetime.now(UTC) - timedelta(days=settings.support_modal_cooldown_days)).isoformat()
            previous = await checked_json(await client.get(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/safety_events", headers=db_headers(),
                params={"user_id": f"eq.{user_id}", "detection_source": "eq.analysis_streak",
                        "created_at": f"gte.{cutoff}", "limit": "1"}), "database")
            if previous:
                return {"kind": "none"}
        event = await checked_json(await client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/safety_events", headers=db_headers("return=representation"),
            json={"user_id": user_id, "journal_id": journal_id, "analysis_id": row["id"],
                  "safety_level": "high" if urgent else "medium",
                  "detection_source": "analysis_urgent" if urgent else "analysis_streak",
                  "matched_rule_id": "urgent_language" if urgent else "alarming_analysis_streak"}), "database")
        return {"kind": signal, "eventId": event[0]["id"]}
    except (HTTPException, httpx.HTTPError, KeyError, TypeError, ValueError, IndexError):
        # Persisted urgent_language_detected still restores the crisis flow on reload.
        return {"kind": "immediate", "eventId": row["id"]} if urgent else {"kind": "none"}


async def saved_safety(user_id: str, journal_id: str, row: dict[str, Any]) -> dict[str, Any]:
    if row.get("status") != "completed" and not row.get("urgent_language_detected"):
        return {"kind": "none"}
    settings = get_settings()
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        try:
            events = await checked_json(await client.get(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/safety_events", headers=db_headers(),
                params={"user_id": f"eq.{user_id}", "analysis_id": f"eq.{row['id']}", "limit": "1"}), "database")
            if events and events[0].get("acknowledged_at"):
                return {"kind": "none"}
            if events:
                return {"kind": "immediate" if events[0]["safety_level"] == "high" else "professional_support", "eventId": events[0]["id"]}
        except (HTTPException, httpx.HTTPError, KeyError, TypeError):
            pass
    return {"kind": "immediate", "eventId": row["id"]} if row.get("urgent_language_detected") else {"kind": "none"}


@router.post("/api/v1/analysis/support/{event_id}/acknowledge")
async def acknowledge_support(event_id: UUID, request: Request,
                              user_id: Annotated[str, Depends(require_gateway_user)]) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        await checked_json(await client.patch(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/safety_events?id=eq.{event_id}&user_id=eq.{user_id}",
            headers=db_headers(), json={"acknowledged_at": datetime.now(UTC).isoformat(),
                                        "support_resources_shown": True}), "database")
    return {"success": True, "data": {"acknowledged": True}, "meta": {"requestId": request.state.request_id}}


async def urgent_unsaved(client: httpx.AsyncClient, user_id: str, journal_id: str,
                         analysis_id: str, request_id: str, created_at: str) -> dict[str, Any]:
    """Never hide an observed urgent signal because storing the result failed."""
    safety = await evaluate_support(client, user_id, journal_id, {"id": analysis_id}, True)
    return {"success": True, "data": {
        "id": analysis_id, "entry_id": journal_id, "status": "failed",
        "failure_code": "RESULT_PERSISTENCE_UNAVAILABLE",
        "summary": "Your analysis result could not be saved.",
        "perspective": "ECHO noticed something in your reflection that may need immediate support. This is not a diagnosis.",
        "mood_insight": "Open crisis support and reach someone you trust.",
        "risk_indication": None, "phq8_score": None, "severity": None,
        "urgent_language_detected": True, "is_demo_data": False,
        "created_at": created_at, "provider": "ml-service", "safety": safety,
    }, "meta": {"requestId": request_id}}
