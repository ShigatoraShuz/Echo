from types import SimpleNamespace
import threading
import pytest
from app.buddy.runtime import BuddyRuntime
from app.core.exceptions import ModelUnavailableError,TalkCancelledError

def runtime():
 r=BuddyRuntime.__new__(BuddyRuntime)
 r.core=SimpleNamespace(lock=threading.RLock(),release=lambda:None)
 r.owner=None;r.workers={};r.cpu_classifier=object();r._classifier=lambda:r.cpu_classifier
 r.ready=False;r.status={};r.deadline=0;r.voice_mode='fast'
 r.progress_lock=threading.RLock();r.loading_generation=0;r.whisper_preparation=None;r.component_status={}
 return r

def test_page_prepare_loads_only_cbt_and_stop_retains_its_identity():
 r=runtime();closed=[];calls=[]
 def worker(kind,payload,cancelled=None,**kwargs):
  calls.append(kind)
  r.workers.setdefault(kind,SimpleNamespace(process=SimpleNamespace(pid=len(calls),poll=lambda:None),close=lambda:closed.append(kind)))
  return {'freeGpuBytes':4*1024**3}
 r._worker=worker
 r.start('page',speech=False);cbt=r.workers['cbt']
 assert calls==['cbt']
 r.stop('page');assert r.workers['cbt'] is cbt
 r.start('talk');assert r.workers['cbt'] is cbt
 assert set(r.workers)=={'cbt','whisper','nano'}
 r.stop('talk');assert set(r.workers)=={'cbt'} and r.workers['cbt'] is cbt
 assert set(closed)=={'nano','whisper'}

def test_transient_prepare_retries_five_times_without_retrying_generation(monkeypatch):
 r=runtime();attempts=[];sleeps=[]
 def fail(kind,request,cancelled,**kwargs):
  attempts.append(request)
  raise ModelUnavailableError('Temporary pipe failure')
 r._worker=fail;monkeypatch.setattr('app.buddy.runtime.time.sleep',sleeps.append)
 with pytest.raises(ModelUnavailableError):r._prepare('cbt')
 assert attempts==[{'check':True}]*5 and sleeps==[2,5,10,20]

def test_permanent_failure_is_not_retried(monkeypatch):
 r=runtime();attempts=[]
 def fail(*args,**kwargs):attempts.append(1);raise ModelUnavailableError('BUDDY_ADAPTER_INTEGRITY_FAILED')
 r._worker=fail;monkeypatch.setattr('app.buddy.runtime.time.sleep',lambda _:pytest.fail('Do not wait on corruption'))
 with pytest.raises(ModelUnavailableError):r._prepare('cbt')
 assert len(attempts)==1

def test_speech_failure_does_not_remove_healthy_cbt():
 r=runtime();cbt=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None),close=lambda:pytest.fail('CBT must survive speech failure'))
 r.workers['cbt']=cbt
 def worker(kind,*args,**kwargs):raise ModelUnavailableError('BUDDY_NANO_INTEGRITY_FAILED')
 r._worker=worker
 with pytest.raises(ModelUnavailableError):r.start('talk')
 assert r.workers['cbt'] is cbt


def test_second_buddy_page_can_prepare_chat_while_first_page_is_talking():
 r=runtime();r.owner='active-talk';r.ready=True
 cbt=SimpleNamespace(process=SimpleNamespace(pid=42,poll=lambda:None))
 r.workers={'cbt':cbt}
 result=r.start('other-page',speech=False)
 assert result['chatReady'] and r.owner=='active-talk' and r.workers['cbt'] is cbt

@pytest.mark.parametrize('code',[
 'BUDDY_NANO_ASSET_MISSING','BUDDY_NANO_RUNTIME_MISMATCH','BUDDY_NANO_INSUFFICIENT_MEMORY',
 'BUDDY_NANO_ENV_IMPORT_FAILED','BUDDY_NANO_ENV_ACCESS_DENIED','BUDDY_VOICE_METADATA_FAILED',
])
def test_permanent_load_errors_never_consume_five_attempts(monkeypatch,code):
 r=runtime();calls=[]
 def fail(*args,**kwargs):calls.append(1);raise ModelUnavailableError(code)
 r._worker=fail;monkeypatch.setattr('app.buddy.runtime.time.sleep',lambda _:pytest.fail('Permanent failures must not retry'))
 with pytest.raises(ModelUnavailableError):r._prepare('nano')
 assert len(calls)==1 and r.status['state']=='failed' and r.status['retryable'] is False

def test_nano_warmup_retries_within_same_attempt_budget_and_preserves_cbt(monkeypatch):
 r=runtime();events=[];calls=[];closed=[];cbt=object();r.workers['cbt']=cbt
 r.progress=lambda value:events.append(dict(value))
 def worker(kind,payload,cancelled=None,**kwargs):
  calls.append((payload,kwargs['deadline']))
  if payload.get('check'):
   r.workers['nano']=SimpleNamespace(close=lambda:closed.append('nano'));return {}
  if len(closed)==0:raise ModelUnavailableError('BUDDY_NANO_WORKER_UNAVAILABLE')
  return {'freeGpuBytes':3*1024**3}
 r._worker=worker;monkeypatch.setattr('app.buddy.runtime.time.sleep',lambda _:None)
 r._prepare('nano')
 assert len(calls)==4 and calls[0][1]==calls[1][1] and calls[2][1]==calls[3][1]
 assert closed==['nano'] and r.workers['cbt'] is cbt
 assert [(e['state'],e['attempt']) for e in events]==[('loading',1),('warming',1),('retrying',1),('loading',2),('warming',2),('ready',2)]

def test_cancellation_during_backoff_does_not_start_next_attempt():
 r=runtime();cancelled=threading.Event();calls=[]
 def fail(*args,**kwargs):calls.append(1);cancelled.set();raise ModelUnavailableError('BUDDY_NANO_WORKER_UNAVAILABLE')
 r._worker=fail
 with pytest.raises(TalkCancelledError):r._prepare('nano',cancelled)
 assert len(calls)==1 and r.status['state']=='cancelled'

def test_long_speech_preparation_renews_owner_from_completion(monkeypatch):
 r=runtime();now=[1.0];monkeypatch.setattr('app.buddy.runtime.time.monotonic',lambda:now[0])
 def prepare(*args):now[0]=250.0
 r._prepare=prepare
 assert r.dispatch('read-aloud',{'task':'warm_nano'})=={'ready':True}
 assert r.owner=='read-aloud' and r.deadline==310.0

def test_talk_readiness_reports_the_actual_post_warmup_memory_measurement():
 r=runtime();r.workers['cbt']=SimpleNamespace(process=SimpleNamespace(pid=12,poll=lambda:None))
 def prepare(kind,cancelled=None):
  r.workers[kind]=SimpleNamespace(process=SimpleNamespace(pid=13 if kind=='nano' else 14,poll=lambda:None))
  return {'freeGpuBytes':3*1024**3}
 r._prepare=prepare
 assert r.start('talk')['freeGpuBytes']==3*1024**3

def test_cancelled_start_keeps_healthy_cbt_and_preserves_cancellation():
 r=runtime();cbt=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None));r.workers['cbt']=cbt
 def prepare(*args):raise TalkCancelledError('Cancelled')
 r._prepare=prepare
 with pytest.raises(TalkCancelledError):r.start('talk')
 assert r.workers['cbt'] is cbt and r.owner is None

def test_whisper_and_nano_prepare_concurrently_but_gpu_stays_on_owner_thread():
 r=runtime();entered=threading.Event();nano=threading.Event();threads={};main=threading.get_ident()
 r.workers['cbt']=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None))
 def prepare(kind,cancelled=None):
  threads[kind]=threading.get_ident()
  if kind=='whisper':entered.set();assert nano.wait(2)
  else:assert entered.wait(2);nano.set()
  r.workers[kind]=SimpleNamespace(process=SimpleNamespace(pid=2 if kind=='nano' else 3,poll=lambda:None),close=lambda:None)
  return {'freeGpuBytes':3*1024**3}
 r._prepare=prepare
 assert r.start('talk')['speechReady']
 assert threads['nano']==main and threads['whisper']!=main
 assert r.whisper_preparation.done.is_set()

def test_nano_failure_cancels_cpu_preparation_before_returning_and_keeps_cbt():
 r=runtime();entered=threading.Event();exited=threading.Event();cbt=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None));r.workers['cbt']=cbt
 def prepare(kind,cancelled=None):
  if kind=='whisper':
   entered.set();assert cancelled.wait(2);exited.set();raise TalkCancelledError('Cancelled')
  assert entered.wait(2);raise ModelUnavailableError('BUDDY_NANO_RUNTIME_MISMATCH')
 r._prepare=prepare
 with pytest.raises(ModelUnavailableError,match='BUDDY_NANO_RUNTIME_MISMATCH'):r.start('talk')
 assert exited.is_set() and r.workers=={'cbt':cbt} and r.owner is None and not r.ready

def test_cpu_failure_cancels_nano_and_keeps_original_actionable_error():
 r=runtime();entered=threading.Event();r.workers['cbt']=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None))
 def prepare(kind,cancelled=None):
  if kind=='whisper':entered.set();raise ModelUnavailableError('BUDDY_WHISPER_ENV_IMPORT_FAILED')
  assert entered.wait(2);assert cancelled.wait(2);raise TalkCancelledError('Cancelled')
 r._prepare=prepare
 with pytest.raises(ModelUnavailableError,match='BUDDY_WHISPER_ENV_IMPORT_FAILED'):r.start('talk')
 assert r.owner is None and not r.ready and r.whisper_preparation.done.is_set()

def test_cancelled_constructor_cannot_publish_a_late_worker(monkeypatch):
 r=runtime();cancelled=threading.Event();closed=[]
 class Worker:
  def __init__(self,*args,**kwargs):cancelled.set()
  def close(self):closed.append(True)
 monkeypatch.setattr('app.buddy.runtime.Process',Worker)
 with pytest.raises(TalkCancelledError):r._worker('whisper',{'check':True},cancelled)
 assert closed==[True] and 'whisper' not in r.workers

def test_parallel_progress_does_not_claim_ready_while_another_component_loads():
 r=runtime();r._publish('nano','loading');r._publish('whisper','ready')
 assert r.status['loadingComponents']==['nano']
 previous=dict(r.status);r.loading_generation+=1;r._publish('nano','ready',_generation=0)
 assert r.status==previous

def test_stop_during_parallel_loading_cancels_both_branches():
 from concurrent.futures import ThreadPoolExecutor
 r=runtime();cpu=threading.Event();gpu=threading.Event();cancelled=threading.Event()
 cbt=SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None));r.workers['cbt']=cbt
 def prepare(kind,signal=None):
  (cpu if kind=='whisper' else gpu).set()
  assert signal.wait(2)
  raise TalkCancelledError('Cancelled')
 r._prepare=prepare
 with ThreadPoolExecutor(max_workers=1) as pool:
  result=pool.submit(r.start,'talk',cancelled)
  assert cpu.wait(2) and gpu.wait(2);cancelled.set()
  with pytest.raises(TalkCancelledError):result.result(timeout=2)
 assert r.workers=={'cbt':cbt} and not r.ready and r.owner is None and r.whisper_preparation.done.is_set()

def test_speech_worker_loss_does_not_evict_healthy_page_owned_cbt(monkeypatch):
 r=runtime();closed=[];r.closed=False;r.ready=True
 r.workers={kind:SimpleNamespace(process=SimpleNamespace(poll=lambda k=kind:1 if k=='whisper' else None),close=lambda k=kind:closed.append(k)) for kind in ('cbt','nano','whisper')}
 cbt=r.workers['cbt'];monkeypatch.setattr('app.buddy.runtime.time.sleep',lambda _:setattr(r,'closed',True))
 r._watch()
 assert r.workers=={'cbt':cbt} and set(closed)=={'nano','whisper'} and r.status['code']=='BUDDY_WORKER_LOST'


def test_isolated_safety_capacity_wait_preserves_existing_cbt():
 from app.core.exceptions import TalkBusyError
 r=runtime();cbt=SimpleNamespace(process=SimpleNamespace(poll=lambda:None),close=lambda:pytest.fail('capacity wait must preserve CBT'))
 r.workers['cbt']=cbt
 def waiting():raise TalkBusyError('GPU capacity waiting')
 r._classifier=waiting
 with pytest.raises(TalkBusyError):r.start('talk')
 assert r.workers['cbt'] is cbt and r.owner is None and r.status['code']=='TALK_BUSY'



def test_expressive_talk_uses_moss_and_fast_switch_keeps_cbt():
 r=runtime();closed=[]
 def worker(kind,payload,cancelled=None,**kwargs):
  r.workers.setdefault(kind,SimpleNamespace(process=SimpleNamespace(pid=1,poll=lambda:None),close=lambda:closed.append(kind)))
  return {'freeGpuBytes':4*1024**3}
 r._worker=worker
 r.start('talk',voice_mode='expressive');cbt=r.workers['cbt']
 assert set(r.workers)=={'cbt','whisper','moss'} and r.healthy()
 r.stop('talk');assert r.workers=={'cbt':cbt}
 r.start('talk',voice_mode='fast')
 assert set(r.workers)=={'cbt','whisper','nano'} and r.workers['cbt'] is cbt
 assert 'moss' in closed
