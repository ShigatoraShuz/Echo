from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.model.runtime import ModelRuntime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    # The placeholder runtime intentionally remains unavailable until a reviewed
    # loader is supplied with local model artefacts. Never fabricate an estimate.
    app.state.model_runtime = ModelRuntime.from_settings(settings)
    yield
