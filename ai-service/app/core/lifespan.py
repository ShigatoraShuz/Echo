from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import asyncio
import contextlib

from fastapi import FastAPI

from app.core.config import get_settings
from app.model.runtime import ModelRuntime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    # The placeholder runtime intentionally remains unavailable until a reviewed
    # loader is supplied with local model artefacts. Never fabricate an estimate.
    if settings.core_models_enabled:
        if len(settings.ai_service_token) < 32:
            raise ValueError("Core HTTP service requires a dedicated 32-character bearer token.")
        from app.model.core import CoreRuntime

        app.state.model_runtime = CoreRuntime(settings)
    else:
        app.state.model_runtime = ModelRuntime.from_settings(settings)
    worker_task = None
    if settings.worker_enabled:
        if not settings.core_models_enabled or len(settings.ai_worker_token) < 32:
            raise ValueError("Worker requires core models and a dedicated worker token.")
        from app.worker import Worker

        worker_task = asyncio.create_task(Worker(app.state.model_runtime, settings).run())
    yield
    if worker_task:
        worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker_task
    if hasattr(app.state.model_runtime,"talk"):app.state.model_runtime.talk.close()
    if hasattr(app.state.model_runtime, "release"):
        app.state.model_runtime.release()
