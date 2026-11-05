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
        self.root = Path(os.environ.get("FACE_MODEL_DIR", str(Path(models_root).resolve() / "face_model"))).resolve()
        repo = Path(__file__).resolve().parents[3]
        self.python = Path(os.environ.get("FACE_PYTHON", str(repo / "ai-service/.venv-face/Scripts/python.exe")))
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


class ResidentFaceRuntime(FaceRuntime):
    """Resident CPU model; bounded NDJSON, no capture files or inherited secrets."""
    def __init__(self, models_root):
        super().__init__(models_root)
        self.generation=0
        self.status={"state":"unloaded"}

    def _discard(self):
        with self.state_lock:
            process=self.process;self.process=None
        if process:
            terminate_owned(process)
            for stream in (process.stdin,process.stdout):
                try:stream.close()
                except (OSError,ValueError):pass

    def unload(self):
        with self.state_lock:self.generation+=1
        self._discard()
        self.status={"state":"unloaded"}

    def close(self):
        with self.state_lock:self.closed=True
        self.unload()

    def _receive(self,deadline):
        import time,queue
        while time.monotonic()<deadline:
            if self.closed:raise ModelUnavailableError('FACE_STOPPED')
            try:
                reply=self.responses.get(timeout=.1)
                if not isinstance(reply,dict):raise ModelUnavailableError('FACE_WORKER_UNAVAILABLE')
                return reply
            except queue.Empty:continue
        raise ModelUnavailableError('FACE_LOAD_TIMEOUT')

    def _start(self,deadline):
        import queue
        pins=self.verify();self.pins=pins
        with self.state_lock:
            epoch=self.generation
            if self.closed:raise ModelUnavailableError('FACE_STOPPED')
        env={key:os.environ[key] for key in ('SYSTEMROOT','WINDIR','PATH','TEMP','TMP','COMSPEC','USERPROFILE','LOCALAPPDATA') if key in os.environ}
        env.update(PYTHONDONTWRITEBYTECODE='1',PYTHONIOENCODING='utf-8',CUDA_VISIBLE_DEVICES='-1')
        try:
            process=spawn_owned([str(self.python),'-I','-B','-u',str(Path(__file__).parents[1]/'face_eval_memory.py'),str(self.root),'--resident'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        except PermissionError:raise ModelUnavailableError('FACE_ENV_ACCESS_DENIED') from None
        except FileNotFoundError:raise ModelUnavailableError('FACE_ENV_UNAVAILABLE') from None
        with self.state_lock:
            rejected=self.closed or epoch!=self.generation
            if not rejected:self.process=process
        if rejected:terminate_owned(process);raise ModelUnavailableError('FACE_STOPPED')
        responses=queue.Queue(maxsize=2);self.responses=responses
        def read():
            try:
                while True:
                    line=process.stdout.readline(65537)
                    if not line or len(line)>65536 or not line.endswith(b'\n'):break
                    responses.put_nowait(json.loads(line))
            except (OSError,ValueError,queue.Full):pass
            finally:
                try:responses.put_nowait(None)
                except queue.Full:pass
        threading.Thread(target=read,daemon=True).start()
        reply=self._receive(deadline)
        if reply.get('ready') is not True:
            code=reply.get('code')
            raise ModelUnavailableError(code if code in ('FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED','FACE_PACKAGE_UNAVAILABLE') else 'FACE_WORKER_UNAVAILABLE')

    def _prepare(self):
        import time
        epoch=self.generation
        if self.process is not None and self.process.poll() is None:return
        for attempt in range(1,6):
            self.status={"state":"loading","attempt":attempt,"maxAttempts":5}
            try:
                self._start(time.monotonic()+120)
                if epoch!=self.generation:raise ModelUnavailableError('FACE_STOPPED')
                self.status={"state":"ready","attempt":attempt};return
            except Exception as error:
                self._discard()
                code=str(error)
                if epoch!=self.generation or self.closed or code in ('FACE_STOPPED','FACE_PACKAGE_UNAVAILABLE','FACE_ENV_IMPORT_FAILED','FACE_ENV_ACCESS_DENIED','FACE_ENV_UNAVAILABLE') or attempt==5:
                    self.status={"state":"failed","code":code};raise
                delay=(2,5,10,20)[attempt-1];self.status={"state":"retrying","attempt":attempt}
                until=time.monotonic()+delay
                while time.monotonic()<until:
                    if self.closed or epoch!=self.generation:raise ModelUnavailableError('FACE_STOPPED')
                    time.sleep(min(.1,max(0,until-time.monotonic())))

    def prepare(self):
        with self.lock:self._prepare()
        return {"ready":True}

    def predict(self,encoded):
        import time,uuid
        if not isinstance(encoded,str) or len(encoded)>2796204:raise ValueError('Invalid capture size')
        try:data=base64.b64decode(encoded,validate=True)
        except (ValueError,binascii.Error):raise ValueError('Invalid capture encoding') from None
        if not data or len(data)>LIMIT:raise ValueError('Invalid capture size')
        if not self.lock.acquire(timeout=90):raise ModelUnavailableError('FACE_BUSY')
        try:
            self._prepare();identity=uuid.uuid4().hex
            packet=json.dumps({'id':identity,'audioImage':encoded}).encode()+b'\n'
            process=self.process
            def send():
                try:process.stdin.write(packet);process.stdin.flush()
                except (OSError,ValueError):pass
            threading.Thread(target=send,daemon=True).start()
            reply=self._receive(time.monotonic()+90)
            result=reply.get('result')
            if reply.get('id')!=identity or reply.get('error') or not isinstance(result,dict) or result.get('schemaVersion')!='echo-face-expression-v1' or result.get('status') not in ('available','unavailable') or result.get('modelFingerprint')!=self.pins['selected_model.joblib']:raise ModelUnavailableError('FACE_INFERENCE_FAILED')
            return result
        except Exception:
            self._discard();raise
        finally:self.lock.release()
