from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.safety import has_urgent_language


def test_health_is_independent() -> None:
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok", "service": "ml-service"}


def test_missing_runtime_never_fabricates_inference(monkeypatch) -> None:
    monkeypatch.setenv("ML_SERVICE_TOKEN", "test-token")
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.post(
            "/v1/infer",
            headers={"Authorization": "Bearer test-token"},
            json={
                "request_id": "00000000-0000-4000-8000-000000000001",
                "journal_text": "text",
                "language": "en",
            },
        )
        assert response.status_code == 503


def test_explicit_urgent_language_is_detected_independently() -> None:
    assert has_urgent_language("I want to die tonight") is True
    assert has_urgent_language("I felt disconnected today") is False
