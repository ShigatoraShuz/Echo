from uuid import UUID, uuid4

from fastapi import Request
from fastapi.responses import JSONResponse


async def request_id_middleware(request: Request, call_next):
    incoming = request.headers.get("x-request-id")
    try:
        request_id = str(UUID(incoming)) if incoming else str(uuid4())
    except (TypeError, ValueError):
        request_id = str(uuid4())

    request.state.request_id = request_id
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 64 * 1024:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )
                response.headers["x-request-id"] = request_id
                response.headers["cache-control"] = "no-store"
                response.headers["x-content-type-options"] = "nosniff"
                return response
        except ValueError:
            response = JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length header."},
            )
            response.headers["x-request-id"] = request_id
            response.headers["cache-control"] = "no-store"
            response.headers["x-content-type-options"] = "nosniff"
            return response

    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    response.headers["cache-control"] = "no-store"
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "no-referrer"
    return response
