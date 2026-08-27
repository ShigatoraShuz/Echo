from hashlib import sha256
from hmac import compare_digest, new
from time import time
from typing import Annotated

from fastapi import Header, HTTPException, Request

from app.core.config import get_settings


def require_gateway_user(
    request: Request,
    x_echo_user: Annotated[str | None, Header()] = None,
    x_echo_timestamp: Annotated[str | None, Header()] = None,
    x_echo_signature: Annotated[str | None, Header()] = None,
) -> str:
    settings = get_settings()
    if not settings.analysis_service_token:
        raise HTTPException(status_code=503, detail="Gateway identity validation is not configured.")
    try:
        timestamp = int(x_echo_timestamp or "")
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid gateway identity.") from error
    if not x_echo_user or not x_echo_signature or abs(int(time() * 1000) - timestamp) > 60_000:
        raise HTTPException(status_code=401, detail="Invalid gateway identity.")
    payload = f"{request.state.request_id}\n{x_echo_user}\n{x_echo_timestamp}".encode()
    expected = new(settings.analysis_service_token.encode(), payload, sha256).hexdigest()
    if not compare_digest(x_echo_signature, expected):
        raise HTTPException(status_code=401, detail="Invalid gateway identity.")
    return x_echo_user
