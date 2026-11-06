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
        and (not settings.realtime_talk_enabled or getattr(settings, "echo_buddy_enabled", False))
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
    preload_task = None
    preload_cancelled = None
    try:
        app.state.pipeline_registry = ModelRegistry(settings)
        if safe_text and settings.worker_enabled:
            from app.worker import Worker

            worker_task = asyncio.create_task(Worker(app.state.model_runtime, settings).run())
        if safe_text and settings.echo_buddy_enabled:
            import threading
            preload_cancelled = threading.Event()
            async def prepare_base():
                app.state.buddy_startup = {'state':'loading'}
                try:
                    await asyncio.to_thread(app.state.model_runtime.preload, preload_cancelled)
                    app.state.buddy_startup = {'state':'ready'}
                except Exception as error:
                    code=str(error)
                    safe=code if code.startswith(('BUDDY_','NATIVE_')) and code.replace('_','').isalnum() and len(code)<80 else 'BUDDY_STARTUP_PRELOAD_FAILED'
                    app.state.buddy_startup = {'state':'failed','code':safe}
            preload_task = asyncio.create_task(prepare_base())
        yield
    finally:
        if preload_cancelled:preload_cancelled.set()
        if preload_task:
            try:await asyncio.wait_for(asyncio.shield(preload_task),timeout=10)
            except (asyncio.TimeoutError,asyncio.CancelledError):preload_task.cancel()
        if worker_task:
            worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await worker_task
        if hasattr(app.state, "pipeline_registry"):
            app.state.pipeline_registry.close()
        if hasattr(app.state.model_runtime, "release"):
            app.state.model_runtime.release()
