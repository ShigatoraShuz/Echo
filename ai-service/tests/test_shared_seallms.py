"""Shared runtime isolation and selection gates; synthetic assets only."""
import contextlib
import hashlib
import json
import threading
from pathlib import Path
from types import SimpleNamespace as NS
import pytest
from app.buddy import shared_seallms as shared

class Transport:
 context=4096
 process=NS(poll=lambda:None,pid=123)
 offloaded=total_layers=29
 cuda_model_bytes=10
 def __init__(self):self.payloads=[];self.drained=0;self.closed=0
 def json(self,method,path,payload=None,timeout=60):self.payloads.append(payload);return payload
 def stream(self,payload):self.payloads.append(payload);yield {'tokens':[1]}
 def idle(self):self.drained+=1
 def close(self):self.closed+=1
 def require_gpu_residency(self,*args):pass

def owner():
 value=NS(server=Transport(),ids={'cbt':0,'phq':1},identity={},lock=threading.RLock(),generation_config={'repetition_penalty':1.05})
 value.view=lambda mode:shared.AdapterView(value,mode)
 return value

@pytest.mark.parametrize('mode,scales',[('cbt',[1,0]),('phq',[0,1]),('base',[0,0])])
def test_explicit_both_adapter_scales_and_no_prompt_reuse(mode,scales):
 model=owner();view=model.view(mode)
 view.json('POST','/completion',{'lora':[{'id':99,'scale':9}],'cache_prompt':True})
 list(view.stream({'cache_prompt':True}))
 for packet in model.server.payloads:
  assert packet['lora']==[{'id':i,'scale':scale} for i,scale in enumerate(scales)]
  assert packet['cache_prompt'] is False
 assert model.server.drained==1
 view.close();assert model.server.closed==0
 assert view.process.pid==123

def test_global_adapter_mutation_is_refused():
 with pytest.raises(Exception,match='TRANSPORT_INVALID'):owner().view('phq').json('POST','/lora-adapters',{})

def test_cancelled_stream_is_closed_and_drained():
 model=owner();stream=model.view('cbt').stream({});next(stream);stream.close()
 assert model.server.drained==1

def test_phq_adapter_is_restored_after_failed_check_and_policy_preserved(monkeypatch):
 import torch
 from app.buddy.llama_backend import GenerateBridge
 model=owner();bridge=shared.PHQBridge(model.view('phq'));calls=[]
 def generate(self,**kwargs):
  calls.append((self.server.mode,kwargs));return NS(sequences=kwargs['input_ids'])
 monkeypatch.setattr(GenerateBridge,'generate',generate)
 with pytest.raises(RuntimeError):
  with bridge.disable_adapter():
   bridge.generate(input_ids=torch.tensor([[1]]),max_new_tokens=300,eos_token_id=[2])
   raise RuntimeError('check fault')
 bridge.generate(input_ids=torch.tensor([[1]]),max_new_tokens=300,eos_token_id=[2])
 assert [mode for mode,_ in calls]==['base','phq']
 assert all(k['temperature']==0 and k['repetition_penalty']==1.05 and k['max_new_tokens']==300 for _,k in calls)
 with pytest.raises(ValueError):bridge.generate(input_ids=torch.tensor([[1]]),max_new_tokens=301,eos_token_id=[2])

def test_base_lifetime_keeps_other_owner_and_failed_drain_invalidates_clients():
 core=NS(resident={},buddy=NS(workers={},ready=True),active=None)
 runtime=shared.SharedRuntime(core);model=owner();model.close=model.server.close;runtime.model=model
 client=NS(process=NS(poll=lambda:None),close=lambda:None)
 core.buddy.workers['cbt']=client;runtime.maybe_release();assert runtime.model is model
 core.buddy.workers.clear();client.ready=True;core.resident['phq8']=client
 runtime.maybe_release();assert runtime.model is model
 model.server.idle=lambda:(_ for _ in ()).throw(RuntimeError('drain'))
 runtime.quiesce();assert runtime.model is None and not core.resident and not core.buddy.ready
 assert model.server.closed==1

def test_cancel_before_preparation_does_not_load():
 runtime=shared.SharedRuntime(NS());cancelled=threading.Event();cancelled.set()
 with pytest.raises(Exception,match='Cancelled'):runtime.capability(cancelled)
 assert runtime.model is None

def test_selection_requires_every_acceptance_check_and_current_code(tmp_path,monkeypatch):
 monkeypatch.delenv('ECHO_SHARED_SEALLMS_VALIDATE',raising=False)
 assert shared.selected(tmp_path) is False
 root=tmp_path/'llama';root.mkdir()
 lock=json.loads(Path(shared.__file__).with_name('shared-seallms.lock.json').read_text())
 report={'passed':True,'manifestSHA256':lock['manifestSHA256'],'implementationSHA256':shared.implementation_identity(),
         'checks':dict.fromkeys(shared.REQUIRED_CHECKS,True)}
 def save():
  path=root/'shared-validation.json';path.write_text(json.dumps(report))
  (root/'selected-runtime.json').write_text(json.dumps({'profile':'shared-seallms','manifestSHA256':lock['manifestSHA256'],'validationSHA256':shared.digest(path)}))
 save();assert shared.selected(tmp_path)
 report['checks']['phq_nullable_agreement']=False;save()
 with pytest.raises(Exception,match='SHARED_VALIDATION_REQUIRED'):shared.selected(tmp_path)
 report['checks']['phq_nullable_agreement']=True;report['implementationSHA256']='old';save()
 with pytest.raises(Exception,match='SHARED_VALIDATION_REQUIRED'):shared.selected(tmp_path)

def test_shared_phq_has_stage_boundaries_and_checks_ownership_each_time():
 from app.model.text_transport import TextRuntime
 from app.model.screening import ITEMS
 runtime=TextRuntime.__new__(TextRuntime);runtime.shared_enabled=True;runtime.buddy_enabled=True;calls=[]
 phase={'items':dict.fromkeys(ITEMS),'inputTokens':20,'retainedTokens':20,'provenance':{'inferenceVersion':'fixed'}}
 def call(op,*args,**kwargs):
  calls.append((op,args,kwargs))
  if op=='screening_phase':return phase
  return {} if op=='emotions' else 'complete'
 runtime._call=call
 assert runtime.analyze('synthetic',classification={'safe':True},owner='owner')=='complete'
 assert [op for op,_,_ in calls]==['emotions','screening_phase','screening_phase','analyze']
 assert [args[1] for op,args,_ in calls if op=='screening_phase']==[False,True]
 assert all(kwargs['journal_owner']=='owner' for _,_,kwargs in calls)
 result=calls[-1][1][-1];assert result['coverage']==0 and result['total'] is None

def test_bad_shared_assets_are_not_selected_by_fallback(tmp_path):
 with pytest.raises(FileNotFoundError):shared.verify_bundle(tmp_path)
 assert not list(tmp_path.iterdir())


def artifact_fixture(tmp_path,monkeypatch):
 module=tmp_path/'app/buddy/shared_seallms.py';module.parent.mkdir(parents=True);module.write_text('fixture')
 monkeypatch.setattr(shared,'__file__',str(module))
 root=tmp_path/'models';directory=root/'llama/artifacts/seallms-shared-q4km';directory.mkdir(parents=True)
 def write(path,content):
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)
  return {'path':path.name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()}
 files=[write(directory/name,name.encode()) for name in ('base-q4_k_m.gguf','cbt-lora-f32.gguf','phq-lora-f32.gguf')]
 token=write(root/'phq8-seallms/adapter/tokenizer.json',b'tokenizer');token['path']='phq8-seallms/adapter/tokenizer.json'
 source={'files':[token]};source['identity']=hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest()
 manifest={'unmergedBase':True,'llamaCommit':'pinned','sourceIdentity':source,'files':files}
 (directory/'manifest.json').write_text(json.dumps(manifest))
 runtime=root/'llama/runtime/b12110';exe=write(runtime/'bin/llama-server.exe',b'binary');exe['path']='bin/llama-server.exe'
 installed={'commit':'pinned','files':[exe]};(runtime/'manifest.json').write_text(json.dumps(installed))
 lock={'manifestSHA256':shared.digest(directory/'manifest.json'),'llamaCommit':'pinned',
       'runtimeInventorySHA256':hashlib.sha256(json.dumps(installed,sort_keys=True).encode()).hexdigest()}
 module.with_name('shared-seallms.lock.json').write_text(json.dumps(lock))
 return root,directory,runtime


@pytest.mark.parametrize('damage',['base','adapter','tokenizer','runtime','manifest'])
def test_corrupt_committed_assets_fail_closed(tmp_path,monkeypatch,damage):
 root,directory,runtime=artifact_fixture(tmp_path,monkeypatch)
 shared.verify_bundle(root)
 target={'base':directory/'base-q4_k_m.gguf','adapter':directory/'phq-lora-f32.gguf',
         'tokenizer':root/'phq8-seallms/adapter/tokenizer.json',
         'runtime':runtime/'bin/llama-server.exe','manifest':directory/'manifest.json'}[damage]
 target.write_bytes(b'corrupt')
 with pytest.raises(Exception,match='INTEGRITY_FAILED'):shared.verify_bundle(root)
 assert target.read_bytes()==b'corrupt'


def test_no_manifest_never_promotes_partial_staging(tmp_path,monkeypatch):
 root,directory,_=artifact_fixture(tmp_path,monkeypatch)
 (directory/'manifest.json').unlink()
 with pytest.raises(FileNotFoundError):shared.verify_bundle(root)
 assert (directory/'base-q4_k_m.gguf').is_file()


def test_failed_neutral_pass_never_publishes_adapted_values():
 from app.model.text_transport import TextRuntime
 from app.core.exceptions import ModelUnavailableError
 from app.model.screening import ITEMS
 runtime=TextRuntime.__new__(TextRuntime);runtime.shared_enabled=True;runtime.buddy_enabled=True
 def call(op,*args,**kwargs):
  if op=='screening_phase':
   if args[1]:raise ModelUnavailableError('NATIVE_PHQ_OUTPUT_INVALID')
   return {'items':dict.fromkeys(ITEMS,3),'inputTokens':20,'retainedTokens':20,'provenance':{}}
  if op=='analyze':return args[-1]
  return {}
 runtime._call=call
 result=runtime.analyze('synthetic',classification={'safe':True},owner='owner')
 assert result['status']=='failed' and result['items'] is None and result['total'] is None



def test_failed_activation_preserves_current_selection(tmp_path):
 import importlib.util
 spec=importlib.util.spec_from_file_location('select_shared',Path(__file__).parents[2]/'scripts/select-shared-seallms.py')
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 root=tmp_path/'models';module.select(root,'current')
 selection=root/'llama/selected-runtime.json';before=selection.read_bytes()
 report=tmp_path/'report.json';report.write_text(json.dumps({'passed':False,'checks':{}}))
 with pytest.raises(ValueError,match='SHARED_VALIDATION_REQUIRED'):module.select(root,'shared-seallms',report)
 assert selection.read_bytes()==before
 assert not (root/'llama/shared-validation.json').exists()
 assert not list(root.rglob('*.tmp'))


@pytest.mark.parametrize('content',['{','[]','{"profile":"unknown"}'])
def test_invalid_selection_is_a_sanitized_error(tmp_path,monkeypatch,content):
 monkeypatch.delenv('ECHO_SHARED_SEALLMS_VALIDATE',raising=False)
 folder=tmp_path/'llama';folder.mkdir();(folder/'selected-runtime.json').write_text(content)
 with pytest.raises(Exception,match='SHARED_SELECTION_INVALID'):shared.selected(tmp_path)
