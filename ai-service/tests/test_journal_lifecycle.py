from types import SimpleNamespace
import threading
import sys
import pytest
from app.model.core import CoreRuntime
from app.model.text_transport import TextRuntime
from app.core.exceptions import TalkBusyError


def test_leaving_one_owner_blocks_its_next_stage_without_blocking_other_accounts():
    r=CoreRuntime.__new__(CoreRuntime)
    r.journal_owners={'a'*64,'b'*64}
    r.require_journal_owner('a'*64)
    r.journal_owners.remove('a'*64)
    with pytest.raises(TalkBusyError):r.require_journal_owner('a'*64)
    r.require_journal_owner('b'*64)


def test_every_analysis_stage_carries_its_owner_fence():
    r=TextRuntime.__new__(TextRuntime);r.buddy_enabled=True
    calls=[]
    def call(operation,*args,**metadata):
        calls.append((operation,metadata))
        return {'safe':True}
    r._call=call
    r.analyze('synthetic',owner='a'*64)
    assert [op for op,meta in calls]==['classify','emotions','screening','analyze']
    assert all(meta=={'journal_owner':'a'*64} for op,meta in calls)


def test_journal_unload_drops_only_journal_models_and_keeps_buddy(monkeypatch):
    r=CoreRuntime.__new__(CoreRuntime);r.lock=threading.RLock();r.resident={'xlmr':object(),'e4':object()};r.instance=object();r.active='e4'
    cbt=object();r.buddy=SimpleNamespace(workers={'cbt':cbt})
    monkeypatch.setitem(sys.modules,'torch',SimpleNamespace(cuda=SimpleNamespace(empty_cache=lambda:None)))
    assert r.journal_runtime('unload',[])=={'unloaded':True}
    assert r.resident=={} and r.instance is None and r.active is None
    assert r.buddy.workers['cbt'] is cbt and r.journal_paused


def test_journal_cannot_evict_resident_cbt():
    r=CoreRuntime.__new__(CoreRuntime)
    r.buddy=SimpleNamespace(workers={'cbt':SimpleNamespace(process=SimpleNamespace(poll=lambda:None))},evict=lambda:pytest.fail('Must retain CBT'))
    with pytest.raises(TalkBusyError):r._load('e4')


def test_capacity_wait_does_not_run_global_release():
    r=CoreRuntime.__new__(CoreRuntime);r.require_ready=lambda:None;r.slots=threading.BoundedSemaphore(1);r.lock=threading.RLock()
    def load(name):raise TalkBusyError('Buddy residency has priority')
    r._load=load;r.release=lambda:pytest.fail('Capacity waiting must not evict CBT')
    with pytest.raises(TalkBusyError):r.call('e4',lambda m:None)
