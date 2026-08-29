import os
from hashlib import sha256
from hmac import new
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

os.environ.setdefault("ANALYSIS_SERVICE_TOKEN", "test-analysis-token")

from fastapi.testclient import TestClient

from app.api.routes.analysis import internal_headers
from app.core.config import Settings
from app.main import app


def test_health_is_available_without_internal_credentials() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "analysis-service"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_analysis_rejects_missing_signed_gateway_identity() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/journals/123e4567-e89b-12d3-a456-426614174000/analyze",
            json={},
        )

    assert response.status_code == 401
    assert response.json()["error"] == {
        "code": "AUTHENTICATION_ERROR",
        "message": "Invalid gateway identity.",
    }


def test_internal_headers_use_only_the_target_service_token() -> None:
    request_id = "00000000-0000-4000-8000-000000000001"
    user_id = "00000000-0000-4000-8000-000000000002"
    target_token = "target-service-token"
    request = SimpleNamespace(state=SimpleNamespace(request_id=request_id))

    headers = internal_headers(request, user_id, target_token)  # type: ignore[arg-type]
    payload = f"{request_id}\n{user_id}\n{headers['x-echo-timestamp']}".encode()

    assert headers["authorization"] == f"Bearer {target_token}"
    assert headers["x-echo-signature"] == new(
        target_token.encode(), payload, sha256
    ).hexdigest()


def test_production_analysis_configuration_fails_fast_when_dependencies_are_missing() -> None:
    token = "x" * 32
    with pytest.raises(ValidationError, match="Production analysis configuration is missing"):
        Settings(
            app_env="production",
            analysis_service_token=token,
            user_service_token=token,
            journal_service_token=token,
            ml_service_token=token,
            recommendation_service_token=token,
        )


def test_oversized_requests_are_rejected_before_body_processing() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/journals/123e4567-e89b-12d3-a456-426614174000/analyze",
            content=b"x" * (64 * 1024 + 1),
            headers={
                "content-type": "application/json",
            },
        )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_REJECTED"


def test_chunked_oversized_requests_are_rejected_without_content_length() -> None:
    def chunked_body():
        for _ in range(70):
            yield b"x" * 1024

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/journals/123e4567-e89b-12d3-a456-426614174000/analyze",
            content=chunked_body(),
            headers={
                "content-type": "application/json",
            },
        )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_REJECTED"


def test_rate_limit_returns_429_after_the_per_minute_budget() -> None:
    from app.core.config import get_settings

    limit = get_settings().rate_limit_per_minute
    with TestClient(app) as client:
        responses = [client.get("/health") for _ in range(limit + 1)]

    assert responses[0].status_code == 200
    assert responses[-1].status_code == 429
    assert responses[-1].json()["error"]["code"] == "RATE_LIMITED"
    assert responses[-1].headers["retry-after"] == str(get_settings().rate_limit_window_seconds)
