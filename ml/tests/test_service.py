import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.safety import has_urgent_language
from app.severity import severity_from_phq8


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


def test_missing_runtime_reports_not_ready() -> None:
    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"ready": False, "reason": "model_runtime_unavailable"}


def test_model_metadata_is_authenticated_and_truthful(monkeypatch) -> None:
    monkeypatch.setenv("ML_SERVICE_TOKEN", "test-token")
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get("/v1/model").status_code == 401
        response = client.get(
            "/v1/model", headers={"Authorization": "Bearer test-token"}
        )

    assert response.status_code == 200
    assert response.json()["ready"] is False
    assert response.json()["blocker"]


def test_explicit_urgent_language_is_detected_independently() -> None:
    assert has_urgent_language("I want to die tonight") is True
    assert has_urgent_language("I felt disconnected today") is False


@pytest.mark.parametrize(
    ("score", "expected"),
    [(0, "minimal"), (4, "minimal"), (5, "mild"), (9, "mild"),
     (10, "moderate"), (14, "moderate"), (15, "moderately_severe"),
     (19, "moderately_severe"), (20, "severe"), (24, "severe")],
)
def test_phq8_severity_boundaries(score: int, expected: str) -> None:
    assert severity_from_phq8(score) == expected


@pytest.mark.parametrize("score", [-1, 25])
def test_phq8_severity_rejects_out_of_range_scores(score: int) -> None:
    with pytest.raises(ValueError):
        severity_from_phq8(score)


def test_validated_runtime_contract_integrates_severity_and_safety(monkeypatch) -> None:
    class ValidatedRuntime:
        ready = True
        model_version = "validated-test-runtime"

        @staticmethod
        def infer_phq8(journal_text: str, language: str) -> int:
            assert journal_text == "I want to die"
            assert language == "en"
            return 15

    monkeypatch.setenv("ML_SERVICE_TOKEN", "test-token")
    get_settings.cache_clear()
    with TestClient(app) as client:
        client.app.state.runtime = ValidatedRuntime()
        response = client.post(
            "/v1/infer",
            headers={"Authorization": "Bearer test-token"},
            json={
                "request_id": "00000000-0000-4000-8000-000000000001",
                "journal_text": "I want to die",
                "language": "en",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body.pop("processing_time_ms") >= 0
    assert body == {
        "request_id": "00000000-0000-4000-8000-000000000001",
        "phq8_score": 15,
        "severity": "moderately_severe",
        "urgent_language_detected": True,
        "model_version": "validated-test-runtime",
    }
