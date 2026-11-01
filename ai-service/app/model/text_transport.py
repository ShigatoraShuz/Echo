"""Bounded, serialized text-only IPC. No payload files or inherited DB credentials."""

import json
import os
import queue
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from app.core.exceptions import ModelUnavailableError

MAX_PACKET = 1024 * 1024


class TextRuntime:
    model_name = "echo-core"
    model_version = "echo-core-v3"
    device = "cuda"
    max_input_tokens = 4096

    def __init__(self, settings):
        self.settings = settings
        self.adapter_path = str(Path(settings.models_root) / "cbt/adapter")
        self.loaded = False
        self.model_loaded = False
        self.process = None
        self.lock = threading.Lock()
        self.pending = threading.BoundedSemaphore(getattr(settings, "queue_limit", 4))
        self.responses = queue.Queue(maxsize=2)
        # Deliberately exclude tokens, proxy settings, DB URLs and user credentials.
        env = {
            key: os.environ[key]
            for key in (
                "SYSTEMROOT",
                "WINDIR",
                "PATH",
                "TEMP",
                "TMP",
                "COMSPEC",
                "USERPROFILE",
                "USERNAME",
                "LOCALAPPDATA",
                "CUDA_VISIBLE_DEVICES",
            )
            if key in os.environ
        }
        env.update(
            PYTHONDONTWRITEBYTECODE="1",
            HF_HUB_OFFLINE="1",
            TRANSFORMERS_OFFLINE="1",
            HF_HUB_DISABLE_TELEMETRY="1",
            TOKENIZERS_PARALLELISM="false",
            PYTHONIOENCODING="utf-8",
        )
        self.process = subprocess.Popen(
            [
                sys.executable,
                "-I",
                "-B",
                str(Path(__file__).with_name("text_worker.py")),
                str(Path(settings.models_root).resolve()),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env=env,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()
        try:
            if self._receive(90) != {"ready": True}:
                raise ModelUnavailableError("Text worker initialization failed.")
            self.loaded = True
        except (OSError, ModelUnavailableError):
            self.release()
            raise ModelUnavailableError("Text worker initialization failed.") from None

    @property
    def loaded(self):
        return self._loaded and self.process is not None and self.process.poll() is None

    @loaded.setter
    def loaded(self, value):
        self._loaded = value

    def _read(self):
        try:
            while True:
                line = self.process.stdout.readline(MAX_PACKET + 1)
                if not line or len(line) > MAX_PACKET or not line.endswith(b"\n"):
                    break
                self.responses.put_nowait(json.loads(line))
        except (OSError, ValueError, queue.Full):
            pass
        finally:
            try:
                self.responses.put_nowait(None)
            except queue.Full:
                pass

    def _receive(self, timeout):
        try:
            value = self.responses.get(timeout=timeout)
            if not isinstance(value, dict):
                raise TypeError()
            return value
        except (queue.Empty, TypeError):
            raise ModelUnavailableError("Text worker unavailable or timed out.") from None

    def release(self):
        self.loaded = False
        self.model_loaded = False
        process = self.process
        if process is not None:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=10)
            for name in ("reader", "writer"):
                thread = getattr(self, name, None)
                if thread and thread is not threading.current_thread():
                    thread.join(timeout=2)
            for stream in (process.stdin, process.stdout):
                if stream:
                    stream.close()

    def require_ready(self):
        if not self.loaded or self.process.poll() is not None:
            raise ModelUnavailableError("Text worker unavailable.")

    def _call(self, operation, *args):
        self.require_ready()
        # One GPU owner, bounded admission. Overlapping journal/Buddy requests wait
        # without changing generation parameters or caching user text/results.
        if not self.pending.acquire(blocking=False):
            raise ModelUnavailableError("Text worker queue is full.")
        deadline = time.monotonic() + self.settings.core_request_timeout_seconds
        acquired = False
        try:
            acquired = self.lock.acquire(timeout=max(0, deadline - time.monotonic()))
            if not acquired:
                raise ModelUnavailableError("Text worker busy.")
            self.require_ready()
            identity = uuid.uuid4().hex
            packet = (
                json.dumps({"id": identity, "op": operation, "args": args}, allow_nan=False).encode(
                    "utf-8"
                )
                + b"\n"
            )
            if len(packet) > 64 * 1024:
                raise ValueError("Text payload too large.")
            try:
                # Include a stalled pipe write in the same hard request deadline.
                # Never let an unresponsive child block the HTTP thread before receive.
                def send():
                    try:
                        self.process.stdin.write(packet)
                        self.process.stdin.flush()
                    except (OSError, ValueError):
                        try:
                            self.responses.put_nowait(None)
                        except queue.Full:
                            pass

                self.writer = threading.Thread(target=send, daemon=True)
                self.writer.start()
                reply = self._receive(max(0.001, deadline - time.monotonic()))
                if (
                    reply.get("id") != identity
                    or type(reply.get("ok")) is not bool
                    or (reply["ok"] and "result" not in reply)
                ):
                    raise ModelUnavailableError("Invalid text worker response.")
            except (OSError, ModelUnavailableError):
                self.release()
                raise ModelUnavailableError("Text worker unavailable or timed out.") from None
            self.model_loaded = reply.get("modelLoaded") is True
            if not reply.get("ok"):
                raise ModelUnavailableError("Model operation unavailable.")
            return reply["result"]
        finally:
            if acquired:
                self.lock.release()
            self.pending.release()

    def classify(self, text, language="unknown"):
        return self._call("classify", text, language)

    def analyze(self, text, language="unknown", classification=None):
        # The journal worker already classified this exact input for its safety gate.
        return self._call("analyze", text, language, classification)

    def chat(self, messages):
        return self._call("chat", messages)

    def screening(self, text):
        return self._call("screening", text)

    def metrics(self):
        return self._call("metrics")

    def speech(self, *_):
        raise ModelUnavailableError("Speech transport is not approved in text-memory mode.")

    def face(self, *_):
        raise ModelUnavailableError("Face transport is not approved in text-memory mode.")
