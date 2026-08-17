from fastapi import FastAPI

from app.api.middleware import rate_limit_middleware, request_id_middleware
from app.api.routes import analysis, health, model_info, readiness
from app.core.config import get_settings
from app.core.lifespan import lifespan

settings = get_settings()
production = settings.app_env == "production"
app = FastAPI(
    title="ECHO AI Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if production else "/docs",
    redoc_url=None,
    openapi_url=None if production else "/openapi.json",
)
app.middleware("http")(request_id_middleware)
app.middleware("http")(rate_limit_middleware)
app.include_router(health.router)
app.include_router(readiness.router)
app.include_router(model_info.router)
app.include_router(analysis.router)
