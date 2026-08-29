from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.middleware import rate_limit_middleware, request_id_middleware
from app.api.routes import analysis, health
from app.core.config import get_settings

settings = get_settings()
production = settings.app_env == "production"
app = FastAPI(
    title="ECHO Analysis Service",
    version="0.2.0",
    docs_url=None if production else "/docs",
    redoc_url=None,
    openapi_url=None if production else "/openapi.json",
)
app.middleware("http")(request_id_middleware)
app.middleware("http")(rate_limit_middleware)


def error_envelope(request: Request, status_code: int, code: str, message: str, details=None):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": code, "message": message, **({"details": details} if details else {})},
            "meta": {"requestId": getattr(request.state, "request_id", "")},
        },
    )


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException):
    message = error.detail if isinstance(error.detail, str) else "The request could not be completed."
    if error.status_code == 503 and message == "Validated model currently unavailable.":
        code = "ML_INFERENCE_UNAVAILABLE"
    elif error.status_code == 401:
        code = "AUTHENTICATION_ERROR"
    elif error.status_code == 403:
        code = "AUTHORIZATION_ERROR"
    elif error.status_code == 404:
        code = "NOT_FOUND"
    else:
        code = "DEPENDENCY_ERROR" if error.status_code >= 500 else "REQUEST_REJECTED"
    return error_envelope(request, error.status_code, code, message)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    fields = [
        {"field": ".".join(str(part) for part in issue["loc"] if part != "body") or "form", "message": issue["msg"]}
        for issue in error.errors()
    ]
    return error_envelope(
        request,
        422,
        "VALIDATION_ERROR",
        "The request is invalid.",
        {"fields": fields},
    )

app.include_router(health.router)
app.include_router(analysis.router)
