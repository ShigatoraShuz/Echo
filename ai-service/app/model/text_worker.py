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

def emit(value):
    data = json.dumps(value, allow_nan=False).encode("utf-8") + b"\n"
    if len(data) > MAX_PACKET:
        raise ValueError("Output too large")
    sys.__stdout__.buffer.write(data)
    sys.__stdout__.buffer.flush()

def main():
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        # Windows native SciPy initialization can stall while stdin reader blocks.
        # Import before creating that thread; this loads no model weights.
        from app.vendor.xlmr.classifier import Classifier
        from transformers import XLMRobertaForSequenceClassification, RobertaModel, Qwen2ForCausalLM
        from app.model.core import CoreRuntime
        assert torch.cuda.is_available()
        assert (torch.ones(4, device="cuda") @ torch.ones(4, device="cuda")).item() == 4
        runtime = CoreRuntime(SimpleNamespace(models_root=sys.argv[1], queue_limit=1), text_only=True)
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
            try:
                if packet["op"] not in ("classify", "analyze", "chat", "screening", "metrics", "buddy"):
                    raise ValueError("Unsupported operation")
                with contextlib.redirect_stdout(sys.stderr):
                    if packet["op"] == "buddy":
                        if not enabled():
                            raise ValueError("Buddy is disabled")
                        result = runtime.buddy.dispatch(*packet["args"], cancelled=cancelled)
                    else:
                        result = getattr(runtime, packet["op"])(*packet["args"])
                emit({"id": identity, "ok": True, "result": result,
                      "modelLoaded": runtime.instance is not None or bool(getattr(runtime, "buddy", None) and runtime.buddy.workers.get("cbt"))})
            except Exception as error:
                code = str(error)
                from app.core.exceptions import TalkBusyError
                safe = "TALK_BUSY" if isinstance(error, TalkBusyError) else code if code.startswith("BUDDY_") and code.replace("_", "").isalnum() and len(code) < 80 else "MODEL_UNAVAILABLE"
                emit({"id": identity, "ok": False, "code": safe, "modelLoaded": runtime.instance is not None or bool(getattr(runtime, "buddy", None) and runtime.buddy.workers.get("cbt"))})
            finally:
                active.pop(identity, None)
    finally:
        if getattr(runtime, "buddy", None):
            runtime.buddy.close()
        runtime.release()

if __name__ == "__main__":
    main()
