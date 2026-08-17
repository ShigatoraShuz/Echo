import os

os.environ.setdefault("AI_SERVICE_TOKEN", "test-internal-token")

from fastapi.testclient import TestClient

from app.main import app


def test_health_is_available_without_internal_credentials() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_readiness_is_false_without_a_validated_runtime() -> None:
    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["model_loaded"] is False


def test_readiness_does_not_leak_runtime_device_details() -> None:
    with TestClient(app) as client:
        response = client.get("/ready")

    assert "device" not in response.json()


def test_analysis_rejects_missing_internal_credentials() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/v1/analyze",
            json={
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "journal_text": "A private reflection.",
                "language": "en",
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid internal token."}


def test_oversized_requests_are_rejected_before_body_processing() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/v1/analyze",
            content=b"x" * (64 * 1024 + 1),
            headers={
                "authorization": "Bearer test-internal-token",
                "content-type": "application/json",
            },
        )

    assert response.status_code == 413


def test_chunked_oversized_requests_are_rejected_without_content_length() -> None:
    def chunked_body():
        for _ in range(70):
            yield b"x" * 1024

    with TestClient(app) as client:
        response = client.post(
            "/v1/analyze",
            content=chunked_body(),
            headers={
                "authorization": "Bearer test-internal-token",
                "content-type": "application/json",
            },
        )

    assert response.status_code == 413


def test_rate_limit_returns_429_after_the_per_minute_budget() -> None:
    from app.core.config import get_settings

    limit = get_settings().rate_limit_per_minute
    with TestClient(app) as client:
        responses = [
            client.get("/health")
            for _ in range(limit + 1)
        ]

    assert responses[0].status_code == 200
    assert responses[-1].status_code == 429
    assert responses[-1].headers["retry-after"] == str(get_settings().rate_limit_window_seconds)
