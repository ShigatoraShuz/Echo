import asyncio
import threading
from types import SimpleNamespace

import httpx

from app.core.exceptions import ModelUnavailableError
from app.model.core import CoreRuntime


def test_child_cancel_releases_process_and_tempfiles(tmp_path, monkeypatch):
    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.root = tmp_path / "models"
    runtime.root.mkdir()
    (tmp_path / "runtime-cache").mkdir()
    runtime.call = lambda name, fn: fn(None)
    events = []

    class Process:
        returncode = None

        def poll(self):
            return None

        def kill(self):
            events.append("kill")

        def wait(self):
            events.append("wait")

    monkeypatch.setattr("subprocess.Popen", lambda *a, **kw: Process())
    cancelled = threading.Event()
    cancelled.set()
    import pytest

    with pytest.raises(ModelUnavailableError):
        runtime.speech({"task": "speak", "text": "synthetic"}, cancelled)
    assert events == ["kill", "wait"]
    assert list((tmp_path / "runtime-cache").iterdir()) == []


def test_speech_body_limit_and_authentication(monkeypatch):
    from app.main import app

    token = "synthetic-long-token-32-characters"
    settings = SimpleNamespace(ai_service_token=token, rate_limit_window_seconds=60)
    monkeypatch.setattr("app.core.security.get_settings", lambda: settings)
    monkeypatch.setattr("app.api.middleware.get_settings", lambda: settings)

    class Fake:
        def analyze(self, *a):
            pass

        def speech(self, payload, cancelled):
            return {"text": "synthetic"}

    monkeypatch.setattr(app.state, "model_runtime", Fake(), raising=False)

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            body = {"task": "transcribe", "audio": "A" * 100000}
            denied = await client.post("/v2/speech", json=body)
            assert denied.status_code == 401
            accepted = await client.post(
                "/v2/speech", json=body, headers={"authorization": "Bearer " + token}
            )
            assert accepted.status_code == 200
            unchanged = await client.post("/v2/analyze", json={"text": "x" * 100000})
            assert unchanged.status_code == 413

    asyncio.run(run())
