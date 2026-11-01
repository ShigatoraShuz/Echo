"""Private child protocol; only text operations, no HTTP, files or persistence."""

import contextlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

# -I omits cwd/PYTHONPATH; import only this checkout's trusted application.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
MAX_PACKET = 1024 * 1024


def emit(value):
    data = json.dumps(value, allow_nan=False).encode("utf-8") + b"\n"
    if len(data) > MAX_PACKET:
        raise ValueError("Output too large")
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def main():
    with contextlib.redirect_stdout(sys.stderr):
        import torch

        from app.model.core import CoreRuntime

        # Exercise a kernel, not just driver discovery, before accepting work.
        assert torch.cuda.is_available()
        assert (torch.ones(4, device="cuda") @ torch.ones(4, device="cuda")).item() == 4
        runtime = CoreRuntime(
            SimpleNamespace(models_root=sys.argv[1], queue_limit=1), text_only=True
        )
        runtime.screening_unavailable = runtime.screening_unavailable or "SEMANTIC_VALIDATION_PENDING"
    emit({"ready": True})
    try:
        while True:
            data = sys.stdin.buffer.readline(64 * 1024 + 1)
            if not data:
                break
            if len(data) > 64 * 1024 or not data.endswith(b"\n"):
                break
            packet = json.loads(data)
            identity = packet["id"]
            try:
                if packet["op"] not in ("classify", "analyze", "chat", "screening", "metrics"):
                    raise ValueError("Unsupported operation")
                with contextlib.redirect_stdout(sys.stderr):
                    result = getattr(runtime, packet["op"])(*packet["args"])
                emit(
                    {
                        "id": identity,
                        "ok": True,
                        "result": result,
                        "modelLoaded": runtime.instance is not None,
                    }
                )
            except Exception:  # noqa: BLE001 -- sanitize all model failures; never expose input or loader errors
                emit({"id": identity, "ok": False, "modelLoaded": runtime.instance is not None})
    finally:
        runtime.release()


if __name__ == "__main__":
    main()
