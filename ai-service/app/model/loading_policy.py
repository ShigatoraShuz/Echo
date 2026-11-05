"""Retries only loader operations; never replay model inference or user requests."""
import errno
import time
from app.core.exceptions import ModelUnavailableError,TalkBusyError,TalkCancelledError

class NativeLoadError(ModelUnavailableError):pass

def load_error_code(name,error):
 prefix='NATIVE_'+{'xlmr':'SAFETY','e4':'EMOTION','phq8':'PHQ','cbt':'CBT'}.get(name,name.upper())+'_'
 if isinstance(error,FileNotFoundError):return prefix+'ASSET_MISSING'
 if isinstance(error,PermissionError):return prefix+'ACCESS_DENIED'
 if isinstance(error,ImportError):return prefix+'IMPORT_FAILED'
 if isinstance(error,ValueError):return prefix+'CONFIG_INVALID'
 if getattr(error,'errno',None) in (errno.ENOMEM,errno.ENOSPC) or type(error).__name__=='OutOfMemoryError':return prefix+'MEMORY_UNAVAILABLE'
 return prefix+'LOAD_FAILED'

def transient(error):
 if isinstance(error,(FileNotFoundError,PermissionError,ImportError,ValueError)):return False
 if getattr(error,'errno',None) in (errno.ENOMEM,errno.ENOSPC) or getattr(error,'winerror',None)==5:return False
 # Runtime/configuration/model exceptions are not assumed to be transient.
 return isinstance(error,(TimeoutError,ConnectionError,OSError))

def load_with_retries(name,load,cleanup,sleep=time.sleep,report=None):
 for attempt in range(1,6):
  if report:report({'component':name,'state':'loading','attempt':attempt,'maxAttempts':5})
  try:
   value=load()
   if report:report({'component':name,'state':'ready','attempt':attempt,'maxAttempts':5})
   return value
  except (TalkBusyError,TalkCancelledError):raise
  except Exception as error:
   code=load_error_code(name,error);can_retry=transient(error)
   # Loader traceback frames can otherwise retain partially allocated GPU objects.
   error.__traceback__=None
   cleanup()
   if not can_retry or attempt==5:
    if report:report({'component':name,'state':'failed','attempt':attempt,'maxAttempts':5,'code':code,'retryable':can_retry})
    raise NativeLoadError(code) from None
   delay=(2,5,10,20)[attempt-1]
   if report:report({'component':name,'state':'retrying','attempt':attempt,'maxAttempts':5,'code':code,'retryInSeconds':delay,'retryable':True})
   sleep(delay)
