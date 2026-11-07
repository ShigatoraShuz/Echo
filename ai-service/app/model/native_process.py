"""Owned component workers: bounded NDJSON, no user data on disk/argv."""
import json,os,queue,subprocess,sys,threading,time,uuid
from pathlib import Path
from app.buddy.job import spawn_owned,terminate_owned
from app.core.exceptions import TalkCancelledError,TalkBusyError
from app.model.loading_policy import ComponentLoadError,ComponentOperationError

LOAD_SECONDS={'xlmr':180,'e4':180,'phq8':600}
LABEL={'xlmr':'SAFETY','e4':'EMOTION','phq8':'PHQ'}
INFERENCE_SECONDS=270
MAX_PACKET=1024*1024

def envelope(kind):return 5*LOAD_SECONDS[kind]+37+50+270+60

class NativeProcess:
 def __init__(self,root,kind,cancelled=None,*,cpu=False,inference_seconds=None,shared=None):
  if kind not in LOAD_SECONDS or (cpu and kind!='xlmr'):raise ValueError('Invalid native component')
  self.inference_seconds=inference_seconds
  if inference_seconds is not None and not 1<=inference_seconds<=(600 if cpu else 270):raise ValueError('Invalid native inference deadline')
  self.kind=kind;self.process=None;self.responses=queue.Queue(maxsize=2);self.ready=False;self.closed=False
  env={k:os.environ[k] for k in ('SYSTEMROOT','WINDIR','PATH','TEMP','TMP','COMSPEC','USERPROFILE','USERNAME','LOCALAPPDATA','CUDA_VISIBLE_DEVICES') if k in os.environ}
  env.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_DATASETS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false',PYTHONIOENCODING='utf-8',PYTHONDONTWRITEBYTECODE='1',ECHO_BUDDY_ENABLED='false')
  deadline=time.monotonic()+LOAD_SECONDS[kind]
  try:
   self._cancel(cancelled)
   self.process=spawn_owned([sys.executable,'-I','-B','-u',str(Path(__file__).with_name('native_worker.py')),str(Path(root).resolve()),kind,*(['cpu'] if cpu else [])],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),resource_limits={'memory_bytes':28_000_000_000,'cpu_percent':60})
   threading.Thread(target=self._read,daemon=True).start()
   result=self._request({'task':'load',**({'shared':shared} if shared is not None else {})},deadline,cancelled,loading=True)
   expected={'ready':True,'component':kind,**({'device':'cpu'} if cpu else {})}
   if result!=expected:raise ComponentLoadError(kind,'PROTOCOL_INVALID',False)
   self.ready=True
  except Exception:
   self.close();raise
 def _read(self):
  try:
   while True:
    line=self.process.stdout.readline(MAX_PACKET+1)
    if not line or len(line)>MAX_PACKET or not line.endswith(b'\n'):break
    self.responses.put_nowait(json.loads(line))
  except (OSError,ValueError,queue.Full):pass
  finally:
   try:self.responses.put_nowait(None)
   except queue.Full:pass
 def _cancel(self,cancelled):
  if cancelled and cancelled.is_set():raise TalkCancelledError('Cancelled')
 def _request(self,payload,deadline,cancelled,loading=False):
  self._cancel(cancelled);identity=uuid.uuid4().hex
  packet=json.dumps({'id':identity,**payload},allow_nan=False).encode()+b'\n'
  if len(packet)>64*1024:raise ValueError('Native request too large')
  def send():
   try:self.process.stdin.write(packet);self.process.stdin.flush()
   except (OSError,ValueError):pass
  threading.Thread(target=send,daemon=True).start()
  while time.monotonic()<deadline:
   self._cancel(cancelled)
   try:reply=self.responses.get(timeout=.1)
   except queue.Empty:continue
   self._cancel(cancelled)
   if not isinstance(reply,dict) or reply.get('id')!=identity:
    if loading:raise ComponentLoadError(self.kind,'WORKER_UNAVAILABLE',True)
    raise ComponentOperationError(self.kind,'WORKER_UNAVAILABLE')
   if reply.get('waiting') is True:raise TalkBusyError('GPU capacity waiting')
   if 'error' in reply:
    if loading:raise ComponentLoadError(self.kind,reply['error'],reply.get('retryable') is True)
    raise ComponentOperationError(self.kind,'OUTPUT_INVALID' if reply['error']=='OUTPUT_INVALID' else 'INFERENCE_FAILED')
   if 'result' not in reply:
    if loading:raise ComponentLoadError(self.kind,'PROTOCOL_INVALID',False)
    raise ComponentOperationError(self.kind,'PROTOCOL_INVALID')
   return reply['result']
  if loading:raise ComponentLoadError(self.kind,'LOAD_TIMEOUT',True)
  raise ComponentOperationError(self.kind,'INFERENCE_TIMEOUT')
 def call(self,text,language='unknown',cancelled=None):
  if not isinstance(text,str) or not text.strip() or len(text)>20000:raise ValueError('Invalid journal text')
  try:return self._request({'task':'infer','text':text,'language':language},time.monotonic()+(INFERENCE_SECONDS if self.inference_seconds is None else self.inference_seconds),cancelled)
  except Exception:self.close();raise
 def phq_pass(self,text,check=False,cancelled=None):
  if self.kind!='phq8' or not isinstance(text,str) or not text.strip() or len(text)>20000:raise ValueError('Invalid PHQ pass')
  try:return self._request({'task':'phq_pass','text':text,'check':check},time.monotonic()+(INFERENCE_SECONDS if self.inference_seconds is None else self.inference_seconds),cancelled)
  except Exception:self.close();raise
 def close(self):
  if self.closed:return
  self.closed=True;self.ready=False
  if self.process is not None:
   try:terminate_owned(self.process)
   finally:
    for stream in (self.process.stdin,self.process.stdout):
     try:stream.close()
     except (OSError,ValueError):pass
