"""Owned-process fault tests: no real models, accounts or saved inputs."""
import json,sys,threading,time
from types import SimpleNamespace
import pytest
from app.model.native_process import NativeProcess,envelope
from app.model.loading_policy import ComponentLoadError,ComponentOperationError,load_with_retries
from app.core.exceptions import TalkCancelledError,TalkBusyError
from app.buddy.job import spawn_owned


def fixture_worker(monkeypatch,mode='ok'):
 children=[]
 def spawn(args,**kwargs):
  assert 'AI_SERVICE_TOKEN' not in kwargs['env'] and 'SUPABASE_SERVICE_ROLE_KEY' not in kwargs['env']
  assert kwargs['resource_limits']=={'memory_bytes':28_000_000_000,'cpu_percent':60}
  kind=args[-2] if args[-1]=='cpu' else args[-1];cpu=args[-1]=='cpu'
  assert 'private input' not in str(args)
  lines=['import json,sys,time','p=json.loads(sys.stdin.readline())']
  if mode=='load_hang':lines+=['time.sleep(60)']
  elif mode=='load_crash':lines+=['sys.exit(3)']
  elif mode=='import_error':lines+=["print(json.dumps({'id':p['id'],'error':'IMPORT_FAILED','retryable':False}),flush=True)"]
  else:
   ready={'ready':True,'component':kind,**({'device':'cpu'} if cpu else {})}
   lines+=["print(json.dumps({'id':p['id'],'result':"+repr(ready)+"}),flush=True)",'for line in sys.stdin:'," p=json.loads(line)"]
   if mode=='infer_hang':lines+=[' time.sleep(60)']
   elif mode=='output_invalid':lines+=[" print(json.dumps({'id':p['id'],'error':'OUTPUT_INVALID'}),flush=True)"]
   elif mode=='mismatch':lines+=[" print(json.dumps({'id':'wrong','result':{}}),flush=True)"]
   else:lines+=[" print(json.dumps({'id':p['id'],'result':{'value':p['text']}}),flush=True)"]
  child=spawn_owned([sys.executable,'-I','-B','-u','-c',chr(10).join(lines)],**kwargs);children.append(child);return child
 monkeypatch.setattr('app.model.native_process.spawn_owned',spawn)
 return children


@pytest.mark.parametrize('kind',['xlmr','e4','phq8'])
def test_resident_worker_reuses_pid_and_does_not_cache_previous_input(monkeypatch,tmp_path,kind):
 children=fixture_worker(monkeypatch);monkeypatch.setenv('AI_SERVICE_TOKEN','private service sentinel')
 worker=NativeProcess(tmp_path,kind)
 try:
  pid=worker.process.pid
  assert worker.call('private input')=={'value':'private input'}
  assert worker.call('second input')=={'value':'second input'}
  assert worker.process.pid==pid and len(children)==1
 finally:worker.close()
 assert children[0].poll() is not None and list(tmp_path.iterdir())==[]


@pytest.mark.parametrize('kind',['xlmr','e4','phq8'])
def test_load_timeout_kills_only_owned_component(monkeypatch,tmp_path,kind):
 children=fixture_worker(monkeypatch,'load_hang');monkeypatch.setitem(__import__('app.model.native_process',fromlist=['LOAD_SECONDS']).LOAD_SECONDS,kind,.2)
 with pytest.raises(ComponentLoadError,match='LOAD_TIMEOUT'):NativeProcess(tmp_path,kind)
 assert len(children)==1 and children[0].poll() is not None


def test_five_timeouts_reap_each_worker_before_retry(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch,'load_hang');monkeypatch.setitem(__import__('app.model.native_process',fromlist=['LOAD_SECONDS']).LOAD_SECONDS,'e4',.2)
 def load():
  assert all(p.poll() is not None for p in children)
  return NativeProcess(tmp_path,'e4')
 delays=[]
 with pytest.raises(Exception,match='NATIVE_EMOTION_LOAD_TIMEOUT'):load_with_retries('e4',load,lambda:None,sleep=delays.append)
 assert len(children)==5 and delays==[2,5,10,20]


def test_cancelled_load_does_not_retry_or_keep_worker(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch,'load_hang');cancelled=threading.Event();timer=threading.Timer(.2,cancelled.set);timer.start()
 try:
  with pytest.raises(TalkCancelledError):load_with_retries('xlmr',lambda:NativeProcess(tmp_path,'xlmr',cancelled),lambda:None,cancelled=cancelled)
 finally:timer.cancel()
 assert len(children)==1 and children[0].poll() is not None


def test_permanent_import_failure_does_not_retry(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch,'import_error')
 with pytest.raises(Exception,match='NATIVE_PHQ_IMPORT_FAILED'):load_with_retries('phq8',lambda:NativeProcess(tmp_path,'phq8'),lambda:None,sleep=lambda _:pytest.fail('no retry'))
 assert len(children)==1 and children[0].poll() is not None


def test_inference_timeout_never_replays_generation(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch,'infer_hang');monkeypatch.setattr('app.model.native_process.INFERENCE_SECONDS',.2)
 worker=NativeProcess(tmp_path,'phq8')
 with pytest.raises(ComponentOperationError,match='INFERENCE_TIMEOUT'):worker.call('private input')
 assert len(children)==1 and children[0].poll() is not None


def test_cpu_safety_requires_explicit_cpu_acknowledgement(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch);worker=NativeProcess(tmp_path,'xlmr',cpu=True)
 try:assert worker.call('safe synthetic')=={'value':'safe synthetic'}
 finally:worker.close()
 assert children[0].poll() is not None


def test_inference_component_error_does_not_release_healthy_core_workers():
 from app.model.core import CoreRuntime
 r=CoreRuntime.__new__(CoreRuntime);r.loaded=True;r.slots=threading.BoundedSemaphore(1);r.lock=threading.RLock()
 r._load=lambda name:object();r.release=lambda:pytest.fail('must not kill other components or Buddy')
 def infer(value):raise ComponentOperationError('e4','INFERENCE_FAILED')
 with pytest.raises(ComponentOperationError):r.call('e4',infer)


def test_native_loading_respects_buddy_residency_without_eviction():
 from app.model.core import CoreRuntime
 r=CoreRuntime.__new__(CoreRuntime);r.buddy=SimpleNamespace(workers={'cbt':SimpleNamespace(process=SimpleNamespace(poll=lambda:None))})
 with pytest.raises(TalkBusyError):r._load_native_once('e4')


def test_loading_envelopes_include_attempts_teardown_backoff_and_inference():
 assert envelope('xlmr')==1317 and envelope('e4')==1317 and envelope('phq8')==3417


@pytest.mark.parametrize('mode',['load_crash','mismatch'])
def test_crash_and_malformed_reply_fail_closed(monkeypatch,tmp_path,mode):
 children=fixture_worker(monkeypatch,mode);worker=None
 try:
  if mode=='load_crash':
   with pytest.raises(ComponentLoadError,match='WORKER_UNAVAILABLE'):NativeProcess(tmp_path,'e4')
  else:
   worker=NativeProcess(tmp_path,'e4')
   with pytest.raises(ComponentOperationError,match='WORKER_UNAVAILABLE'):worker.call('synthetic')
  assert children[0].poll() is not None
 finally:
  if worker:worker.close()


def test_failure_of_one_component_preserves_another_healthy_process(monkeypatch,tmp_path):
 healthy_children=fixture_worker(monkeypatch);healthy=NativeProcess(tmp_path,'xlmr')
 try:
  failed=fixture_worker(monkeypatch,'load_hang');monkeypatch.setitem(__import__('app.model.native_process',fromlist=['LOAD_SECONDS']).LOAD_SECONDS,'e4',.2)
  with pytest.raises(ComponentLoadError):NativeProcess(tmp_path,'e4')
  assert failed[0].poll() is not None and healthy_children[0].poll() is None
  assert healthy.call('still available')=={'value':'still available'}
 finally:healthy.close()


def test_core_reloads_only_lost_component_and_unload_closes_residents(monkeypatch,tmp_path):
 from app.model.core import CoreRuntime
 children=fixture_worker(monkeypatch)
 monkeypatch.setitem(sys.modules,'torch',SimpleNamespace(cuda=SimpleNamespace(empty_cache=lambda:None)))
 monkeypatch.setattr('app.buddy.gpu_memory.global_memory',lambda torch:{'freeBytes':40*1024**3})
 r=CoreRuntime.__new__(CoreRuntime);r.root=tmp_path;r.loaded=True;r.resident={};r.active=None;r.instance=None;r.isolated_native=True;r.load_counts={};r.load_milliseconds={};r.native_progress=None;r.operation_cancelled=None;r.native_inference_seconds=270;r.buddy=SimpleNamespace(workers={});r.lock=threading.RLock();r.slots=threading.BoundedSemaphore(1)
 assert r.classify('first')=={'value':'first'};first=r.resident['xlmr'].process
 first.kill();first.wait(timeout=3)
 assert r.classify('second')=={'value':'second'}
 assert r.resident['xlmr'].process.pid!=first.pid and r.load_counts['xlmr']==2
 r.journal_runtime('unload',[])
 assert r.resident=={} and all(c.poll() is not None for c in children)


def test_buddy_safety_is_cpu_owned_and_reuses_current_operation_cancellation(monkeypatch,tmp_path):
 from app.buddy.runtime import BuddyRuntime
 made=[];calls=[]
 class Worker:
  def __init__(self,root,kind,cancelled,**options):
   assert root==tmp_path and kind=='xlmr' and options=={'cpu':True,'inference_seconds':600};self.ready=True;self.process=SimpleNamespace(poll=lambda:None);made.append(self)
  def call(self,text,language,cancelled):calls.append(cancelled);return {'suicidal_language_flag':False}
  def close(self):self.ready=False
 monkeypatch.setattr('app.model.native_process.NativeProcess',Worker)
 r=BuddyRuntime.__new__(BuddyRuntime);r.cpu_classifier=None;r.core=SimpleNamespace(root=tmp_path,instance=None,operation_cancelled=threading.Event())
 first=r._classifier();assert first.classify('synthetic')['suicidal_language_flag'] is False
 r.core.operation_cancelled=threading.Event();assert r._classifier() is first;first.classify('second')
 assert len(made)==1 and calls[0] is not calls[1]
 made[0].ready=False;assert r._classifier() is not first and len(made)==2
 r.cpu_classifier.close()


def test_inference_budget_remains_configurable_and_separate_from_load_budget(monkeypatch,tmp_path):
 children=fixture_worker(monkeypatch);worker=NativeProcess(tmp_path,'e4',inference_seconds=1)
 try:assert worker.inference_seconds==1
 finally:worker.close()
 with pytest.raises(ValueError):NativeProcess(tmp_path,'e4',inference_seconds=271)


def test_component_verification_skips_unrelated_assets_but_checks_owned_files(monkeypatch,tmp_path):
 import hashlib
 from app.model.core import CoreRuntime
 from app.core.exceptions import ModelUnavailableError
 monkeypatch.setattr('app.buddy.config.verify_policy',lambda:None)
 monkeypatch.setattr('app.buddy.runtime.BuddyRuntime',lambda core:SimpleNamespace())
 monkeypatch.setattr('app.buddy.config.enabled',lambda:False)
 cuda=SimpleNamespace(is_available=lambda:True,reset_peak_memory_stats=lambda:None,empty_cache=lambda:None)
 monkeypatch.setitem(sys.modules,'torch',SimpleNamespace(cuda=cuda))
 root=tmp_path;folder=root/'xlmr-v2';folder.mkdir();data=b'owned asset';(folder/'owned.bin').write_bytes(data)
 owned={'path':'xlmr-v2/owned.bin','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 unrelated={'path':'e4-c/missing.bin','bytes':1,'sha256':'a'*64}
 (root/'manifest.json').write_text(json.dumps({'files':[owned,unrelated],'inferenceCode':[]}))
 runtime=CoreRuntime(SimpleNamespace(models_root=root,queue_limit=1),text_only=True,component='xlmr')
 assert runtime.loaded
 (folder/'owned.bin').write_bytes(b'corrupted')
 with pytest.raises(ModelUnavailableError):CoreRuntime(SimpleNamespace(models_root=root,queue_limit=1),text_only=True,component='xlmr')


def test_phq_verifies_the_actual_cbt_base_inventory(monkeypatch,tmp_path):
 from app.model.core import CoreRuntime
 from app.core.exceptions import ModelUnavailableError
 monkeypatch.setattr('app.buddy.config.verify_policy',lambda:None)
 (tmp_path/'manifest.json').write_text(json.dumps({'files':[{'path':'cbt/base/missing.safetensors','bytes':1,'sha256':'a'*64}],'inferenceCode':[]}))
 with pytest.raises(ModelUnavailableError):CoreRuntime(SimpleNamespace(models_root=tmp_path,queue_limit=1),text_only=True,component='phq8')


def test_invalid_model_output_drops_only_failed_resident(monkeypatch,tmp_path):
 from app.model.core import CoreRuntime
 fixture_worker(monkeypatch);healthy=NativeProcess(tmp_path,'xlmr')
 fixture_worker(monkeypatch,'output_invalid');failed=NativeProcess(tmp_path,'phq8')
 r=CoreRuntime.__new__(CoreRuntime);r.loaded=True;r.resident={'xlmr':healthy,'phq8':failed};r.instance=failed;r.active='phq8';r.lock=threading.RLock();r.slots=threading.BoundedSemaphore(1);r._load=lambda name:failed;r.release=lambda:pytest.fail('must preserve healthy safety');r.native_progress=None
 try:
  with pytest.raises(ComponentOperationError,match='NATIVE_PHQ_OUTPUT_INVALID'):r.call('phq8',lambda worker:worker.call('synthetic'))
  assert r.resident=={'xlmr':healthy} and r.active is None and r.instance is None
  assert healthy.process.poll() is None and failed.process.poll() is not None
 finally:healthy.close();failed.close()


def test_runtime_metrics_report_driver_wide_free_memory(monkeypatch):
 from app.model.core import CoreRuntime
 cuda=SimpleNamespace(mem_get_info=lambda:pytest.fail('process-local estimate is not driver-wide'),max_memory_allocated=lambda:0)
 monkeypatch.setitem(sys.modules,'torch',SimpleNamespace(cuda=cuda))
 monkeypatch.setattr('app.buddy.gpu_memory.global_memory',lambda torch:{'freeBytes':123456789})
 r=CoreRuntime.__new__(CoreRuntime);r.loaded=True;r.resident={};r.instance=None;r.active=None;r.load_milliseconds={}
 assert r.metrics()['freeGpuBytes']==123456789
