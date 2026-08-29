import time
from collections import defaultdict, deque
from uuid import UUID, uuid4

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import get_settings

MAX_BODY_BYTES = 64 * 1024


def _error_response(status_code: int, detail: str, request_id: str) -> JSONResponse:
    response = JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": "REQUEST_REJECTED", "message": detail},
            "meta": {"requestId": request_id},
        },
    )
    response.headers["x-request-id"] = request_id
    response.headers["cache-control"] = "no-store"
    response.headers["x-content-type-options"] = "nosniff"
    return response


# ---------------------------------------------------------------------------
# In-memory sliding-window rate limiter.
#
# NOTE: This limiter is per-process state. It is correct for the intended
# single-instance deployment of the AI service (one container). Running
# multiple replicas behind a load balancer requires a shared store (e.g.
# Redis); the per-minute budget would otherwise apply per replica.
# ---------------------------------------------------------------------------
def create_rate_limiter(limit: int, window_seconds: int = 60):
    hits: dict[str, deque[float]] = defaultdict(deque)

    def check(client_key: str) -> bool:
        now = time.monotonic()
        window = hits[client_key]
        while window and now - window[0] > window_seconds:
            window.popleft()
        if len(window) >= limit:
            return False
        window.append(now)
        return True

    return check


_limiter = create_rate_limiter(limit=get_settings().rate_limit_per_minute)


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
            if int(content_length) > MAX_BODY_BYTES:
                return _error_response(413, "Request body is too large.", request_id)
        except ValueError:
            return _error_response(400, "Invalid Content-Length header.", request_id)

    # Consume and replay at most MAX_BODY_BYTES before authentication. Merely
    # wrapping receive is insufficient because dependencies can reject a
    # request without consuming its chunked body, bypassing the size check.
    original_receive = request._receive
    received_bytes = 0
    messages = []
    more_body = True
    while more_body:
        message = await original_receive()
        if message["type"] == "http.disconnect":
            break
        received_bytes += len(message.get("body", b""))
        if received_bytes > MAX_BODY_BYTES:
            return _error_response(413, "Request body is too large.", request_id)
        messages.append(message)
        more_body = bool(message.get("more_body", False))

    async def replay_receive():
        if messages:
            return messages.pop(0)
        return {"type": "http.request", "body": b"", "more_body": False}

    request._receive = replay_receive
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    response.headers["cache-control"] = "no-store"
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "no-referrer"
    return response


async def rate_limit_middleware(request: Request, call_next):
    settings = get_settings()
    client_key = request.client.host if request.client else "unknown"
    if not _limiter(client_key):
        # Middleware layers receive separate Request instances, so the request
        # id set by the outer request-id middleware is not visible here.
        request_id = getattr(request.state, "request_id", None) or str(uuid4())
        response = JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": {"code": "RATE_LIMITED", "message": "Too many requests."},
                "meta": {"requestId": request_id},
            },
        )
        response.headers["x-request-id"] = request_id
        response.headers["retry-after"] = str(settings.rate_limit_window_seconds)
        response.headers["cache-control"] = "no-store"
        response.headers["x-content-type-options"] = "nosniff"
        return response
    return await call_next(request)
