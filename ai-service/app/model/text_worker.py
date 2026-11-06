"""Private in-memory owner protocol. Buddy adds bounded audio only when opted in."""
import contextlib
import json
import os
import queue
import sys
import threading
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.buddy.config import enabled

MAX_PACKET = 40 * 1024 * 1024 if enabled() else 1024 * 1024

EMIT_LOCK = threading.Lock()
STARTUP_STAGE = 'imports'
STARTUP_READY = False


def emit(value):
    data = json.dumps(value, allow_nan=False).encode("utf-8") + b"\n"
    if len(data) > MAX_PACKET:
        raise ValueError("Output too large")
    with EMIT_LOCK:
        sys.__stdout__.buffer.write(data)
        sys.__stdout__.buffer.flush()

def main():
    global STARTUP_STAGE, STARTUP_READY
    emit({'event':'startup','stage':STARTUP_STAGE})
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        # Windows native SciPy initialization can stall while stdin reader blocks.
        # Import before creating that thread; this loads no model weights.
        from app.vendor.xlmr.classifier import Classifier
        from transformers import XLMRobertaForSequenceClassification, RobertaModel, Qwen2ForCausalLM
        from app.model.core import CoreRuntime
        STARTUP_STAGE = 'cuda'
        emit({'event':'startup','stage':STARTUP_STAGE})
        if not torch.cuda.is_available():raise RuntimeError('NATIVE_STARTUP_CUDA_UNAVAILABLE')
        if (torch.ones(4, device="cuda") @ torch.ones(4, device="cuda")).item() != 4:
            raise RuntimeError('NATIVE_STARTUP_CUDA_CHECK_FAILED')
        STARTUP_STAGE = 'asset_verification'
        emit({'event':'startup','stage':STARTUP_STAGE})
        runtime = CoreRuntime(SimpleNamespace(models_root=sys.argv[1], queue_limit=1), text_only=True)
    runtime.native_inference_seconds = int(sys.argv[2]) if len(sys.argv)>2 else 270
    if not 1<=runtime.native_inference_seconds<=270:raise ValueError("Invalid inference deadline")
    STARTUP_READY = True
    emit({"ready": True})
    packets = queue.Queue(maxsize=2)
    active = {}
    def read():
        # A blocking Windows CRT pipe read can stall DLL initialization on the
        # inference thread. Poll the pipe before reading, retaining cancellation.
        if os.name == 'nt':
            import ctypes,msvcrt,time
            handle=ctypes.c_void_p(msvcrt.get_osfhandle(sys.stdin.fileno()))
            peek=ctypes.WinDLL('kernel32',use_last_error=True).PeekNamedPipe
            peek.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_void_p,ctypes.POINTER(ctypes.c_uint32),ctypes.c_void_p]
            peek.restype=ctypes.c_int
        try:
            limit = 3 * 1024 * 1024 if enabled() else 64 * 1024
            buffered=bytearray()
            while True:
                if os.name == 'nt':
                    while b'\n' not in buffered:
                        available=ctypes.c_uint32()
                        if not peek(handle,None,0,None,ctypes.byref(available),None):raise EOFError()
                        if not available.value:
                            time.sleep(.01)
                            continue
                        chunk=os.read(sys.stdin.fileno(),min(available.value,limit+1))
                        if not chunk:raise EOFError()
                        buffered.extend(chunk)
                        if len(buffered)>limit and b'\n' not in buffered:raise ValueError('Input packet limit')
                    line,_,rest=buffered.partition(b'\n');buffered=bytearray(rest)
                    data=bytes(line)+b'\n'
                else:
                    data = sys.stdin.buffer.readline(limit + 1)
                if not data or len(data) > limit or not data.endswith(b"\n"):
                    break
                packet = json.loads(data)
                if packet.get('op')=='runtime_status':
                    buddy=getattr(runtime,'buddy',None)
                    workers=dict(buddy.workers) if buddy else {}
                    speech='moss' if buddy and buddy.voice_mode=='expressive' else 'nano'
                    healthy=bool(buddy and buddy.ready and all(workers.get(kind) and workers[kind].process.poll() is None for kind in ('cbt',speech,'whisper')))
                    emit({'event':'control','id':packet['id'],'ok':True,'result':{
                        'ready':True,'talkActive':bool(buddy and buddy.owner),
                        'talkBusy':bool(getattr(runtime,'interactive_active',False)),
                        'journalBusy':bool(getattr(runtime,'journal_active',False)),
                        'talkReady':healthy,
                        'baseReady':bool(runtime.hf_runtime and runtime.hf_runtime.worker and runtime.hf_runtime.worker.process.poll() is None),
                    }})
                    continue
                if packet.get('op')=='buddy_pulse':
                    valid=False
                    try:
                        if enabled():runtime.buddy.require(packet.get('session')) ; valid=True
                    except Exception:pass
                    emit({'event':'control','id':packet['id'],'ok':valid})
                    continue
                if packet["op"] == "cancel":
                    event = active.get(packet["id"])
                    if event:
                        event.set()
                    continue
                event = threading.Event()
                active[packet["id"]] = event
                packets.put_nowait((packet, event))
        except Exception:
            pass
        # Closing these pipes terminates optional GPU workers even on parent exit.
        if getattr(runtime, "buddy", None):
            runtime.buddy.close()
        os._exit(0)
    threading.Thread(target=read, daemon=True).start()
    try:
        while True:
            packet, cancelled = packets.get()
            identity = packet["id"]
            runtime.interactive_active=packet['op'] in ('buddy','chat','preload')
            runtime.journal_active=packet['op'] in ('classify','emotions','analyze','screening','screening_phase')
            try:
                if packet["op"] not in ("preload", "journal_runtime", "classify", "emotions", "analyze", "chat", "screening", "screening_phase", "metrics", "buddy"):
                    raise ValueError("Unsupported operation")
                runtime.require_journal_owner(packet.get("journalOwner"))
                with contextlib.redirect_stdout(sys.stderr):
                    if packet["op"] == "buddy":
                        runtime.operation_cancelled = cancelled
                        if not enabled():
                            raise ValueError("Buddy is disabled")
                        runtime.buddy.progress = lambda value: emit({"id": identity, "event": "preparation", "progress": value})
                        try:
                            result = runtime.buddy.dispatch(*packet["args"], cancelled=cancelled)
                        finally:
                            runtime.buddy.progress = None
                            runtime.operation_cancelled = None
                    else:
                        runtime.operation_cancelled = cancelled
                        runtime.native_progress = lambda value: emit({"id":identity,"event":"preparation","progress":value})
                        if packet['op'] in ('chat','preload'):runtime.buddy.progress=runtime.native_progress
                        try:
                            result = getattr(runtime, packet["op"])(*packet["args"])
                        finally:
                            runtime.operation_cancelled = None
                            runtime.native_progress = None
                            if packet['op'] in ('chat','preload'):runtime.buddy.progress=None
                emit({"id": identity, "ok": True, "result": result,
                      "modelLoaded": runtime.instance is not None or bool(getattr(runtime, "buddy", None) and runtime.buddy.workers.get("cbt")) or bool(getattr(runtime,"hf_runtime",None) and runtime.hf_runtime.worker and runtime.hf_runtime.worker.process.poll() is None)})
            except Exception as error:
                code = str(error)
                from app.core.exceptions import TalkBusyError
                safe = "TALK_BUSY" if isinstance(error, TalkBusyError) else code if code.startswith(("BUDDY_","NATIVE_")) and code.replace("_", "").isalnum() and len(code) < 80 else "MODEL_UNAVAILABLE"
                emit({"id": identity, "ok": False, "code": safe, "modelLoaded": runtime.instance is not None or bool(getattr(runtime, "buddy", None) and runtime.buddy.workers.get("cbt")) or bool(getattr(runtime,"hf_runtime",None) and runtime.hf_runtime.worker and runtime.hf_runtime.worker.process.poll() is None)})
            finally:
                runtime.interactive_active=False
                runtime.journal_active=False
                active.pop(identity, None)
    finally:
        if getattr(runtime, "buddy", None):
            runtime.buddy.close()
        runtime.release()
        if getattr(runtime,"hf_runtime",None):runtime.hf_runtime.invalidate()

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        if not STARTUP_READY:
            known={
                'Model checksum mismatch.':'NATIVE_STARTUP_MODEL_CHECKSUM_FAILED',
                'Model manifest verification failed.':'NATIVE_STARTUP_MODEL_INVENTORY_FAILED',
                'Inference code differs from its manifest.':'NATIVE_STARTUP_CODE_CHECKSUM_FAILED',
                'NATIVE_STARTUP_CUDA_UNAVAILABLE':'NATIVE_STARTUP_CUDA_UNAVAILABLE',
                'NATIVE_STARTUP_CUDA_CHECK_FAILED':'NATIVE_STARTUP_CUDA_CHECK_FAILED',
            }
            code=known.get(str(error),'NATIVE_STARTUP_INITIALIZATION_FAILED')
            if isinstance(error,(ImportError,ModuleNotFoundError)):code='NATIVE_STARTUP_IMPORT_FAILED'
            elif isinstance(error,PermissionError):code='NATIVE_STARTUP_ACCESS_DENIED'
            elif isinstance(error,FileNotFoundError):code='NATIVE_STARTUP_ASSET_MISSING'
            elif STARTUP_STAGE=='cuda':code='NATIVE_STARTUP_CUDA_CHECK_FAILED' if code=='NATIVE_STARTUP_INITIALIZATION_FAILED' else code
            emit({'ready':False,'stage':STARTUP_STAGE,'code':code})
        raise SystemExit(1) from None
