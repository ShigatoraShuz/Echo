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

from app.core.exceptions import ModelUnavailableError, TalkCancelledError, TalkBusyError
from app.buddy.config import BUDDY_ENV_KEYS
from app.buddy.job import spawn_owned

MAX_PACKET = 1024 * 1024


class TextRuntime:
    model_name = "echo-core"
    model_version = "echo-core-v3"
    device = "cuda"
    max_input_tokens = 4096

    def __init__(self, settings):
        self.settings = settings
        self.buddy_enabled = getattr(settings, "echo_buddy_enabled", False)
        self.max_packet = 40 * 1024 * 1024 if self.buddy_enabled else MAX_PACKET
        self.wire_lock = threading.Lock()
        if self.buddy_enabled:
            from app.buddy.transport import TalkProxy
            self.talk = TalkProxy(self)
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
            for key in (*BUDDY_ENV_KEYS,
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
        if self.buddy_enabled:
            env["ECHO_BUDDY_ENABLED"] = "true"
        self.process = spawn_owned(
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
                line = self.process.stdout.readline(self.max_packet + 1)
                if not line or len(line) > self.max_packet or not line.endswith(b"\n"):
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
            from app.buddy.process import terminate_tree
            terminate_tree(process)
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

    def _call(self, operation, *args, cancelled=None):
        self.require_ready()
        # One GPU owner, bounded admission. Overlapping journal/Buddy requests wait
        # without changing generation parameters or caching user text/results.
        if not self.pending.acquire(blocking=False):
            raise ModelUnavailableError("Text worker queue is full.")
        deadline = time.monotonic() + (600 if operation == "buddy" else self.settings.core_request_timeout_seconds)
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
            if len(packet) > (3 * 1024 * 1024 if operation == "buddy" and self.buddy_enabled else 64 * 1024):
                raise ValueError("Text payload too large.")
            try:
                # Include a stalled pipe write in the same hard request deadline.
                # Never let an unresponsive child block the HTTP thread before receive.
                def send():
                    try:
                        with self.wire_lock:
                            self.process.stdin.write(packet)
                            self.process.stdin.flush()
                    except (OSError, ValueError):
                        try:
                            self.responses.put_nowait(None)
                        except queue.Full:
                            pass

                self.writer = threading.Thread(target=send, daemon=True)
                self.writer.start()
                cancel_sent = False
                while True:
                    if time.monotonic() >= deadline:
                        raise ModelUnavailableError("Text worker unavailable or timed out.")
                    if cancelled and cancelled.is_set() and not cancel_sent and not self.writer.is_alive():
                        with self.wire_lock:
                            self.process.stdin.write(json.dumps({"op": "cancel", "id": identity}).encode() + b"\n")
                            self.process.stdin.flush()
                        cancel_sent = True
                    try:
                        reply = self.responses.get(timeout=.1)
                        if not isinstance(reply, dict):
                            raise ModelUnavailableError("Text worker unavailable.")
                        break
                    except queue.Empty:
                        continue
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
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            if not reply.get("ok"):
                code = reply.get("code", "")
                if code == "TALK_BUSY":
                    raise TalkBusyError("Talk has priority")
                if isinstance(code, str) and code.startswith("BUDDY_") and code.replace("_", "").isalnum() and len(code) < 80:
                    raise ModelUnavailableError(code)
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
