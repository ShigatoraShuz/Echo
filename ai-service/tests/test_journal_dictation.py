import threading
from types import SimpleNamespace
import pytest
from app.model.core import CoreRuntime
from app.api.routes.core import DictationInput
from app.model.text_transport import TextRuntime

def test_whisper_dictation_is_independent_of_buddy_enablement():
    runtime=CoreRuntime.__new__(CoreRuntime);seen=[];cancelled=threading.Event()
    runtime.talk=None;runtime.operation_cancelled=cancelled
    runtime.buddy=SimpleNamespace(dispatch=lambda session,payload,**kw:seen.append((session,payload,kw)) or {'text':'Synthetic'})
    assert runtime.dictation({'task':'transcribe','sessionId':'session','audio':'YQ=='})=={'text':'Synthetic'}
    assert seen[0][1]['language']=='English' and seen[0][1]['audioFormat']=='encoded'
    assert seen[0][2]['cancelled'] is cancelled
    with pytest.raises(ValueError):runtime.dictation({'task':'speak','sessionId':'session'})

def test_internal_dictation_accepts_only_fixed_tasks_and_bounded_audio():
    from pydantic import ValidationError
    session='10000000-0000-4000-8000-000000000001'
    for task in ('warm_whisper','transcribe','close'):assert DictationInput(task=task,sessionId=session).task==task
    for args in ({'task':'chat'},{'task':'transcribe','audio':'x'*13981017},{'task':'close','language':'Filipino'}):
        with pytest.raises(ValidationError):DictationInput(sessionId=session,**args)

def test_text_transport_uses_dedicated_operation_and_cancellation():
    runtime=TextRuntime.__new__(TextRuntime);seen=[]
    runtime._call=lambda *args,**kw:seen.append((args,kw)) or {'ready':True}
    event=threading.Event();assert runtime.dictation({'task':'warm_whisper'},event)=={'ready':True}
    assert seen==[(('dictation',{'task':'warm_whisper'}),{'cancelled':event})]

def test_recording_lease_covers_a_full_recording_and_upload(monkeypatch):
    runtime=CoreRuntime.__new__(CoreRuntime);runtime.lock=threading.RLock()
    runtime.buddy=SimpleNamespace(owner='session',deadline=0,dispatch=lambda *args,**kw:{'ready':True})
    monkeypatch.setattr('app.model.core.time.monotonic',lambda:100)
    assert runtime.dictation({'task':'warm_whisper','sessionId':'session'})=={'ready':True}
    assert runtime.buddy.deadline==220
