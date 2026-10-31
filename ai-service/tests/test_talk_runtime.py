import json
import queue
import threading
from types import SimpleNamespace

import pytest

from app.core.exceptions import ModelUnavailableError, TalkCancelledError
from app.model.core import CoreRuntime
from app.model.talk import TalkRuntime


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


def test_cooperative_cancel_keeps_persistent_speech_worker_alive(monkeypatch):
    talk = TalkRuntime.__new__(TalkRuntime)
    talk.process_lock = threading.Lock()
    talk.responses = queue.Queue()
    talk._ensure_worker = lambda: None

    class Input:
        def write(self, line):
            request = json.loads(line)
            talk.responses.put({"id": request["id"], "result": {"text": "must not publish"}})

        def flush(self):
            pass

    talk.process = SimpleNamespace(stdin=Input())
    talk._kill = lambda: pytest.fail("A cooperative cancellation must not cold-reload speech")
    cancelled = threading.Event()
    cancelled.set()
    with pytest.raises(TalkCancelledError):
        talk._request({"task": "transcribe"}, cancelled)


def test_cancelled_generation_restores_model_method_and_rejects_draft():
    cancelled = threading.Event()

    class Model:
        def generate(self, **kwargs):
            cancelled.set()
            assert kwargs["stopping_criteria"][-1](None, None)
            return "unchecked draft"

    model = Model()
    original = model.generate
    core = SimpleNamespace(
        lock=threading.RLock(),
        _talk_context=threading.local(),
        _load=lambda name: (model, None),
        chat=lambda messages: model.generate(),
    )
    talk = TalkRuntime.__new__(TalkRuntime)
    talk.owner = "session"
    talk.deadline = 0
    talk.cpu_classifier = object()
    talk.core = core
    with pytest.raises(TalkCancelledError):
        talk.chat("session", [{"role": "user", "content": "Synthetic"}], cancelled)
    assert model.generate == original
    assert not core._talk_context.active


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


@pytest.mark.parametrize("low_memory", [False, True])
def test_start_falls_back_to_cpu_or_fails_closed_on_low_headroom(monkeypatch, tmp_path, low_memory):
    import contextlib
    import sys

    events = []
    core = SimpleNamespace(
        root=tmp_path,
        lock=threading.RLock(),
        release=lambda: events.append("release"),
        _load=lambda name: (
            SimpleNamespace(generate=lambda **kw: None),
            SimpleNamespace(pad_token_id=0, __call__=lambda *a, **kw: None),
        ),
    )

    class Tokenizer:
        pad_token_id = 0

        def __call__(self, *args, **kwargs):
            class Inputs(dict):
                def to(self, device):
                    return self

            return Inputs()

    core._load = lambda name: (SimpleNamespace(generate=lambda **kw: None), Tokenizer())
    talk = TalkRuntime.__new__(TalkRuntime)
    talk.core = core
    talk.owner = None
    talk.cpu_classifier = SimpleNamespace(classify=lambda text: None)
    talk.device = "cuda"
    talk._kill = lambda: events.append("reaped")

    def request(payload):
        if talk.device == "cuda":
            raise ModelUnavailableError("Synthetic CUDA unavailable")
        return {"ready": True}

    talk._request = request
    torch = SimpleNamespace(
        set_num_threads=lambda n: None,
        inference_mode=contextlib.nullcontext,
        cuda=SimpleNamespace(
            mem_get_info=lambda: (1024**3 if low_memory else 8 * 1024**3, 16 * 1024**3)
        ),
    )
    monkeypatch.setitem(sys.modules, "torch", torch)
    if low_memory:
        with pytest.raises(ModelUnavailableError, match="headroom"):
            talk.start("session")
        assert talk.owner is None and "release" in events
    else:
        assert talk.start("session")["ready"] and talk.device == "cpu"
    assert "reaped" in events


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
