from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.model.registry import ModelRegistry
from app.model.runtime import ModelRuntime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    # The placeholder runtime intentionally remains unavailable until a reviewed
    # loader is supplied with local model artefacts. Never fabricate an estimate.
    # Native speech writes plaintext subprocess payloads; native core also has
    # incompatible, non-portable dependency locks. Do not import/load models or
    # start an outbound worker until that runtime has a reviewed privacy profile.
    if settings.core_models_enabled or settings.worker_enabled:
        raise ValueError(
            "Native core and worker activation is unavailable pending privacy-safe "
            "subprocess transport and reproducible service-specific environments."
        )
    app.state.model_runtime = ModelRuntime.from_settings(settings)
    app.state.pipeline_registry = ModelRegistry(settings)
    yield
    app.state.pipeline_registry.close()
    if hasattr(app.state.model_runtime, "release"):
        app.state.model_runtime.release()
