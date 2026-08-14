from hmac import compare_digest
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def require_internal_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    settings = get_settings()
    expected = settings.ai_service_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal authentication is not configured.",
        )

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or not compare_digest(token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token.")
