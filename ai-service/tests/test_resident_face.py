import base64,json,subprocess,sys
from types import SimpleNamespace
import pytest
from app.model.face_transport import ResidentFaceRuntime
from app.core.exceptions import ModelUnavailableError

def test_real_resident_protocol_reuses_pid_and_excludes_credentials(monkeypatch,tmp_path):
 runtime=ResidentFaceRuntime(tmp_path);children=[];pins={'selected_model.joblib':'a'*64}
 monkeypatch.setattr('app.face_eval_memory.approved_pins',lambda:pins)
 monkeypatch.setenv('AI_SERVICE_TOKEN','private-sentinel')
 def spawn(args,**kwargs):
  assert 'private-sentinel' not in str(args) and 'AI_SERVICE_TOKEN' not in kwargs['env'];assert kwargs['env']['CUDA_VISIBLE_DEVICES']=='-1'
  code="import sys,json,base64\nprint(json.dumps({'ready':True,'modelFingerprint':'a'*64}),flush=True)\nfor line in sys.stdin:\n p=json.loads(line); assert base64.b64decode(p['audioImage'])==b'synthetic-image'; print(json.dumps({'id':p['id'],'result':{'schemaVersion':'echo-face-expression-v1','status':'unavailable','reason':'no_usable_face','modelFingerprint':'a'*64}}),flush=True)\n"
  child=subprocess.Popen([sys.executable,'-I','-B','-u','-c',code],**kwargs);children.append(child);return child
 monkeypatch.setattr('app.model.face_transport.spawn_owned',spawn)
 try:
  runtime.prepare();pid=runtime.process.pid
  for _ in range(2):assert runtime.predict(base64.b64encode(b'synthetic-image').decode())['reason']=='no_usable_face'
  assert len(children)==1 and runtime.process.pid==pid
  runtime.unload();assert children[0].poll() is not None
  runtime.prepare();assert len(children)==2 and runtime.process.pid!=pid
 finally:runtime.close()
 assert all(child.poll() is not None for child in children)

@pytest.mark.parametrize('code',['FACE_PACKAGE_UNAVAILABLE','FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED'])
def test_permanent_prepare_failure_does_not_retry(monkeypatch,tmp_path,code):
 runtime=ResidentFaceRuntime(tmp_path);calls=[]
 def fail(*args):calls.append(True);raise ModelUnavailableError(code)
 monkeypatch.setattr(runtime,'_start',fail)
 with pytest.raises(ModelUnavailableError,match=code):runtime.prepare()
 assert calls==[True] and runtime.status['state']=='failed'

def test_unload_during_loading_does_not_restart_or_activate_worker(monkeypatch,tmp_path):
 runtime=ResidentFaceRuntime(tmp_path);calls=[]
 def loading(*args):calls.append(True);runtime.unload();raise ModelUnavailableError('FACE_WORKER_UNAVAILABLE')
 monkeypatch.setattr(runtime,'_start',loading)
 with pytest.raises(ModelUnavailableError):runtime.prepare()
 assert calls==[True] and runtime.process is None

def test_journal_preparation_only_loads_face_when_consent_owners_are_present():
 from app.model.text_transport import TextRuntime
 r=TextRuntime.__new__(TextRuntime);calls=[];r._call=lambda *args:calls.append(args) or {'ready':True}
 r.face_runtime=SimpleNamespace(prepare=lambda:calls.append('face_prepare'),unload=lambda:calls.append('face_unload'))
 r.journal_runtime('prepare',['owner'],['owner']);assert calls[-1]=='face_prepare'
 calls.clear();r.journal_runtime('prepare',['owner'],[]);assert 'face_prepare' not in calls and 'face_unload' in calls
 calls.clear();r.journal_runtime('owners',[],[]);assert 'face_unload' not in calls
 calls.clear();r.journal_runtime('unload',[],[]);assert 'face_unload' in calls
