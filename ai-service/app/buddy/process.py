"""Bounded NDJSON subprocesses; no payload files or inherited service credentials."""
import json
import os
import queue
import subprocess
import threading
import time
import uuid
from pathlib import Path
from app.core.exceptions import ModelUnavailableError, TalkCancelledError
from app.buddy.config import BUDDY_ENV_KEYS, paths
from app.buddy.loading import COMPONENT_SECONDS
from app.buddy.job import spawn_owned, terminate_owned

WORKER_SCRIPT = Path(__file__).with_name("worker.py")
MAX_RESPONSE = 40 * 1024 * 1024
SAFE_ENV = ("SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "COMSPEC", "USERPROFILE",
            "USERNAME", "LOCALAPPDATA", "CUDA_VISIBLE_DEVICES")

def terminate_tree(process):
    terminate_owned(process)

def check_environment(python, kind, env, cancelled=None, deadline=None):
    imports = {
        "cbt": "import ctypes,torch,transformers",
        "nano": "import ctypes,torch,torchaudio,transformers,soundfile",
        "moss": "import ctypes,numpy,soundfile,scipy",
        "whisper": "import ctypes,faster_whisper,numpy",
    }[kind]
    check = spawn_owned([str(python), "-I", "-B", "-c", imports],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        env=env, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        resource_limits={"memory_bytes":28_000_000_000,"cpu_percent":60})
    deadline = min(deadline or float("inf"), time.monotonic() + 180)
    try:
        while True:
            if cancelled and cancelled.is_set():
                terminate_tree(check)
                raise TalkCancelledError("Cancelled")
            if time.monotonic() >= deadline:
                terminate_tree(check)
                raise ModelUnavailableError("BUDDY_" + kind.upper() + "_ENV_TIMEOUT")
            try:
                _, detail = check.communicate(timeout=.1)
                break
            except subprocess.TimeoutExpired:
                continue
        if check.returncode:
            text = detail.decode("utf-8", errors="replace")[-8192:]
            suffix = "ENV_ACCESS_DENIED" if "Access is denied" in text or "PermissionError" in text else "ENV_IMPORT_FAILED"
            raise ModelUnavailableError("BUDDY_" + kind.upper() + "_" + suffix)
    finally:
        job = getattr(check, "_buddy_job", None)
        if job:
            job.close()
        if check.stderr:
            check.stderr.close()

class Process:
    def __init__(self, python, kind, cancelled=None, deadline=None):
        self.kind = kind
        self.latest_progress = None
        self.responses = queue.Queue(maxsize=2)
        env = {key: os.environ[key] for key in (*SAFE_ENV, *BUDDY_ENV_KEYS) if key in os.environ}
        env.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                   TOKENIZERS_PARALLELISM="false", PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1")
        cache = paths()["root"] / "cache"
        env.update(HF_HOME=str(cache / "hf"), HF_MODULES_CACHE=str(cache / "modules"),
                   TORCHINDUCTOR_CACHE_DIR=str(cache / "torch"), CUDA_CACHE_PATH=str(cache / "cuda"))
        try:
            check_environment(python, kind, env, cancelled, deadline)
            self.process = spawn_owned(
                [str(python), "-I", "-B", "-u", str(WORKER_SCRIPT), kind],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                resource_limits={"memory_bytes":28_000_000_000,"cpu_percent":60})
        except OSError:
            raise ModelUnavailableError("BUDDY_" + kind.upper() + "_ENV_UNAVAILABLE") from None
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        try:
            while True:
                line = self.process.stdout.readline(MAX_RESPONSE + 1)
                if not line or len(line) > MAX_RESPONSE or not line.endswith(b"\n"):
                    break
                value=json.loads(line)
                if self.kind=='moss' and value.get('event')=='progress':
                    if value.get('stage') in ('asset_verification','reference_validation'):self.latest_progress=(value.get('id'),value['stage'])
                    continue
                self.responses.put_nowait(value)
        except (OSError, ValueError, queue.Full):
            pass
        finally:
            try:
                self.responses.put_nowait(None)
            except queue.Full:
                pass

    def call(self, request, cancelled=None, deadline=None, progress=None):
        identity = uuid.uuid4().hex
        last_progress=0
        packet = json.dumps({"id": identity, "request": request}, allow_nan=False).encode() + b"\n"
        if len(packet) > 3 * 1024 * 1024:
            raise ValueError("Buddy packet too large")
        preparation = deadline is not None or request.get("check") is True
        deadline = min(deadline or float("inf"), time.monotonic() + (COMPONENT_SECONDS[self.kind] if request.get("check") else 600))
        if time.monotonic() >= deadline:
            self.close()
            raise ModelUnavailableError("BUDDY_" + self.kind.upper() + "_LOAD_TIMEOUT")
        try:
            def send():
                try:
                    self.process.stdin.write(packet)
                    self.process.stdin.flush()
                except (OSError, ValueError):
                    try: self.responses.put_nowait(None)
                    except queue.Full: pass
            threading.Thread(target=send, daemon=True).start()
            while time.monotonic() < deadline:
                if progress and self.latest_progress and self.latest_progress[0]==identity and time.monotonic()-last_progress>=1:
                    progress(self.latest_progress[1]);last_progress=time.monotonic()
                if cancelled and cancelled.is_set():
                    self.close()
                    raise TalkCancelledError("Cancelled")
                try:
                    reply = self.responses.get(timeout=.1)
                except queue.Empty:
                    if self.process.poll() is not None:
                        break
                    continue
                if not isinstance(reply, dict) or reply.get("id") != identity:
                    break
                if reply.get("error"):
                    raise ModelUnavailableError(reply["error"])
                return reply["result"]
        except (OSError, ValueError):
            pass
        self.close()
        suffix = "LOAD_TIMEOUT" if time.monotonic() >= deadline and preparation else "WORKER_UNAVAILABLE"
        raise ModelUnavailableError("BUDDY_" + self.kind.upper() + "_" + suffix)

    def close(self):
        terminate_tree(self.process)
        for stream in (self.process.stdin, self.process.stdout):
            try:
                stream.close()
            except (OSError, ValueError):
                pass

