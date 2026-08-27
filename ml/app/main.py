from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from hmac import compare_digest
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from .config import get_settings
from .runtime import ModelRuntime


class InferenceRequest(BaseModel):
    request_id: UUID
    journal_text: str = Field(min_length=1, max_length=20_000)
    language: str = Field(default="en", min_length=2, max_length=16)


class InferenceResponse(BaseModel):
    request_id: UUID
    phq8_score: int = Field(ge=0, le=24)
    severity: Literal["minimal", "mild", "moderate", "moderately_severe", "severe"]
    urgent_language_detected: bool
    model_version: str
    processing_time_ms: int = Field(ge=0)


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().ml_service_token
    scheme, _, token = (authorization or "").partition(" ")
    if not expected:
        raise HTTPException(status_code=503, detail="Internal authentication is not configured.")
    if scheme.lower() != "bearer" or not token or not compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid internal token.")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.runtime = ModelRuntime.load(get_settings())
    yield


app = FastAPI(title="ECHO ML Inference Service", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def request_id(request: Request, call_next):
    value = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = value
    response: Response = await call_next(request)
    response.headers["x-request-id"] = value
    response.headers["cache-control"] = "no-store"
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ml-service"}


@app.get("/health/ready")
def readiness(request: Request) -> Response:
    runtime: ModelRuntime = request.app.state.runtime
    code = 200 if runtime.ready else 503
    return Response(
        status_code=code,
        media_type="application/json",
        content=(
            '{"ready":true}'
            if runtime.ready
            else '{"ready":false,"reason":"model_runtime_unavailable"}'
        ),
    )


@app.get("/v1/model", dependencies=[Depends(require_token)])
def model(request: Request) -> dict[str, str | bool]:
    runtime: ModelRuntime = request.app.state.runtime
    return {
        "modelName": runtime.model_name,
        "modelVersion": runtime.model_version,
        "device": runtime.device,
        "ready": runtime.ready,
        "blocker": runtime.blocker,
    }


@app.post("/v1/infer", response_model=InferenceResponse, dependencies=[Depends(require_token)])
def infer(payload: InferenceRequest, request: Request) -> InferenceResponse:
    del payload
    runtime: ModelRuntime = request.app.state.runtime
    if not runtime.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Validated model inference is unavailable.",
        )
    raise HTTPException(status_code=503, detail="Validated model inference is unavailable.")
