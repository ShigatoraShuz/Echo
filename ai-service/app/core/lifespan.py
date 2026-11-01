import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from urllib.parse import urlsplit

from fastapi import FastAPI

from app.core.config import get_settings
from app.model.registry import ModelRegistry
from app.model.runtime import ModelRuntime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    safe_text = (
        settings.core_models_enabled
        and getattr(settings, "core_transport", "disabled") == "text_memory"
        and settings.app_env in ("development", "test")
        and settings.host == "127.0.0.1"
        and len(settings.ai_service_token) >= 32
        and not settings.realtime_talk_enabled
        and not settings.echo_active_models
    )
    if (
        settings.core_models_enabled or settings.worker_enabled or settings.realtime_talk_enabled
    ) and not safe_text:
        raise ValueError(
            "Native core and worker activation is unavailable pending privacy-safe "
            "subprocess transport and reproducible service-specific environments."
        )
    if safe_text and settings.worker_enabled:
        target = urlsplit(settings.backend_url)
        if (
            target.scheme != "http"
            or target.hostname not in ("127.0.0.1", "localhost")
            or target.username
            or target.password
            or target.query
            or target.fragment
            or target.path.rstrip("/") != "/api/v1/internal/ai"
            or len(settings.ai_worker_token) < 32
        ):
            raise ValueError("Worker callbacks require loopback and a dedicated credential.")
    if safe_text:
        from app.model.text_transport import TextRuntime

        app.state.model_runtime = TextRuntime(settings)
    else:
        app.state.model_runtime = ModelRuntime.from_settings(settings)
    worker_task = None
    try:
        app.state.pipeline_registry = ModelRegistry(settings)
        if safe_text and settings.worker_enabled:
            from app.worker import Worker

            worker_task = asyncio.create_task(Worker(app.state.model_runtime, settings).run())
        yield
    finally:
        if worker_task:
            worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await worker_task
        if hasattr(app.state, "pipeline_registry"):
            app.state.pipeline_registry.close()
        if hasattr(app.state.model_runtime, "release"):
            app.state.model_runtime.release()
