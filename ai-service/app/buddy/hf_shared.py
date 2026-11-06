"""One owned Transformers/PEFT worker; task handles retain independent ownership."""
import threading
from app.buddy.process import Process
from app.buddy.config import paths

class SharedHF:
 def __init__(self):self.worker=None;self.handles={};self.lock=threading.RLock();self.keep_loaded=False
 def acquire(self,role,cancelled=None,deadline=None):
  if role not in ('cbt','phq8'):raise ValueError('Invalid shared role')
  with self.lock:
   if self.worker is not None and self.worker.process.poll() is not None:self.invalidate()
   if self.worker is None:self.worker=Process(paths()['cbt'],'cbt',cancelled,deadline=deadline)
   if self.keep_loaded and 'startup' not in self.handles:self.handles['startup']=Handle(self,'startup',self.worker)
   if role not in self.handles:self.handles[role]=Handle(self,role,self.worker)
   return self.handles[role]
 def disable_startup_residency(self):
  with self.lock:
   self.keep_loaded=False
   pin=self.handles.get('startup')
   if pin:pin.close()
 def invalidate(self):
  worker,self.worker=self.worker,None
  for handle in self.handles.values():handle.ready=False
  self.handles.clear()
  if worker:worker.close()
 def release(self,handle):
  with self.lock:
   if self.handles.get(handle.role) is not handle:return
   self.handles.pop(handle.role)
   if not self.handles:self.invalidate()

class Handle:
 def __init__(self,owner,role,worker):self.owner=owner;self.role=role;self.worker=worker;self.process=worker.process;self.ready=True
 def call(self,request, cancelled=None, *, deadline=None):
  with self.owner.lock:
   from app.core.exceptions import ModelUnavailableError
   from app.model.loading_policy import ComponentOperationError
   if not self.ready or self.owner.worker is not self.worker:
    if self.role=='phq8':raise ComponentOperationError('phq8','WORKER_UNAVAILABLE')
    raise ModelUnavailableError('BUDDY_CBT_WORKER_UNAVAILABLE')
   try:return self.worker.call(request,cancelled,deadline=deadline)
   except Exception as error:
    if str(error)=='BUDDY_CBT_CONTEXT_LIMIT':raise
    if self.role=='phq8' and str(error)=='NATIVE_PHQ_OUTPUT_INVALID':
     raise ComponentOperationError('phq8','OUTPUT_INVALID') from None
    self.owner.invalidate();self.ready=False;raise
 def phq_pass(self,text,check=False,cancelled=None):return self.call({'phqText':text,'phqCheck':check},cancelled)
 def screening(self,text,cancelled=None):return self.call({'phqText':text},cancelled)
 def close(self):self.ready=False;self.owner.release(self)
