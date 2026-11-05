import errno
import pytest
from app.model.loading_policy import load_with_retries,NativeLoadError
from app.core.exceptions import TalkBusyError,TalkCancelledError

def test_transient_loader_failures_have_five_total_attempts_and_exact_backoff():
 calls=[];cleanup=[];delays=[]
 def load():calls.append(True);raise OSError(errno.EBUSY,'private path')
 with pytest.raises(NativeLoadError,match='NATIVE_EMOTION_LOAD_FAILED'):load_with_retries('e4',load,lambda:cleanup.append(True),sleep=delays.append)
 assert len(calls)==len(cleanup)==5 and delays==[2,5,10,20]

@pytest.mark.parametrize('error,suffix',[(FileNotFoundError('private'),'ASSET_MISSING'),(PermissionError('private'),'ACCESS_DENIED'),(ImportError('private'),'IMPORT_FAILED'),(ValueError('private'),'CONFIG_INVALID'),(OSError(errno.ENOMEM,'private'),'MEMORY_UNAVAILABLE')])
def test_permanent_failure_is_sanitized_and_not_retried(error,suffix):
 calls=[]
 def load():calls.append(True);raise error
 with pytest.raises(NativeLoadError,match='NATIVE_PHQ_'+suffix) as caught:load_with_retries('phq8',load,lambda:None,sleep=lambda _:pytest.fail('No retry'))
 assert calls==[True] and 'private' not in str(caught.value)

@pytest.mark.parametrize('error',[TalkBusyError('capacity waiting'),TalkCancelledError('cancelled')])
def test_capacity_and_cancellation_are_not_failed_attempt_retries(error):
 def load():raise error
 with pytest.raises(type(error)):load_with_retries('xlmr',load,lambda:pytest.fail('No failed-load cleanup'),sleep=lambda _:pytest.fail('No retry'))

def test_successful_model_is_returned_once_and_inference_is_not_in_the_retry_loop():
 loaded=object();calls=[];events=[]
 def load():calls.append(True);return loaded
 assert load_with_retries('xlmr',load,lambda:pytest.fail('No cleanup'),report=events.append) is loaded
 assert len(calls)==1 and [e['state'] for e in events]==['loading','ready']

def test_core_retry_cleanup_preserves_other_healthy_residents(monkeypatch):
 from types import SimpleNamespace
 from app.model.core import CoreRuntime
 import sys
 r=CoreRuntime.__new__(CoreRuntime);healthy=object();r.resident={'xlmr':healthy};r.instance=None;r.active=None
 monkeypatch.setitem(sys.modules,'torch',SimpleNamespace(cuda=SimpleNamespace(empty_cache=lambda:None)))
 def load(name):r.resident[name]=object();r.instance=r.resident[name];r.active=name;raise ValueError('Invalid emotion config')
 r._load_once=load
 with pytest.raises(NativeLoadError):r._load('e4')
 assert r.resident=={'xlmr':healthy} and r.instance is None

def test_generation_error_does_not_replay_an_already_loaded_model():
 import threading
 from app.model.core import CoreRuntime
 r=CoreRuntime.__new__(CoreRuntime);r.loaded=True;r.slots=threading.BoundedSemaphore(1);r.lock=threading.RLock();loads=[];inferences=[];released=[]
 r._load=lambda name:loads.append(name) or object();r.release=lambda:released.append(True)
 def infer(model):inferences.append(True);raise OSError('Inference failed')
 with pytest.raises(OSError):r.call('e4',infer)
 assert loads==['e4'] and inferences==[True] and released==[True]
