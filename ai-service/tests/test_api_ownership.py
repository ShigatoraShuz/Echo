"""Contract-only endpoint ownership checks; no app startup or inference."""
import pytest
from pydantic import ValidationError

from app.api.routes import core, pipeline


def test_internal_analysis_routers_have_distinct_owners():
    native = {(method, route.path) for route in core.router.routes for method in route.methods}
    engineering = {(method, route.path) for route in pipeline.router.routes for method in route.methods}
    assert not native.intersection(engineering)
    assert ("POST", "/v2/analyze") in native
    assert ("POST", "/engineering/v2/analyze") in engineering


def test_analysis_input_contracts_are_explicit():
    payload = {"text": "Fictional afternoon", "language": "unknown"}
    assert core.TextInput.model_validate(payload).language == "unknown"
    with pytest.raises(ValidationError):
        pipeline.Input.model_validate(payload)


# In-process contract fixtures only: no lifespan, model loading, sockets or persistence.
def test_routers_require_auth_and_never_redirect_or_cross_dispatch(monkeypatch):
    from types import SimpleNamespace

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    token = "synthetic-route-contract-token-32-characters"
    monkeypatch.setattr("app.core.security.get_settings", lambda: SimpleNamespace(ai_service_token=token))
    calls = []

    class Native:
        def analyze(self, text, language):
            calls.append(("native", text, language))
            return {"schemaVersion": "echo-journal-analysis-v3"}

    class Engineering:
        settings = SimpleNamespace(app_env="test", echo_execution_mode="real", echo_consultation_demo=False, echo_local_research=False)

        async def stage(self, task, text):
            calls.append(("engineering", task, text))
            return {"status": "unavailable", "result": None}

    app = FastAPI()
    app.include_router(pipeline.router)
    app.include_router(core.router)
    app.state.model_runtime = Native()
    app.state.pipeline_registry = Engineering()
    with TestClient(app) as client:
        for path in ("/v2/analyze", "/engineering/v2/analyze"):
            assert client.post(path, json={"text": "Fictional"}).status_code == 401
        assert calls == []
        headers = {"Authorization": f"Bearer {token}"}
        native = client.post("/v2/analyze", json={"text": "Fictional", "language": "en"}, headers=headers)
        assert native.status_code == 200
        assert native.json()["schemaVersion"] == "echo-journal-analysis-v3"
        assert calls == [("native", "Fictional", "en")]
        calls.clear()
        engineering = client.post("/engineering/v2/analyze", json={"text": "Fictional"}, headers=headers)
        assert engineering.status_code == 200
        assert engineering.json()["schemaVersion"] == "echo-model-pipeline-v2"
        assert engineering.json()["overallStatus"] == "unavailable"
        assert calls and all(call[0] == "engineering" for call in calls)
        calls.clear()
        invalid = client.post("/engineering/v2/analyze", json={"text": "Fictional", "language": "en"}, headers=headers)
        assert invalid.status_code == 422 and calls == []
        app.state.model_runtime = object()
        unavailable = client.post("/v2/analyze", json={"text": "Fictional"}, headers=headers)
        assert unavailable.status_code == 503 and calls == []
        assert "location" not in unavailable.headers
