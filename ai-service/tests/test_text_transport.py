"""Real tiny child processes; no model loads, network, payload files or DB."""

import asyncio
import json
import subprocess
import sys
from types import SimpleNamespace

import pytest

from app.core.exceptions import ModelUnavailableError
from app.model.text_transport import TextRuntime


@pytest.fixture
def child(monkeypatch, tmp_path):
    real = subprocess.Popen
    processes = []

    def make(mode="echo"):
        def spawn(args, **kwargs):
            assert "private-journal-sentinel" not in json.dumps(args)
            assert "SUPABASE_SERVICE_ROLE_KEY" not in kwargs["env"]
            assert "AI_SERVICE_TOKEN" not in kwargs["env"]
            assert kwargs["stderr"] == subprocess.DEVNULL
            code = """import sys,json,time
print(json.dumps({'ready':True}),flush=True)
for line in sys.stdin:
 packet=json.loads(line)
 MODE
""".replace(
                " MODE",
                {
                    "echo": " print(json.dumps({'id':packet['id'],'ok':True,'result':packet['args']}),flush=True)",
                    "hang": " time.sleep(60)",
                    "delay": " time.sleep(.1); print(json.dumps({'id':packet['id'],'ok':True,'result':packet['args']}),flush=True)",
                    "notreading": " pass",
                    "mismatch": " print(json.dumps({'id':'wrong','ok':True,'result':None}),flush=True)",
                    "overflow": " print('x'*1048577,flush=True)",
                    "crash": " sys.exit(1)",
                }[mode],
            )
            if mode == "notreading":
                code = code.replace(
                    "for line in sys.stdin:", "time.sleep(60)\nfor line in sys.stdin:"
                )
            process = real([sys.executable, "-I", "-B", "-u", "-c", code], **kwargs)
            processes.append(process)
            return process

        monkeypatch.setattr("app.model.text_transport.subprocess.Popen", spawn)
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "not-for-child")
        monkeypatch.setenv("AI_SERVICE_TOKEN", "not-for-child")
        return TextRuntime(
            SimpleNamespace(models_root=str(tmp_path), core_request_timeout_seconds=1)
        )

    yield make
    for process in processes:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)
    assert list(tmp_path.iterdir()) == []


def test_round_trip_is_serialized_memory_only_and_does_not_retain_previous_input(child):
    runtime = child()
    assert runtime.classify("private-journal-sentinel", "en") == ["private-journal-sentinel", "en"]
    assert runtime.classify("different fictional account", "en") == [
        "different fictional account",
        "en",
    ]
    assert runtime.responses.empty()
    runtime.lock.acquire()
    with pytest.raises(ModelUnavailableError, match="busy"):
        runtime.classify("other")
    runtime.lock.release()
    with pytest.raises(ValueError, match="large"):
        runtime.classify("x" * 65536)
    with pytest.raises(ModelUnavailableError):
        runtime.face("unused")
    with pytest.raises(ModelUnavailableError):
        runtime.speech({})
    runtime.release()
    assert not runtime.loaded and runtime.process.poll() is not None


@pytest.mark.parametrize("mode", ["hang", "mismatch", "overflow", "crash"])
def test_protocol_failure_or_timeout_reaps_child_and_fails_closed(child, mode):
    runtime = child(mode)
    with pytest.raises(ModelUnavailableError):
        runtime.classify("Fictional")
    assert not runtime.loaded and runtime.process.poll() is not None


def test_only_approved_loopback_text_lifecycle_starts_and_cleans_up(monkeypatch):
    from importlib import import_module

    from app.core.config import Settings

    lifecycle = import_module("app.core.lifespan")
    runtime = SimpleNamespace(release=lambda: calls.append("release"))
    calls = []
    monkeypatch.setattr(
        lifecycle,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            app_env="test",
            core_models_enabled=True,
            core_transport="text_memory",
            host="127.0.0.1",
            ai_service_token="x" * 32,
            worker_enabled=False,
            realtime_talk_enabled=False,
            echo_active_models={},
        ),
    )
    monkeypatch.setattr("app.model.text_transport.TextRuntime", lambda settings: runtime)
    monkeypatch.setattr(
        lifecycle,
        "ModelRegistry",
        lambda settings: SimpleNamespace(close=lambda: calls.append("registry-close")),
    )

    async def run():
        async with lifecycle.lifespan(SimpleNamespace(state=SimpleNamespace())):
            calls.append("running")

    asyncio.run(run())
    assert calls == ["running", "registry-close", "release"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"host": "0.0.0.0"},
        {"ai_service_token": "short"},
        {"app_env": "production"},
        {"realtime_talk_enabled": True},
        {"echo_active_models": {"distress": "another-model"}},
        {"worker_enabled": True, "backend_url": "https://example.com/api/v1/internal/ai"},
        {"worker_enabled": True, "ai_worker_token": "short"},
    ],
)
def test_text_profile_cannot_expand_network_or_execution_scope(monkeypatch, overrides):
    from importlib import import_module

    lifecycle = import_module("app.core.lifespan")
    values = {
        "core_models_enabled": True,
        "core_transport": "text_memory",
        "app_env": "test",
        "host": "127.0.0.1",
        "ai_service_token": "x" * 32,
        "worker_enabled": False,
        "realtime_talk_enabled": False,
        "echo_active_models": {},
        "backend_url": "http://127.0.0.1:4200/api/v1/internal/ai",
        "ai_worker_token": "w" * 32,
    }
    values.update(overrides)
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(**values))

    def forbidden(*_):
        raise AssertionError("Must not construct a worker/runtime")

    monkeypatch.setattr("app.model.text_transport.TextRuntime", forbidden)

    async def run():
        async with lifecycle.lifespan(SimpleNamespace(state=SimpleNamespace())):
            raise AssertionError("Unsafe profile started")

    with pytest.raises(ValueError):
        asyncio.run(run())


def test_text_only_owner_does_not_preload_models_or_start_optional_workers(tmp_path, monkeypatch):
    import torch

    from app.model.core import CoreRuntime

    (tmp_path / "manifest.json").write_text(json.dumps({"inferenceCode": [], "files": []}))
    calls = []
    monkeypatch.setattr(torch.cuda, "is_available", lambda: True)
    monkeypatch.setattr(torch.cuda, "reset_peak_memory_stats", lambda: None)
    monkeypatch.setattr(CoreRuntime, "release", lambda *_: None)
    monkeypatch.setattr(CoreRuntime, "_load", lambda _, name: calls.append(name))
    runtime = CoreRuntime(SimpleNamespace(models_root=str(tmp_path), queue_limit=1), text_only=True)
    assert runtime.loaded and not calls and not hasattr(runtime, "talk")


def test_lazy_worker_readiness_does_not_claim_resident_weights():
    from fastapi import Response

    from app.api.routes.readiness import readiness

    runtime = SimpleNamespace(loaded=True, model_loaded=False)
    result = readiness(
        SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(model_runtime=runtime))),
        Response(),
    )
    assert result.status == "ready" and result.model_loaded is False


def test_deadline_also_reaps_a_child_that_stops_reading_stdin(child):
    import time

    runtime = child("notreading")
    started = time.monotonic()
    with pytest.raises(ModelUnavailableError):
        runtime.classify("x" * 60000)
    assert time.monotonic() - started < 5
    assert runtime.process.poll() is not None and not runtime.writer.is_alive()


def test_journal_worker_can_forward_its_existing_safety_classification(child):
    runtime = child()
    classification = {"distress_category": "Others", "suicidal_language_flag": False}
    try:
        assert runtime.analyze("Fictional reflection", "en", classification) == [
            "Fictional reflection", "en", classification
        ]
    finally:
        runtime.release()


def test_overlapping_buddy_and_journal_requests_wait_without_crossing_outputs(child):
    from concurrent.futures import ThreadPoolExecutor
    runtime = child("delay")
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(runtime.classify, "fictional journal", "en")
        second = pool.submit(runtime.chat, [{"role": "user", "content": "hello"}])
        assert first.result() == ["fictional journal", "en"]
        assert second.result() == [[{"role": "user", "content": "hello"}]]
    assert runtime.loaded
    # Admission remains bounded and a rejected request does not kill the owner.
    for _ in range(4):
        assert runtime.pending.acquire(blocking=False)
    try:
        with pytest.raises(ModelUnavailableError, match="queue is full"):
            runtime.chat([{"role": "user", "content": "another"}])
        assert runtime.loaded
    finally:
        for _ in range(4):
            runtime.pending.release()
    runtime.release()
