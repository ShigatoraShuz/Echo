import threading
from types import SimpleNamespace

import pytest

from app.core.exceptions import ModelUnavailableError, TalkCancelledError
from app.model.core import CoreRuntime


def core_stub():
    core = CoreRuntime.__new__(CoreRuntime)
    core.loaded = True
    core.slots = threading.BoundedSemaphore(4)
    core.lock = threading.RLock()
    core._talk_context = threading.local()
    core.talk = SimpleNamespace(owner="session")
    core._load = lambda name: pytest.fail("Journal models must wait for Talk")
    return core


def test_journal_work_cannot_replace_a_reserved_gpu_model():
    core = core_stub()
    with pytest.raises(ModelUnavailableError):
        core.call("e4", lambda model: None)


def test_priority_is_rechecked_after_acquiring_execution_lock():
    core = core_stub()
    core.talk.owner = None
    released = []
    core.release = lambda: released.append(True)

    class Lock:
        def acquire(self, **kwargs):
            core.talk.owner = "session"
            return True

        def release(self):
            pass

    core.lock = Lock()
    with pytest.raises(ModelUnavailableError):
        core.call("e4", lambda model: None)
    assert released == []


def test_cancelling_generation_does_not_unload_warm_cbt():
    core = core_stub()
    core._talk_context.active = True
    core._load = lambda name: object()
    core.release = lambda: pytest.fail("Cancellation is not a loader failure")

    def cancelled(_):
        raise TalkCancelledError("Cancelled")

    with pytest.raises(TalkCancelledError):
        core.call("cbt", cancelled)


def test_priority_is_reported_as_retryable_without_inference_details():
    from fastapi import HTTPException

    from app.api.routes.core import invoke
    from app.core.exceptions import TalkBusyError

    def busy():
        raise TalkBusyError("private loader path")

    with pytest.raises(HTTPException) as error:
        invoke(busy)
    assert error.value.status_code == 503
    assert error.value.detail == {"code": "TALK_BUSY"}


def test_screening_stage_wait_does_not_become_a_completed_unavailable_estimate(monkeypatch):
    import sys

    from app.core.exceptions import TalkBusyError

    monkeypatch.setitem(
        sys.modules, "app.vendor.e4.inference", SimpleNamespace(infer_journal=lambda *args: None)
    )
    core = CoreRuntime.__new__(CoreRuntime)
    core.call = lambda *args: {}

    def busy(text):
        raise TalkBusyError("Talk started between model stages")

    core.screening = busy
    with pytest.raises(TalkBusyError):
        core.analyze("Synthetic journal", classification={"distress_category": "Others"})


def test_disabled_buddy_does_not_start_a_legacy_voice(monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from app.api.routes import core as routes
    from app.core import config
    monkeypatch.setattr(config, "get_settings", lambda: SimpleNamespace(realtime_talk_enabled=True))
    monkeypatch.setattr(routes, "runtime", lambda request: SimpleNamespace(talk=None))
    payload = routes.TalkInput(sessionId="00000000-0000-0000-0000-000000000000", task="warm")
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.talk(payload, None))
    assert error.value.status_code == 503
    assert error.value.detail == "Buddy is disabled"
