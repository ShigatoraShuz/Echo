"""Fixed native component only; no prompts/captures/results in files or stderr."""
import contextlib,json,sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from app.model.native_process import LOAD_SECONDS
from app.model.loading_policy import load_error_code,transient

def emit(packet):
 data=json.dumps(packet,allow_nan=False).encode()+b'\n'
 if len(data)>1024*1024:raise ValueError('Native output too large')
 sys.__stdout__.buffer.write(data);sys.__stdout__.buffer.flush()

def main():
 root,kind=sys.argv[1:3];runtime=None
 cpu=sys.argv[3:]==['cpu']
 if cpu and kind!='xlmr':return
 if kind not in LOAD_SECONDS:return
 for line in iter(lambda:sys.stdin.buffer.readline(65537),b''):
  if len(line)>65536 or not line.endswith(b'\n'):break
  packet=json.loads(line);identity=packet.get('id');task=packet.get('task')
  try:
   with contextlib.redirect_stdout(sys.stderr):
    if task=='load' and runtime is None:
     import torch
     if not torch.cuda.is_available():raise RuntimeError('NATIVE_CUDA_UNAVAILABLE')
     from app.model.core import CoreRuntime
     runtime=CoreRuntime(SimpleNamespace(models_root=root,queue_limit=1),text_only=True,component=kind)
     runtime.isolated_native=False
     if kind=='phq8' and runtime.screening_unavailable:raise FileNotFoundError()
     if packet.get('shared'):
      if kind!='phq8':raise ValueError('Shared adapter role differs')
      from app.buddy.shared_seallms import PHQBridge,remote_view
      from transformers import AutoTokenizer
      bridge=PHQBridge(remote_view(packet['shared'],'phq'))
      runtime.instance=(bridge,AutoTokenizer.from_pretrained(Path(root)/'phq8-seallms/adapter',local_files_only=True,trust_remote_code=False))
      runtime.active='phq8';runtime.resident={'phq8':runtime.instance}
     else:runtime._load_once(kind)
     if cpu:
      runtime.instance.model.to('cpu');runtime.instance.device=torch.device('cpu');torch.cuda.empty_cache()
     from app.buddy.gpu_memory import require_headroom
     require_headroom(torch)
     result={'ready':True,'component':kind,**({'device':'cpu'} if cpu else {})}
    elif task in ('infer','phq_pass') and runtime is not None:
     text=packet.get('text')
     if not isinstance(text,str) or not text.strip() or len(text)>20000:raise ValueError('Invalid native text')
     if task=='phq_pass':
      if kind!='phq8' or type(packet.get('check')) is not bool:raise ValueError('Invalid PHQ phase')
      from app.model.screening import infer_pass
      result=infer_pass(runtime.instance[0],runtime.instance[1],text,check=packet['check'])
     else:result={'xlmr':lambda:runtime.classify(text,packet.get('language','unknown')),'e4':lambda:runtime.emotions(text),'phq8':lambda:runtime.screening(text)}[kind]()
    else:raise ValueError('Invalid native task')
   emit({'id':identity,'result':result})
  except Exception as error:
   if str(error)=='BUDDY_INSUFFICIENT_GPU_HEADROOM':emit({'id':identity,'waiting':True})
   else:
    code=load_error_code(kind,error).split('_',2)[2]
    if str(error)=='NATIVE_CUDA_UNAVAILABLE':code='CUDA_UNAVAILABLE'
    if task in ('infer','phq_pass'):code='OUTPUT_INVALID' if isinstance(error,(ValueError,TypeError)) else 'INFERENCE_FAILED'
    emit({'id':identity,'error':code,'retryable':transient(error) if task=='load' else False})
   if task=='load':return
  finally:
   packet.clear();result=None;text=None;line=b''
 if runtime:
  with contextlib.redirect_stdout(sys.stderr):runtime.release()

if __name__=='__main__':main()
