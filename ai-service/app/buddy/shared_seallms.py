"""Verified neutral SeaLLMs base with explicit request-local LoRA selection."""
import contextlib,hashlib,json,threading
from pathlib import Path
from types import SimpleNamespace
from app.buddy.llama_backend import Server,fail
from app.buddy.config import digest

MODES={'cbt':(1.0,0.0),'phq':(0.0,1.0),'base':(0.0,0.0)}

REQUIRED_CHECKS = ('adapter_isolation', 'phq_nullable_agreement', 'cbt_approval',
                   'single_base_workers', 'nano_whisper_residency', 'two_gib_headroom',
                   'cancellation_recovery', 'max_context')


def implementation_identity():
 files = [Path(__file__), Path(__file__).with_name('llama_backend.py'),
          Path(__file__).with_name('runtime.py'), Path(__file__).with_name('worker.py'),
          Path(__file__).with_name('v3-source.lock.json')]
 files += [Path(__file__).parents[1]/'model'/name for name in
           ('screening.py','core.py','native_worker.py','native_process.py','text_transport.py')]
 return hashlib.sha256(json.dumps({str(p.relative_to(Path(__file__).parents[1])):digest(p) for p in files},sort_keys=True).encode()).hexdigest()


def validation_passed(report, manifest):
 return (report.get('passed') is True and report.get('manifestSHA256') == manifest
         and report.get('implementationSHA256') == implementation_identity()
         and all(report.get('checks', {}).get(name) is True for name in REQUIRED_CHECKS))

def verify_bundle(root):
 root=Path(root).resolve();directory=root/'llama/artifacts/seallms-shared-q4km'
 lock=json.loads(Path(__file__).with_name('shared-seallms.lock.json').read_text(encoding='utf-8'))
 manifest=directory/'manifest.json'
 if digest(manifest)!=lock['manifestSHA256']:raise fail('SHARED_MANIFEST_INTEGRITY_FAILED')
 data=json.loads(manifest.read_text(encoding='utf-8'))
 if not data.get('unmergedBase') or data['llamaCommit']!=lock['llamaCommit']:raise fail('SHARED_BASE_IDENTITY_FAILED')
 files={entry['path']:entry for entry in data['files']}
 for name in ('base-q4_k_m.gguf','cbt-lora-f32.gguf','phq-lora-f32.gguf'):
  entry=files[name];path=directory/name
  if path.stat().st_size!=entry['bytes'] or digest(path)!=entry['sha256']:raise fail('SHARED_ASSET_INTEGRITY_FAILED')
 source=data['sourceIdentity']
 body={k:v for k,v in source.items() if k!='identity'}
 if hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()!=source['identity']:raise fail('SHARED_SOURCE_IDENTITY_FAILED')
 # Preserve exact tokenizer/template identity used by each policy.
 for entry in source['files']:
  if (entry['path'].startswith(('buddy/adapter/','phq8-seallms/adapter/')) and not entry['path'].endswith('.safetensors')) or entry['path']=='cbt/base/generation_config.json':
   path=(root/entry['path']).resolve()
   if not path.is_relative_to(root) or path.stat().st_size!=entry['bytes'] or digest(path)!=entry['sha256']:raise fail('SHARED_TOKENIZER_INTEGRITY_FAILED')
 runtime=root/'llama/runtime/b12110';installed=json.loads((runtime/'manifest.json').read_text(encoding='utf-8'))
 canonical={**installed,'files':sorted(installed['files'],key=lambda x:x['path'])}
 if installed['commit']!=lock['llamaCommit'] or hashlib.sha256(json.dumps(canonical,sort_keys=True).encode()).hexdigest()!=lock['runtimeInventorySHA256']:raise fail('SHARED_RUNTIME_IDENTITY_FAILED')
 for entry in installed['files']:
  path=(runtime/entry['path']).resolve()
  if not path.is_relative_to(runtime.resolve()) or path.stat().st_size!=entry['bytes'] or digest(path)!=entry['sha256']:raise fail('SHARED_RUNTIME_INTEGRITY_FAILED')
 return directory,runtime/'bin/llama-server.exe',{'model':files['base-q4_k_m.gguf'],'llamaCommit':lock['llamaCommit'],'manifestSHA256':lock['manifestSHA256'],'adapters':{key:files[key+'-lora-f32.gguf']['sha256'] for key in ('cbt','phq')}}

class SharedModel:
 def __init__(self,root,cancelled=None):
  from app.buddy.gpu_memory import require_headroom
  import torch
  directory,executable,self.identity=verify_bundle(root)
  require_headroom(torch,additional_bytes=self.identity['model']['bytes']+1024**3)
  if cancelled and cancelled.is_set():
   from app.core.exceptions import TalkCancelledError
   raise TalkCancelledError('Cancelled')
  self.server=Server(directory/'base-q4_k_m.gguf',executable,adapters=[directory/'cbt-lora-f32.gguf',directory/'phq-lora-f32.gguf'],cancelled=cancelled)
  self.generation_config=json.loads((Path(root)/'cbt/base/generation_config.json').read_text(encoding='utf-8'))
  self.lock=threading.RLock()
  try:
   loaded=self.server.json('GET','/lora-adapters')
   self.ids={}
   for label in ('cbt','phq'):
    matches=[x for x in loaded if Path(x['path']).name==label+'-lora-f32.gguf']
    if len(matches)!=1 or matches[0]['scale']!=0:raise fail('SHARED_ADAPTER_IDENTITY_FAILED')
    self.ids[label]=matches[0]['id']
   if len(set(self.ids.values()))!=2:raise fail('SHARED_ADAPTER_IDENTITY_FAILED')
   metadata=self.server.json('GET','/v1/models')['data'][0]['meta']
   self.server.require_gpu_residency(metadata['size']);require_headroom(torch)
   buffers=getattr(self.server,'lora_cuda_buffers',[])
   required=sum((directory/(key+'-lora-f32.gguf')).stat().st_size for key in ('cbt','phq'))
   if len(buffers)<2 or sum(buffers)<required-2*1024**2 or getattr(self.server,'lora_cpu_buffer',False):raise fail('SHARED_ADAPTER_GPU_RESIDENCY_FAILED')
  except BaseException:self.server.close();raise
 def view(self,mode):return AdapterView(self,mode)
 def close(self):self.server.close()

class AdapterView:
 def __init__(self,owner,mode):
  if mode not in MODES:raise ValueError('Invalid adapter mode')
  self.owner=owner;self.mode=mode;self.context=owner.server.context;self.identity=owner.identity
  for name in ('process','offloaded','total_layers','cuda_model_bytes'):
   setattr(self,name,getattr(owner.server,name))
 def adapter_scales(self):return [{'id':self.owner.ids[k],'scale':v} for k,v in zip(('cbt','phq'),MODES[self.mode])]
 def json(self,method,path,payload=None,timeout=60):
  if path=='/lora-adapters' and method!='GET':raise fail('TRANSPORT_INVALID')
  if path=='/completion':payload={**payload,'lora':self.adapter_scales(),'cache_prompt':False}
  with self.owner.lock:return self.owner.server.json(method,path,payload,timeout)
 def stream(self,payload):
  with self.owner.lock:
   stream=self.owner.server.stream({**payload,'lora':self.adapter_scales(),'cache_prompt':False})
   try:yield from stream
   finally:
    stream.close()
    self.owner.server.idle()
 def idle(self):return self.owner.server.idle()
 def require_gpu_residency(self,*args):return self.owner.server.require_gpu_residency(*args)
 def _watch(self):pass
 def close(self):pass

class PHQBridge:
 def __init__(self,view):
  import torch
  import contextvars
  self.device=torch.device('cpu');self.view=view;self.mode=contextvars.ContextVar('phq_adapter_mode',default='phq')
 @contextlib.contextmanager
 def disable_adapter(self):
  token=self.mode.set('base')
  try:yield
  finally:self.mode.reset(token)
 def set_adapter(self,name,**kwargs):
  if name!='phq8':raise ValueError('Invalid PHQ adapter')
  return self
 def eval(self):return self
 def generate(self,*,input_ids,max_new_tokens,eos_token_id,do_sample=False,**kwargs):
  import torch
  if do_sample or max_new_tokens!=300 or input_ids.shape[0]!=1:raise ValueError('PHQ generation policy differs')
  from app.buddy.llama_backend import GenerateBridge
  view=self.view.owner.view(self.mode.get())
  policy=self.view.owner.generation_config
  generated=GenerateBridge(view,torch).generate(input_ids=input_ids,attention_mask=kwargs.get('attention_mask'),max_new_tokens=max_new_tokens,
      stopping_criteria=lambda sequence,scores:False,temperature=0,top_p=1,top_k=0,
      repetition_penalty=policy.get('repetition_penalty',1.0),eos_token_id=eos_token_id)
  return generated.sequences


class RemoteTransport(Server):
 def __init__(self,info):
  lock=json.loads(Path(__file__).with_name('shared-seallms.lock.json').read_text(encoding='utf-8'))
  if info['identity']['manifestSHA256']!=lock['manifestSHA256'] or info['identity']['model']!=lock['model']:raise fail('SHARED_CAPABILITY_IDENTITY_FAILED')
  if type(info['port']) is not int or not 1024<=info['port']<=65535 or not isinstance(info['token'],str) or len(info['token'])<32:raise fail('SHARED_CAPABILITY_INVALID')
  if set(info['ids'])!={'cbt','phq'} or len(set(info['ids'].values()))!=2 or any(type(x) is not int or x<0 for x in info['ids'].values()):raise fail('SHARED_CAPABILITY_INVALID')
  self.port=info['port'];self.token=info['token'];self.context=4096;self.closed=False;self.process=SimpleNamespace(poll=lambda:None)
  if info['context']!=4096 or info['identity'].get('adapters')!={key:lock['adapters'][key]['sha256'] for key in ('cbt','phq')}:raise fail('SHARED_CAPABILITY_IDENTITY_FAILED')
  self.process=SimpleNamespace(poll=lambda:None,pid=info['pid'])
  self.offloaded=info['gpu']['offloaded'];self.total_layers=29;self.cuda_model_bytes=info['gpu']['modelBytes']
 def close(self):pass

def remote_model(info):
 return SimpleNamespace(server=RemoteTransport(info),identity=info['identity'],ids=info['ids'],generation_config=info['generationConfig'],lock=threading.RLock(),view=lambda mode:None)

def remote_view(info,mode):
 owner=remote_model(info);owner.view=lambda role:AdapterView(owner,role)
 return owner.view(mode)

def selected(root):
 import os
 if os.environ.get('ECHO_SHARED_SEALLMS_VALIDATE')=='1':return True
 path=Path(root)/'llama/selected-runtime.json'
 if not path.exists():return False
 try:data=json.loads(path.read_text(encoding='utf-8'))
 except (OSError,ValueError):raise fail('SHARED_SELECTION_INVALID') from None
 if not isinstance(data,dict):raise fail('SHARED_SELECTION_INVALID')
 if data.get('profile')=='current':return False
 if data.get('profile')!='shared-seallms':raise fail('SHARED_SELECTION_INVALID')
 lock=json.loads(Path(__file__).with_name('shared-seallms.lock.json').read_text(encoding='utf-8'))
 report=Path(root)/'llama/shared-validation.json'
 if not report.is_file() or data.get('manifestSHA256')!=lock['manifestSHA256'] or digest(report)!=data.get('validationSHA256'):raise fail('SHARED_VALIDATION_REQUIRED')
 try:validation=json.loads(report.read_text(encoding='utf-8'))
 except (OSError,ValueError):raise fail('SHARED_VALIDATION_REQUIRED') from None
 if not isinstance(validation,dict):raise fail('SHARED_VALIDATION_REQUIRED')
 if not validation_passed(validation,lock['manifestSHA256']):raise fail('SHARED_VALIDATION_REQUIRED')
 return True

class SharedRuntime:
 def __init__(self,core):self.core=core;self.model=None
 def ensure(self,cancelled=None):
  if self.model is not None and self.model.server.process.poll() is not None:
   self.close()
  if self.model is None:self.model=SharedModel(self.core.root,cancelled)
  return self.model
 def capability(self,cancelled=None):
  from app.core.exceptions import TalkCancelledError
  if cancelled and cancelled.is_set():raise TalkCancelledError('Cancelled')
  model=self.ensure(cancelled);server=model.server
  try:server.idle()
  except Exception:
   self.close();raise fail('SHARED_RECOVERY_REQUIRED') from None
  if cancelled and cancelled.is_set():raise TalkCancelledError('Cancelled')
  return {'pid':server.process.pid,'port':server.port,'token':server.token,'context':server.context,'identity':model.identity,'ids':model.ids,'generationConfig':model.generation_config,'gpu':{'offloaded':server.offloaded,'modelBytes':server.cuda_model_bytes}}
 def quiesce(self):
  if self.model is not None:
   try:self.model.server.idle()
   except Exception:self.close()
 def close(self):
  model,self.model=self.model,None
  if model:model.close()
  buddy=getattr(self.core,'buddy',None)
  if buddy:
   worker=buddy.workers.pop('cbt',None)
   if worker:worker.close()
   buddy.ready=False;buddy.status={'ready':False,'code':'BUDDY_CBT_SHARED_RECOVERING'}
  worker=self.core.resident.pop('phq8',None)
  if worker:worker.close()
  if getattr(self.core,'active',None)=='phq8':self.core.active=None;self.core.instance=None
 def maybe_release(self):
  buddy=getattr(self.core,'buddy',None)
  if buddy and buddy.workers.get('cbt') and buddy.workers['cbt'].process.poll() is None:return
  worker=self.core.resident.get('phq8')
  if worker is not None and getattr(worker,'ready',False) and worker.process.poll() is None:return
  self.close()
