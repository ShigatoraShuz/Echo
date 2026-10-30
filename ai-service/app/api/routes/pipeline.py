"""Internal engineering API. Never expose its token in a browser bundle."""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import require_internal_token
from app.model.registry import TASKS
from app.safety.urgent_language import has_urgent_language

router = APIRouter(prefix="/engineering/v2", dependencies=[Depends(require_internal_token)])


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=20000)
    context: list[Turn] = Field(default_factory=list, max_length=6)


def registry(request):
    if request.app.state.pipeline_registry.settings.app_env == "production":
        raise HTTPException(503, "Engineering model activation is unavailable in production.")
    return request.app.state.pipeline_registry


@router.get("/models")
async def models(request: Request):
    return registry(request).status()


@router.post("/analyze")
async def analyze(payload: Input, request: Request):
    runtime = registry(request)
    # Existing urgent-language handling is an independent conservative guard, not
    # a clinically validated suicide classifier and never derived from distress scores.
    urgent = has_urgent_language(payload.text)
    if urgent:
        raise HTTPException(409, "SAFETY_ACTION_REQUIRED")
    stages = {}
    for task in TASKS:
        stages[task] = await runtime.stage(task, payload.text)
    diagnostic = {}
    if runtime.settings.echo_consultation_demo or runtime.settings.echo_local_research:
        diagnostic = await research_demo(runtime, payload.text)
    completed = sum(stage["status"] == "completed" for stage in stages.values())
    return {
        "schemaVersion": "echo-model-pipeline-v2",
        "thresholdVersion": "no-clinical-thresholds-v1",
        "providerName": "echo-local-model-registry",
        "modelVersion": "staged-v2",
        "isSimulated": runtime.settings.echo_execution_mode == "synthetic",
        "overallStatus": "completed"
        if completed == 4
        else "partial"
        if completed or "researchDiagnostic" in diagnostic
        else "unavailable",
        "stages": stages,
        # A separately reviewed static resource is required by existing persistence.
        # It is NOT described as generated or selected by a trained model.
        "recommendationFeatures": ["grounding"],
        "staticResourceOnly": True,
        **diagnostic,
    }


def _research_forward(runtime, text):
    from app.model.consultation_diagnostics import research_forward

    return research_forward(runtime, text)


async def research_demo(runtime, text):
    """Same single-worker executor and bounded admission as ordinary stages; no public diagnostic endpoint."""
    if runtime.closed or not runtime.slots.acquire(blocking=False):
        return {"researchDiagnosticError": "INFERENCE_QUEUE_FULL"}
    with runtime.slot_lock:
        runtime.admitted += 1
    future = runtime.executor.submit(_research_forward, runtime, text)
    future.add_done_callback(lambda _: runtime._release())
    wrapped = asyncio.wrap_future(future)
    wrapped.add_done_callback(lambda f: None if f.cancelled() else f.exception())
    try:
        output = await asyncio.wait_for(
            asyncio.shield(wrapped), timeout=runtime.settings.echo_stage_timeout_seconds
        )
        return {"researchDiagnostic": output}
    except TimeoutError:
        return {"researchDiagnosticError": "RESEARCH_DIAGNOSTIC_TIMEOUT"}
    except Exception:  # noqa: BLE001 -- contain native inference failures without leaking private diagnostics
        # Never return native errors, input text or paths. All other stages survive.
        return {"researchDiagnosticError": "RESEARCH_DIAGNOSTIC_UNAVAILABLE_SINGLE_WINDOW_ONLY"}


@router.post("/generate")
async def generate(payload: Input, request: Request):
    runtime = registry(request)
    if has_urgent_language(payload.text):
        raise HTTPException(409, "SAFETY_ACTION_REQUIRED")
    stage = await runtime.stage(
        "cbt", payload.text, [turn.model_dump() for turn in payload.context]
    )
    if stage["status"] != "completed":
        raise HTTPException(
            503, {"code": stage["errorCode"], "message": "Trained model generation is unavailable."}
        )
    return stage
