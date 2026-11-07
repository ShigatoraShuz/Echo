"""Owned-process fault tests; no model loading or camera captures."""
import base64,hashlib,json,subprocess,sys,threading,time
from pathlib import Path
import pytest
from app.model.face_transport import ResidentFaceRuntime
from app.buddy.job import spawn_owned
from app.core.exceptions import ModelUnavailableError


def setup_worker(monkeypatch,tmp_path,body):
 runtime=ResidentFaceRuntime(tmp_path);children=[]
 monkeypatch.setattr('app.face_eval_memory.approved_pins',lambda:{'selected_model.joblib':'a'*64})
 def spawn(args,**kwargs):
  assert '--resident' in args and 'AI_SERVICE_TOKEN' not in kwargs['env']
  child=spawn_owned([sys.executable,'-I','-B','-u','-c',body],**kwargs);children.append(child);return child
 monkeypatch.setattr('app.model.face_transport.spawn_owned',spawn)
 return runtime,children


def launch(fn,errors):
 def run():
  try:fn()
  except Exception as e:errors.append(str(e))
 t=threading.Thread(target=run);t.start();return t


def until(predicate):
 deadline=time.monotonic()+5
 while not predicate():
  assert time.monotonic()<deadline,'worker did not reach expected state'
  time.sleep(.01)


def test_hung_load_is_killed_before_each_of_five_retries(monkeypatch,tmp_path):
 runtime,children=setup_worker(monkeypatch,tmp_path,'import time;time.sleep(60)')
 monkeypatch.setattr('app.model.face_transport.FACE_LOAD_SECONDS',.3)
 monkeypatch.setattr('app.model.face_transport.FACE_RETRY_DELAYS',(0,0,0,0))
 started=time.monotonic()
 try:
  with pytest.raises(ModelUnavailableError,match='FACE_LOAD_TIMEOUT'):runtime.prepare()
  assert len(children)==5 and all(p.poll() is not None for p in children)
  assert time.monotonic()-started<5
  assert runtime.status['state']=='failed' and runtime.status['attempt']==5
 finally:runtime.close()


def test_unload_cancels_loader_and_queued_owner_without_retry(monkeypatch,tmp_path):
 runtime,children=setup_worker(monkeypatch,tmp_path,'import time;time.sleep(60)')
 errors=[];first=launch(runtime.prepare,errors)
 until(lambda:runtime.process is not None)
 second=launch(runtime.prepare,errors);time.sleep(.05)
 started=time.monotonic();runtime.unload()
 first.join(2);second.join(2)
 try:
  assert not first.is_alive() and not second.is_alive()
  assert errors==['FACE_STOPPED','FACE_STOPPED']
  assert len(children)==1 and children[0].poll() is not None
  assert time.monotonic()-started<2
  assert runtime.process is None and runtime.status=={'state':'unloaded'}
 finally:runtime.close()


def test_cancellation_during_spawn_rejects_late_worker(monkeypatch,tmp_path):
 runtime,children=setup_worker(monkeypatch,tmp_path,'import time;time.sleep(60)')
 original=__import__('app.model.face_transport',fromlist=['spawn_owned']).spawn_owned
 def late(*a,**kw):
  runtime.unload();return original(*a,**kw)
 monkeypatch.setattr('app.model.face_transport.spawn_owned',late)
 with pytest.raises(ModelUnavailableError,match='FACE_STOPPED'):runtime.prepare()
 assert len(children)==1 and children[0].poll() is not None
 assert runtime.status=={'state':'unloaded'}


def test_late_ready_cannot_overwrite_unloaded(monkeypatch,tmp_path):
 runtime=ResidentFaceRuntime(tmp_path)
 def late(*args):runtime.unload()
 monkeypatch.setattr(runtime,'_start',late)
 with pytest.raises(ModelUnavailableError,match='FACE_STOPPED'):runtime.prepare()
 assert runtime.status=={'state':'unloaded'} and runtime.process is None


def test_inference_timeout_discards_worker_without_replaying_capture(monkeypatch,tmp_path):
 body="import json,time,sys;print(json.dumps({'ready':True,'modelFingerprint':'a'*64}),flush=True);sys.stdin.readline();time.sleep(60)"
 runtime,children=setup_worker(monkeypatch,tmp_path,body)
 monkeypatch.setattr('app.model.face_transport.FACE_INFERENCE_SECONDS',.2)
 try:
  with pytest.raises(ModelUnavailableError,match='FACE_INFERENCE_TIMEOUT'):runtime.predict(base64.b64encode(b'synthetic').decode())
  assert len(children)==1 and children[0].poll() is not None
  assert runtime.status=={'state':'failed','code':'FACE_INFERENCE_TIMEOUT'}
 finally:runtime.close()


def test_reload_after_cancel_uses_fresh_generation(monkeypatch,tmp_path):
 runtime,children=setup_worker(monkeypatch,tmp_path,"import sys,json;print(json.dumps({'ready':True,'modelFingerprint':'a'*64}),flush=True);sys.stdin.read()")
 try:
  runtime.prepare();first=runtime.process.pid;runtime.unload()
  assert children[0].poll() is not None
  runtime.prepare();assert runtime.process.pid!=first and runtime.status['state']=='ready'
 finally:runtime.close()
 assert all(p.poll() is not None for p in children)


def test_child_inventory_is_pinned_before_model_deserialization(monkeypatch,tmp_path):
 from app.face_eval_memory import verify_package
 (tmp_path/'package_checksums.json').write_text('{}')
 monkeypatch.setattr('app.face_eval_memory.approved_pins',lambda:{'selected_model.joblib':'a'*64})
 with pytest.raises(ValueError,match='inventory'):verify_package(tmp_path)
 data=b'synthetic model';pin=hashlib.sha256(data).hexdigest()
 monkeypatch.setattr('app.face_eval_memory.approved_pins',lambda:{'selected_model.joblib':pin})
 (tmp_path/'package_checksums.json').write_text(json.dumps({'selected_model.joblib':pin}))
 (tmp_path/'selected_model.joblib').write_bytes(b'corrupt')
 with pytest.raises(ValueError,match='integrity'):verify_package(tmp_path)
 (tmp_path/'selected_model.joblib').write_bytes(data)
 assert verify_package(tmp_path)=={'selected_model.joblib':pin}


def test_unknown_loader_error_is_sanitized_without_retry(monkeypatch,tmp_path):
 runtime=ResidentFaceRuntime(tmp_path);calls=[]
 def fail(*args):calls.append(True);raise RuntimeError('private path or capture')
 monkeypatch.setattr(runtime,'_start',fail)
 with pytest.raises(ModelUnavailableError,match='FACE_LOAD_FAILED'):runtime.prepare()
 assert len(calls)==1 and runtime.status['code']=='FACE_LOAD_FAILED'


def test_concurrent_preparation_joins_one_worker(monkeypatch,tmp_path):
 body="import time,sys,json;time.sleep(.1);print(json.dumps({'ready':True,'modelFingerprint':'a'*64}),flush=True);sys.stdin.read()"
 runtime,children=setup_worker(monkeypatch,tmp_path,body);errors=[]
 first=launch(runtime.prepare,errors);second=launch(runtime.prepare,errors)
 try:
  first.join(3);second.join(3)
  assert not first.is_alive() and not second.is_alive() and not errors
  assert len(children)==1 and runtime.status['state']=='ready'
 finally:runtime.close()


def test_unload_during_prediction_cannot_deliver_old_capture(monkeypatch,tmp_path):
 body="import json,time,sys;print(json.dumps({'ready':True,'modelFingerprint':'a'*64}),flush=True);sys.stdin.readline();time.sleep(60)"
 runtime,children=setup_worker(monkeypatch,tmp_path,body);runtime.prepare();errors=[]
 thread=launch(lambda:runtime.predict(base64.b64encode(b'synthetic').decode()),errors)
 until(runtime.lock.locked);runtime.unload();thread.join(2)
 assert not thread.is_alive() and errors==['FACE_STOPPED']
 assert len(children)==1 and children[0].poll() is not None
 assert runtime.status=={'state':'unloaded'}


def test_unload_interrupts_retry_backoff(monkeypatch,tmp_path):
 runtime=ResidentFaceRuntime(tmp_path);calls=[];errors=[]
 def fail(*args):calls.append(True);raise ModelUnavailableError('FACE_WORKER_UNAVAILABLE')
 monkeypatch.setattr(runtime,'_start',fail)
 monkeypatch.setattr('app.model.face_transport.FACE_RETRY_DELAYS',(20,20,20,20))
 thread=launch(runtime.prepare,errors);until(lambda:runtime.status.get('state')=='retrying')
 runtime.unload();thread.join(2)
 assert not thread.is_alive() and errors==['FACE_STOPPED'] and len(calls)==1
 assert runtime.status=={'state':'unloaded'}


def test_wrong_ready_fingerprint_fails_permanently(monkeypatch,tmp_path):
 body="import json,sys;print(json.dumps({'ready':True,'modelFingerprint':'b'*64}),flush=True);sys.stdin.read()"
 runtime,children=setup_worker(monkeypatch,tmp_path,body)
 with pytest.raises(ModelUnavailableError,match='FACE_PACKAGE_UNAVAILABLE'):runtime.prepare()
 assert len(children)==1 and children[0].poll() is not None
 assert runtime.status['state']=='failed'


def test_transient_os_failure_uses_five_attempts(monkeypatch,tmp_path):
 import errno
 runtime=ResidentFaceRuntime(tmp_path);calls=[]
 def fail(*args):calls.append(True);raise OSError(errno.EAGAIN,'temporary private message')
 monkeypatch.setattr(runtime,'_start',fail)
 monkeypatch.setattr('app.model.face_transport.FACE_RETRY_DELAYS',(0,0,0,0))
 with pytest.raises(ModelUnavailableError,match='FACE_LOAD_FAILED'):runtime.prepare()
 assert len(calls)==5 and runtime.status['attempt']==5


def test_journal_disconnect_reaches_owned_face_loader(monkeypatch,tmp_path):
 import asyncio
 from types import SimpleNamespace
 from fastapi import HTTPException
 from app.api.routes.core import journal_runtime,JournalRuntimeInput
 runtime,children=setup_worker(monkeypatch,tmp_path,'import time;time.sleep(60)')
 def prepare(action,owners,faceOwners,**kwargs):return runtime.prepare(cancelled=kwargs['cancelled'])
 fake=SimpleNamespace(analyze=lambda:None,journal_runtime=prepare)
 async def disconnected():return runtime.process is not None
 request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(model_runtime=fake)),is_disconnected=disconnected)
 try:
  with pytest.raises(HTTPException) as caught:
   asyncio.run(journal_runtime(JournalRuntimeInput(action='prepare',owners=['a'*64],faceOwners=['a'*64]),request))
  assert caught.value.status_code==503 and caught.value.detail=={'code':'FACE_STOPPED'}
  assert len(children)==1 and children[0].poll() is not None
  assert runtime.status=={'state':'unloaded'}
 finally:runtime.close()


def test_old_journal_stage_cannot_start_face_after_unload(tmp_path):
 from app.model.text_transport import TextRuntime
 runtime=TextRuntime.__new__(TextRuntime);runtime.face_runtime=ResidentFaceRuntime(tmp_path)
 def stage(*args,**kwargs):runtime.face_runtime.unload();return {'ready':True}
 runtime._call=stage
 with pytest.raises(ModelUnavailableError,match='FACE_STOPPED'):runtime.journal_runtime('prepare',['a'],['a'])
 assert runtime.face_runtime.process is None and runtime.face_runtime.status=={'state':'unloaded'}


def test_cancelled_journal_stage_does_not_start_face(monkeypatch,tmp_path):
 from app.model.text_transport import TextRuntime
 from app.core.exceptions import TalkCancelledError
 runtime=TextRuntime.__new__(TextRuntime);runtime.face_runtime=ResidentFaceRuntime(tmp_path);cancelled=threading.Event()
 monkeypatch.setattr(runtime.face_runtime,'prepare',lambda **kwargs:pytest.fail('Cancelled journal must not start face'))
 def stage(*args,**kwargs):assert kwargs['cancelled'] is cancelled;cancelled.set();return {'ready':True}
 runtime._call=stage
 with pytest.raises(TalkCancelledError):runtime.journal_runtime('prepare',['a'],['a'],cancelled=cancelled)
