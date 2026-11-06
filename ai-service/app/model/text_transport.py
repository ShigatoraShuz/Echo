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
from app.buddy.loading import PREPARATION_SECONDS, PREPARATION_TASKS, safe_progress
from app.buddy.job import spawn_owned

MAX_PACKET = 1024 * 1024
STARTUP_SECONDS = 600


class TextRuntime:
    model_name = "echo-core"
    model_version = "echo-core-v3"
    device = "cuda"
    max_input_tokens = 4096

    def __init__(self, settings):
        self.settings = settings
        from app.buddy.shared_seallms import selected
        self.shared_enabled = True  # Native shared HF supports admitted PHQ pass boundaries.
        self.buddy_enabled = getattr(settings, "echo_buddy_enabled", False)
        self.max_packet = 40 * 1024 * 1024 if self.buddy_enabled else MAX_PACKET
        self.wire_lock = threading.Lock()
        self.progress_lock = threading.Lock()
        self.preparation = None
        self.preparation_at = 0
        self.preparation_id = None
        if self.buddy_enabled:
            from app.buddy.transport import TalkProxy
            self.talk = TalkProxy(self)
        self.adapter_path = str(Path(settings.models_root) / "cbt/adapter")
        self.loaded = False
        self.model_loaded = False
        from app.model.face_transport import ResidentFaceRuntime
        self.face_runtime = ResidentFaceRuntime(settings.models_root)
        self.process = None
        from app.model.priority_gate import PriorityGate
        self.lock = PriorityGate()
        self.pending = threading.BoundedSemaphore(getattr(settings, "queue_limit", 4))
        self.interactive_pending = threading.BoundedSemaphore(getattr(settings, "queue_limit", 4))
        self.responses = queue.Queue(maxsize=2)
        self.control_replies = {}
        self.control_lock = threading.Lock()
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
                str(settings.core_request_timeout_seconds),
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
            started=time.monotonic()
            while True:
                remaining=STARTUP_SECONDS-(time.monotonic()-started)
                if remaining<=0:raise ModelUnavailableError('NATIVE_STARTUP_TIMEOUT')
                try:initial=self.responses.get(timeout=min(1,remaining))
                except queue.Empty:
                    if self.process.poll() is not None:raise ModelUnavailableError('NATIVE_STARTUP_WORKER_EXITED')
                    continue
                if initial=={'ready':True}:break
                code=initial.get('code') if isinstance(initial,dict) else None
                import re
                if isinstance(code,str) and re.fullmatch(r'NATIVE_STARTUP_[A-Z_]{1,60}',code):
                    raise ModelUnavailableError(code)
                raise ModelUnavailableError('NATIVE_STARTUP_WORKER_EXITED')
            self.loaded = True
        except (OSError, ModelUnavailableError) as error:
            try:self.release()
            except Exception:pass
            if isinstance(error,ModelUnavailableError):raise
            raise ModelUnavailableError('NATIVE_STARTUP_TRANSPORT_FAILED') from None

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
                value = json.loads(line)
                if isinstance(value,dict) and value.get('event')=='control':
                    with self.control_lock:
                        pending=self.control_replies.get(value.get('id'))
                    if pending:
                        try:pending.put_nowait(value)
                        except queue.Full:pass
                    continue
                if isinstance(value,dict) and value.get('event')=='startup':
                    stage=value.get('stage')
                    if stage in ('imports','cuda','asset_verification'):
                        import logging
                        logging.getLogger('uvicorn.error').info('Private text worker startup: %s',stage)
                    continue
                if isinstance(value, dict) and value.get("event") == "preparation":
                    with self.progress_lock:
                        if self.preparation_id and value.get("id") == self.preparation_id:
                            progress = safe_progress({**value.get("progress", {}), "correlationId": self.preparation_id}) if isinstance(value.get("progress"), dict) else None
                            if progress:
                                self.preparation = progress
                                self.preparation_at = time.monotonic()
                    continue
                self.responses.put_nowait(value)
        except (OSError, ValueError, queue.Full):
            pass
        finally:
            try:
                self.responses.put_nowait(None)
            except queue.Full:
                pass

    def preparation_status(self, profile="buddy_chat"):
        # Independent of request/GPU locks: status remains responsive while loading.
        with self.progress_lock:
            value = dict(self.preparation) if self.preparation and getattr(self,"preparation_kind","buddy_chat")==profile else None
            if value and self.preparation_id and self.preparation_id == value.get("correlationId"):
                delta = max(0, time.monotonic() - self.preparation_at)
                value["elapsedSeconds"] = min(PREPARATION_SECONDS, value.get("elapsedSeconds", 0) + delta)
                if "retryInSeconds" in value:
                    value["retryInSeconds"] = max(0, value["retryInSeconds"] - delta)
            return {"preparation": value}

    def _receive(self, timeout):
        try:
            value = self.responses.get(timeout=timeout)
            if not isinstance(value, dict):
                raise TypeError()
            return value
        except (queue.Empty, TypeError):
            raise ModelUnavailableError("Text worker unavailable or timed out.") from None

    def pulse(self, session):
        """Session liveness bypasses inference admission and the GPU queue."""
        self._control('buddy_pulse',{'session':session})
        return {'active':True}

    def runtime_status(self):
        return self._control('runtime_status',{}).get('result',{})

    def _control(self,operation,payload):
        self.require_ready()
        identity=uuid.uuid4().hex
        pending=queue.Queue(maxsize=1)
        with self.control_lock:self.control_replies[identity]=pending
        try:
            if not self.wire_lock.acquire(timeout=1):raise TalkBusyError('BUDDY_CONTROL_BUSY')
            try:
                self.process.stdin.write(json.dumps({'op':operation,'id':identity,**payload}).encode()+b'\n')
                self.process.stdin.flush()
            finally:self.wire_lock.release()
            try:value=pending.get(timeout=3)
            except queue.Empty:raise ModelUnavailableError('BUDDY_HEARTBEAT_TIMEOUT') from None
            if not value.get('ok'):raise ModelUnavailableError('BUDDY_TALK_NOT_ACTIVE')
            return value
        finally:
            with self.control_lock:self.control_replies.pop(identity,None)

    def release(self):
        if getattr(self, "face_runtime", None):
            self.face_runtime.close()
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

    def _call(self, operation, *args, cancelled=None, journal_owner=None):
        self.require_ready()
        # One GPU owner, bounded admission. Overlapping journal/Buddy requests wait
        # without changing generation parameters or caching user text/results.
        admission = self.interactive_pending if operation in ("buddy", "chat", "journal_runtime") else self.pending
        if not admission.acquire(blocking=False):
            raise ModelUnavailableError("Text worker queue is full.")
        preparing = operation == "preload" or operation == "buddy" and len(args) > 1 and isinstance(args[1], dict) and args[1].get("task") in PREPARATION_TASKS
        from app.model.native_process import envelope
        native_kind={'classify':'xlmr','emotions':'e4','screening':'phq8','screening_phase':'phq8','journal_runtime':'xlmr'}.get(operation)
        native_window=(envelope(native_kind) if native_kind else PREPARATION_SECONDS if operation=='analyze' else None) if hasattr(self,'settings') and getattr(self.settings,'core_models_enabled',False) else None
        buddy_loading = operation == 'chat' or (operation == 'buddy' and len(args)>1 and args[1].get('task') in ('chat','support_check'))
        track_progress=preparing or buddy_loading or native_window is not None
        deadline = time.monotonic() + (PREPARATION_SECONDS if preparing or buddy_loading else native_window if native_window is not None else 600 if operation == "buddy" else self.settings.core_request_timeout_seconds)
        identity = None
        acquired = False
        queued_at=time.monotonic()
        try:
            acquired = self.lock.acquire(timeout=max(0, deadline - time.monotonic()), interactive=operation in ("buddy", "chat", "journal_runtime"))
            if not acquired:
                raise ModelUnavailableError("NATIVE_ADMISSION_TIMEOUT")
            queue_seconds=time.monotonic()-queued_at
            self.require_ready()
            identity = uuid.uuid4().hex
            if track_progress:
                with self.progress_lock:
                    self.preparation_id = identity
                    self.preparation_kind = 'buddy_chat' if preparing or buddy_loading else 'journal'
                    self.preparation = None
            packet = (
                json.dumps({"id": identity, "op": operation, "args": args, **({"journalOwner": journal_owner} if journal_owner else {})}, allow_nan=False).encode(
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
                        raise ModelUnavailableError("NATIVE_REQUEST_TIMEOUT")
                    if cancelled and cancelled.is_set() and not cancel_sent and not self.writer.is_alive():
                        with self.wire_lock:
                            self.process.stdin.write(json.dumps({"op": "cancel", "id": identity}).encode() + b"\n")
                            self.process.stdin.flush()
                        cancel_sent = True
                    try:
                        reply = self.responses.get(timeout=.1)
                        if not isinstance(reply, dict):
                            raise ModelUnavailableError("NATIVE_WORKER_EXITED")
                        break
                    except queue.Empty:
                        continue
                if (
                    reply.get("id") != identity
                    or type(reply.get("ok")) is not bool
                    or (reply["ok"] and "result" not in reply)
                ):
                    raise ModelUnavailableError("NATIVE_RESPONSE_INVALID")
            except (OSError, ModelUnavailableError) as error:
                import logging
                code=str(error) if isinstance(error,ModelUnavailableError) and str(error).startswith('NATIVE_') else 'NATIVE_TRANSPORT_FAILED'
                logging.getLogger('uvicorn.error').warning('Private operation failed: operation=%s code=%s queue_seconds=%.3f correlation=%s',operation,code,queue_seconds,identity)
                try:self.release()
                except Exception:pass
                raise ModelUnavailableError(code) from None
            self.model_loaded = reply.get("modelLoaded") is True
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            if not reply.get("ok"):
                code = reply.get("code", "")
                if code == "TALK_BUSY":
                    raise TalkBusyError("Talk has priority")
                if isinstance(code, str) and code.startswith(("BUDDY_","NATIVE_")) and code.replace("_", "").isalnum() and len(code) < 80:
                    raise ModelUnavailableError(code)
                raise ModelUnavailableError("Model operation unavailable.")
            return reply["result"]
        finally:
            if track_progress and identity:
                with self.progress_lock:
                    if self.preparation_id == identity:
                        self.preparation_id = None
            if acquired:
                self.lock.release()
            admission.release()

    def preload(self, cancelled=None):
        return self._call('preload', cancelled=cancelled)

    def classify(self, text, language="unknown", owner=None):
        return self._call("classify", text, language, **({"journal_owner": owner} if owner else {}))

    def analyze(self, text, language="unknown", classification=None, owner=None):
        guard = {"journal_owner": owner} if owner else {}
        if not self.buddy_enabled and owner is None:
            return self._call("analyze", text, language, classification)
        classification = classification or self.classify(text, language, owner)
        emotion = self._call("emotions", text, **guard)
        try:
            if getattr(self, 'shared_enabled', False):
                from app.model.screening import assemble_passes
                adapted = self._call("screening_phase", text, False, **guard)
                checked = self._call("screening_phase", text, True, **guard)
                if adapted['provenance'] != checked['provenance']:
                    raise ModelUnavailableError('NATIVE_PHQ_IDENTITY_CHANGED')
                screening = {**assemble_passes(adapted, checked), **checked['provenance']}
            else:
                screening = self._call("screening", text, **guard)
        except (TalkBusyError, TalkCancelledError):
            # Ownership/cancellation must pause the job, never manufacture a result.
            raise
        except ModelUnavailableError as error:
            code = str(error)
            if not code.startswith("NATIVE_PHQ_") and code != "Model operation unavailable.":
                # A dead transport cannot safely assemble a result in its worker.
                raise
            unavailable = "ASSET" in code or "INTEGRITY" in code
            screening = {"status": "unavailable" if unavailable else "failed", "experimental": True,
                "inferenceVersion": "journal-nullable-v1", "items": None, "coverage": 0,
                "subtotal": None, "total": None}
        return self._call("analyze", text, language, classification, emotion, screening, **guard)

    def journal_runtime(self, action, owners, face_owners=None, cancelled=None):
        if action=='unload' or (owners and not face_owners):self.face_runtime.unload()
        epoch = getattr(self.face_runtime, "generation", None)
        options = {"cancelled": cancelled} if cancelled is not None else {}
        if cancelled is not None and cancelled.is_set():
            raise TalkCancelledError("Cancelled")
        result=self._call("journal_runtime", action, owners, **options)
        if cancelled is not None and cancelled.is_set():
            raise TalkCancelledError("Cancelled")
        if action=='prepare' and face_owners:
            if epoch is not None:
                self.face_runtime.prepare(cancelled=cancelled, expected_generation=epoch)
            else:
                self.face_runtime.prepare()
        return result

    def chat(self, messages):
        return self._call("chat", messages)

    def screening(self, text):
        return self._call("screening", text)

    def metrics(self):
        return self._call("metrics")

    def speech(self, *_):
        raise ModelUnavailableError("Speech transport is not approved in text-memory mode.")

    def face(self, encoded):
        self.require_ready()
        return self.face_runtime.predict(encoded)
