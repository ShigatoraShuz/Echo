import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.routes import pipeline
from app.core.config import Settings, get_settings
from app.model.registry import ModelRegistry


@pytest.mark.parametrize(
    "env,mode", [("production", "real"), ("development", "real"), ("test", "synthetic")]
)
def test_consultation_rejects_nonisolated_modes(env, mode):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env=env, echo_execution_mode=mode, echo_consultation_demo=True)


def client(tmp_path, monkeypatch, enabled):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "isolated-consultation-token")
    get_settings.cache_clear()
    settings = Settings(
        _env_file=None,
        app_env="test",
        echo_execution_mode="real",
        echo_models_dir=tmp_path,
        echo_consultation_demo=enabled,
    )
    app = FastAPI()
    app.state.pipeline_registry = ModelRegistry(settings)
    app.include_router(pipeline.router)
    return TestClient(app), app.state.pipeline_registry


def output():
    return {
        "executionState": "REAL_PROVISIONAL_MODEL",
        "modelId": "echo-xlmr-v2-distress-raw",
        "modelVersion": "provisional-20261030-format-v1",
        "labels": ["Others", "Anxious", "Depressed", "Frustrated", "Suicidal"],
        "rawLogits": [1.0, 2.0, 3.0, 4.0, 5.0],
        "inputTokens": 12,
        "windows": 1,
        "calibrationApplied": False,
        "preprocessingVerified": False,
        "classificationSemanticsVerified": False,
        "trainingReferenceParityVerified": False,
        "clinicalUseAllowed": False,
        "repeatConsistent": True,
        "validationAndLoadMs": 1,
        "forwardMs": [1, 1],
    }


def test_actual_diagnostic_metadata_remains_separate_from_clinical_stages(tmp_path, monkeypatch):
    # Explicitly synthetic test double; real checkpoint evidence is collected by browser E2E separately.
    monkeypatch.setattr(pipeline, "_research_forward", lambda runtime, text: output())
    api, runtime = client(tmp_path, monkeypatch, True)
    try:
        assert api.post("/engineering/v2/analyze", json={"text": "Fictional"}).status_code == 401
        response = api.post(
            "/engineering/v2/analyze",
            headers={"Authorization": "Bearer isolated-consultation-token"},
            json={"text": "Fictional"},
        )
        result = response.json()
        assert response.status_code == 200
        assert result["overallStatus"] == "partial"
        assert result["researchDiagnostic"]["clinicalUseAllowed"] is False
        assert all(
            stage["result"] is None and stage["executionState"] == "UNAVAILABLE"
            for stage in result["stages"].values()
        )
        assert "probabilities" not in result["researchDiagnostic"]
        assert (
            api.post(
                "/v2/diagnose", headers={"Authorization": "Bearer isolated-consultation-token"}
            ).status_code
            == 404
        )
    finally:
        runtime.close()
        get_settings.cache_clear()


def test_disabled_demo_never_calls_diagnostic_and_failure_preserves_other_stages(
    tmp_path, monkeypatch
):
    calls = []

    def failure(runtime, text):
        calls.append(True)
        raise RuntimeError("private native path or input must not escape")

    monkeypatch.setattr(pipeline, "_research_forward", failure)
    for enabled in [False, True]:
        api, runtime = client(tmp_path, monkeypatch, enabled)
        try:
            result = api.post(
                "/engineering/v2/analyze",
                headers={"Authorization": "Bearer isolated-consultation-token"},
                json={"text": "Fictional"},
            ).json()
            assert "researchDiagnostic" not in result
            assert result["overallStatus"] == "unavailable"
            assert "private native" not in json.dumps(result)
            assert bool(result.get("researchDiagnosticError")) == enabled
        finally:
            runtime.close()
    assert len(calls) == 1
    get_settings.cache_clear()
