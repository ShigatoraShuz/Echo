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


def test_api_forwards_spoken_profile_and_rejects_unknown_profile(monkeypatch):
    import asyncio
    from pydantic import ValidationError
    from app.api.routes import core as routes
    from app.core import config
    seen=[]
    class Request:
        async def is_disconnected(self):return False
    def chat(session,messages,cancelled,**kwargs):
        seen.append((messages,kwargs))
        return {'reply':'Complete approved reply.'}
    monkeypatch.setattr(config,'get_settings',lambda:SimpleNamespace(realtime_talk_enabled=True))
    monkeypatch.setattr(routes,'runtime',lambda request:SimpleNamespace(talk=SimpleNamespace(chat=chat)))
    fields={'sessionId':'00000000-0000-0000-0000-000000000000','task':'chat','messages':[{'role':'user','content':'Synthetic'}]}
    assert asyncio.run(routes.talk(routes.TalkInput(**fields,deliveryMode='voice'),Request()))['reply']
    assert seen[-1][1]=={'delivery_mode':'voice','generation_attempt':0}
    asyncio.run(routes.talk(routes.TalkInput(**fields,deliveryMode='voice',generationAttempt=5),Request()))
    assert seen[-1][1]['generation_attempt']==5
    asyncio.run(routes.talk(routes.TalkInput(**fields),Request()))
    assert seen[-1][1]=={}
    with pytest.raises(ValidationError):routes.TalkInput(**fields,deliveryMode='unknown')
    with pytest.raises(ValidationError):routes.TalkInput(**fields,generationAttempt=6)


def test_talk_withholding_retains_sanitized_diagnostics(monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from app.api.routes import core as routes
    from app.core import config
    class Request:
        async def is_disconnected(self): return False
    result={'reply':None,'withheld':True,'diagnostics':{'blockingIssues':['incomplete_list_item'],'attempts':2}}
    monkeypatch.setattr(config,'get_settings',lambda:SimpleNamespace(realtime_talk_enabled=True))
    monkeypatch.setattr(routes,'runtime',lambda request:SimpleNamespace(talk=SimpleNamespace(chat=lambda *a,**kw:result)))
    payload=routes.TalkInput(sessionId='00000000-0000-0000-0000-000000000000',task='chat',deliveryMode='voice',messages=[{'role':'user','content':'Synthetic'}])
    with pytest.raises(HTTPException) as error: asyncio.run(routes.talk(payload,Request()))
    assert error.value.status_code==503
    assert error.value.detail=={'code':'BUDDY_RESPONSE_WITHHELD','diagnostics':result['diagnostics']}


def test_chat_forwards_retry_identity_and_preserves_withholding_reasons(monkeypatch):
    from fastapi import HTTPException
    from app.api.routes import core as routes
    seen=[]
    def chat(messages,**kwargs):
        seen.append(kwargs)
        return {'reply':None,'withheld':True,'diagnostics':{'blockingIssues':['incomplete_list_item'],'attempts':2}}
    monkeypatch.setattr(routes,'runtime',lambda request:SimpleNamespace(chat=chat))
    payload=routes.ChatInput(messages=[{'role':'user','content':'Synthetic'}],generationAttempt=3)
    with pytest.raises(HTTPException) as error:routes.chat(payload,None)
    assert seen==[{'generation_attempt':3}]
    assert error.value.status_code==503
    assert error.value.detail['diagnostics']['blockingIssues']==['incomplete_list_item']
