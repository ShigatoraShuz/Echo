"""CPU expression subprocess. Capture bytes are transient and never written to disk."""
import base64
import binascii
import hashlib
import json
import os
import subprocess
import threading
from pathlib import Path
from app.buddy.job import spawn_owned, terminate_owned
from app.core.exceptions import ModelUnavailableError

LIMIT = 2 * 1024 * 1024

class FaceRuntime:
    def __init__(self, models_root):
        self.root = Path(models_root).resolve() / "face_model"
        repo = Path(__file__).resolve().parents[3]
        self.python = Path(os.environ.get("FACE_PYTHON", str(repo.parent / "face-venv/Scripts/python.exe")))
        self.lock = threading.Lock()
        self.state_lock = threading.Lock()
        self.process = None
        self.closed = False

    def verify(self):
        pins = json.loads(Path(__file__).with_name("face-package.lock.json").read_text(encoding="utf-8"))["files"]
        try:
            declared = json.loads((self.root / "package_checksums.json").read_text(encoding="utf-8"))
            if declared != pins:
                raise ValueError("Face package differs from the approved inventory")
            for name, expected in pins.items():
                path = (self.root / name).resolve()
                if path.parent != self.root or not path.is_file():
                    raise ValueError("Missing face package file")
                with path.open("rb") as stream:
                    if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                        raise ValueError("Face package integrity failure")
            if not self.python.is_file():
                raise ValueError("Face interpreter unavailable")
        except (OSError, ValueError, KeyError):
            raise ModelUnavailableError("FACE_PACKAGE_UNAVAILABLE") from None
        return pins

    def predict(self, encoded):
        if not isinstance(encoded, str) or len(encoded) > 2796204:
            raise ValueError("Invalid capture size")
        try:
            data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("Invalid capture encoding") from None
        if not data or len(data) > LIMIT:
            raise ValueError("Invalid capture size")
        pins = self.verify()
        if not self.lock.acquire(timeout=90):
            raise ModelUnavailableError("FACE_BUSY")
        process = None
        try:
            env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "COMSPEC", "USERPROFILE", "LOCALAPPDATA") if key in os.environ}
            env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8", CUDA_VISIBLE_DEVICES="-1")
            with self.state_lock:
                if self.closed:
                    raise ModelUnavailableError("FACE_STOPPED")
                process = spawn_owned([str(self.python), "-I", "-B", str(Path(__file__).parents[1] / "face_eval_memory.py"), str(self.root)],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                self.process = process
            output, _ = process.communicate(input=data, timeout=90)
            if process.returncode != 0 or len(output) > 64 * 1024:
                raise ModelUnavailableError("FACE_INFERENCE_FAILED")
            result = json.loads(output)
            if not isinstance(result, dict) or result.get("schemaVersion") != "echo-face-expression-v1" or result.get("status") not in ("available", "unavailable") or result.get("modelFingerprint") != pins["selected_model.joblib"]:
                raise ValueError("Invalid face response")
            return result
        except (OSError, ValueError, subprocess.TimeoutExpired):
            raise ModelUnavailableError("FACE_INFERENCE_FAILED") from None
        finally:
            try:
                if process:
                    terminate_owned(process)
            finally:
                if process:
                    for stream in (process.stdin, process.stdout):
                        if stream:
                            try: stream.close()
                            except OSError: pass
                with self.state_lock:
                    if self.process is process: self.process = None
                self.lock.release()

    def close(self):
        with self.state_lock:
            self.closed = True
            if self.process:
                terminate_owned(self.process)


FACE_LOAD_SECONDS = 120
FACE_INFERENCE_SECONDS = 90
FACE_RETRY_DELAYS = (2, 5, 10, 20)


class ResidentFaceRuntime(FaceRuntime):
    """Killable preparation, immutable generation checks and transient capture IPC."""
    def __init__(self, models_root):
        super().__init__(models_root)
        self.generation = 0
        self.cancelled = threading.Event()
        self.status = {"state": "unloaded"}

    @staticmethod
    def _dispose(process):
        if process is None:
            return
        try:
            terminate_owned(process)
        finally:
            for stream in (process.stdin, process.stdout):
                try:
                    stream.close()
                except (OSError, ValueError, AttributeError):
                    pass

    def _discard(self):
        with self.state_lock:
            process, self.process = self.process, None
        self._dispose(process)

    def unload(self):
        with self.state_lock:
            self.generation += 1
            self.cancelled.set()
            self.cancelled = threading.Event()
            process, self.process = self.process, None
            self.status = {"state": "unloaded"}
        self._dispose(process)

    def close(self):
        with self.state_lock:
            self.closed = True
        self.unload()

    def _identity(self):
        with self.state_lock:
            if self.closed:
                raise ModelUnavailableError('FACE_STOPPED')
            return self.generation, self.cancelled

    def _check(self, epoch, cancelled):
        with self.state_lock:
            if self.closed or epoch != self.generation or cancelled.is_set():
                raise ModelUnavailableError('FACE_STOPPED')

    def _publish(self, epoch, cancelled, **status):
        with self.state_lock:
            if self.closed or epoch != self.generation or cancelled.is_set():
                raise ModelUnavailableError('FACE_STOPPED')
            self.status = status

    def _acquire(self, epoch, cancelled):
        import time
        deadline = time.monotonic() + 5 * FACE_LOAD_SECONDS + sum(FACE_RETRY_DELAYS)
        while time.monotonic() < deadline:
            self._check(epoch, cancelled)
            if self.lock.acquire(timeout=.1):
                return
        raise ModelUnavailableError('FACE_BUSY')

    def _receive(self, deadline, responses, epoch, cancelled, timeout_code):
        import time, queue
        while time.monotonic() < deadline:
            self._check(epoch, cancelled)
            try:
                reply = responses.get(timeout=min(.1, max(0, deadline-time.monotonic())))
            except queue.Empty:
                continue
            self._check(epoch, cancelled)
            if not isinstance(reply, dict):
                raise ModelUnavailableError('FACE_WORKER_UNAVAILABLE')
            return reply
        self._check(epoch, cancelled)
        raise ModelUnavailableError(timeout_code)

    def _start(self, deadline, epoch, cancelled):
        import queue
        from app.face_eval_memory import approved_pins
        self._check(epoch, cancelled)
        # Only the small trusted source lock is read here. Model filesystem checks,
        # hashing, imports and unpickling all run in the killable owned worker.
        pins = approved_pins()
        self._check(epoch, cancelled)
        env = {key: os.environ[key] for key in ('SYSTEMROOT','WINDIR','PATH','TEMP','TMP','COMSPEC','USERPROFILE','LOCALAPPDATA') if key in os.environ}
        env.update(PYTHONDONTWRITEBYTECODE='1', PYTHONIOENCODING='utf-8', CUDA_VISIBLE_DEVICES='-1')
        try:
            process = spawn_owned([str(self.python),'-I','-B','-u',str(Path(__file__).parents[1]/'face_eval_memory.py'),str(self.root),'--resident'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        except PermissionError:
            raise ModelUnavailableError('FACE_ENV_ACCESS_DENIED') from None
        except FileNotFoundError:
            raise ModelUnavailableError('FACE_ENV_UNAVAILABLE') from None
        with self.state_lock:
            rejected = self.closed or epoch != self.generation or cancelled.is_set()
            if not rejected:
                self.process = process
        if rejected:
            self._dispose(process)
            raise ModelUnavailableError('FACE_STOPPED')
        responses = queue.Queue(maxsize=2)
        self.responses = responses
        def read():
            try:
                while True:
                    line = process.stdout.readline(65537)
                    if not line or len(line)>65536 or not line.endswith(b'\n'):
                        break
                    responses.put_nowait(json.loads(line))
            except (OSError, ValueError, queue.Full):
                pass
            finally:
                try:
                    responses.put_nowait(None)
                except queue.Full:
                    pass
        threading.Thread(target=read, daemon=True).start()
        reply = self._receive(deadline, responses, epoch, cancelled, 'FACE_LOAD_TIMEOUT')
        if reply.get('ready') is not True:
            code = reply.get('code')
            raise ModelUnavailableError(code if code in ('FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED','FACE_PACKAGE_UNAVAILABLE') else 'FACE_WORKER_UNAVAILABLE')
        if reply.get('modelFingerprint') != pins['selected_model.joblib']:
            raise ModelUnavailableError('FACE_PACKAGE_UNAVAILABLE')
        self.pins = pins

    def _prepare(self, epoch, cancelled):
        import time
        self._check(epoch, cancelled)
        if self.process is not None and self.process.poll() is None:
            return
        for attempt in range(1, 6):
            self._publish(epoch, cancelled, state='loading', attempt=attempt, maxAttempts=5)
            try:
                self._start(time.monotonic()+FACE_LOAD_SECONDS, epoch, cancelled)
                self._publish(epoch, cancelled, state='ready', attempt=attempt, maxAttempts=5)
                return
            except Exception as error:
                self._discard()
                # Cancellation must preserve the newer unloaded state and cannot retry.
                self._check(epoch, cancelled)
                raw = str(error)
                from app.model.loading_policy import transient as transient_error
                transient = raw in ('FACE_LOAD_TIMEOUT','FACE_WORKER_UNAVAILABLE') or transient_error(error)
                permanent = ('FACE_STOPPED','FACE_PACKAGE_UNAVAILABLE','FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED','FACE_ENV_UNAVAILABLE')
                code = raw if raw in permanent or raw in ('FACE_LOAD_TIMEOUT','FACE_WORKER_UNAVAILABLE') else 'FACE_LOAD_FAILED'
                if not transient or attempt == 5:
                    self._publish(epoch, cancelled, state='failed', code=code, attempt=attempt, maxAttempts=5)
                    raise ModelUnavailableError(code) from None
                delay = FACE_RETRY_DELAYS[attempt-1]
                self._publish(epoch, cancelled, state='retrying', code=code, attempt=attempt, maxAttempts=5, retryInSeconds=delay)
                cancelled.wait(delay)
                self._check(epoch, cancelled)

    def prepare(self, cancelled=None, expected_generation=None):
        external = cancelled
        epoch, cancelled = self._identity()
        if expected_generation is not None and epoch != expected_generation:
            raise ModelUnavailableError('FACE_STOPPED')
        if external is not None:
            own = cancelled
            class LinkedCancellation:
                def is_set(self):
                    return own.is_set() or external.is_set()
                def wait(self, seconds):
                    import time
                    deadline = time.monotonic()+seconds
                    while not self.is_set() and time.monotonic()<deadline:
                        own.wait(min(.05, max(0, deadline-time.monotonic())))
                    return self.is_set()
            cancelled = LinkedCancellation()
        self._acquire(epoch, cancelled)
        try:
            self._prepare(epoch, cancelled)
            self._check(epoch, cancelled)
            return {"ready": True}
        except ModelUnavailableError:
            with self.state_lock:
                if epoch == self.generation and self.process is None and cancelled.is_set():
                    self.status = {"state": "unloaded"}
            raise
        finally:
            self.lock.release()

    def predict(self, encoded):
        import time, uuid
        if not isinstance(encoded, str) or len(encoded)>2796204:
            raise ValueError('Invalid capture size')
        try:
            data = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            raise ValueError('Invalid capture encoding') from None
        if not data or len(data)>LIMIT:
            raise ValueError('Invalid capture size')
        epoch, cancelled = self._identity()
        self._acquire(epoch, cancelled)
        try:
            self._prepare(epoch, cancelled)
            self._check(epoch, cancelled)
            identity = uuid.uuid4().hex
            packet = json.dumps({'id':identity,'audioImage':encoded}).encode()+b'\n'
            process, responses = self.process, self.responses
            def send():
                try:
                    process.stdin.write(packet); process.stdin.flush()
                except (OSError, ValueError):
                    pass
            threading.Thread(target=send, daemon=True).start()
            reply = self._receive(time.monotonic()+FACE_INFERENCE_SECONDS, responses, epoch, cancelled, 'FACE_INFERENCE_TIMEOUT')
            result = reply.get('result')
            if reply.get('id')!=identity or reply.get('error') or not isinstance(result,dict) or result.get('schemaVersion')!='echo-face-expression-v1' or result.get('status') not in ('available','unavailable') or result.get('modelFingerprint')!=self.pins['selected_model.joblib']:
                raise ModelUnavailableError('FACE_INFERENCE_FAILED')
            self._check(epoch, cancelled)
            return result
        except Exception as error:
            self._discard()
            self._check(epoch, cancelled)
            code = str(error)
            allowed = ('FACE_INFERENCE_TIMEOUT','FACE_INFERENCE_FAILED','FACE_WORKER_UNAVAILABLE','FACE_LOAD_TIMEOUT','FACE_LOAD_FAILED','FACE_PACKAGE_UNAVAILABLE','FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED','FACE_ENV_UNAVAILABLE')
            code = code if code in allowed else 'FACE_INFERENCE_FAILED'
            self._publish(epoch, cancelled, state='failed', code=code)
            raise ModelUnavailableError(code) from None
        finally:
            self.lock.release()
