"""Talk reservation and persistent speech; all GPU execution uses the core lock."""

import json
import os
import queue
import subprocess
import threading
import time
import uuid
from pathlib import Path

from app.core.exceptions import ModelUnavailableError, TalkCancelledError


class TalkRuntime:
    def __init__(self, core):
        self.core = core
        self.owner = None
        self.deadline = 0
        self.cpu_classifier = None
        self.process = None
        self.responses = queue.Queue(maxsize=2)
        self.process_lock = threading.Lock()
        self.device = "cuda"
        self.closed = False
        self.watchdog = threading.Thread(target=self._watch, daemon=True)
        self.watchdog.start()

    def _watch(self):
        while not self.closed:
            time.sleep(1)
            if self.core.lock.acquire(blocking=False):
                try:
                    if self.owner and time.monotonic() > self.deadline:
                        self.stop(self.owner)
                finally:
                    self.core.lock.release()

    def require(self, session):
        if not self.owner or self.owner != session:
            raise ModelUnavailableError("Talk is not active")
        self.deadline = time.monotonic() + 60

    def start(self, session):
        import torch

        with self.core.lock:
            if self.owner and self.owner != session:
                raise ModelUnavailableError("Talk is busy")
            self.owner = session
            self.deadline = time.monotonic() + 60
            try:
                if self.cpu_classifier is None:
                    from app.vendor.xlmr.classifier import Classifier

                    self.core.release()
                    classifier = Classifier(str(self.core.root / "xlmr-v2"), stride=64)
                    classifier.model.to("cpu")
                    classifier.device = torch.device("cpu")
                    self.cpu_classifier = classifier
                    torch.cuda.empty_cache()
                torch.set_num_threads(min(8, os.cpu_count() or 1))
                self.cpu_classifier.classify("Today was a quiet day.")
                model, tokenizer = self.core._load("cbt")
                with torch.inference_mode():
                    model.generate(
                        **tokenizer("Warmup.", return_tensors="pt").to("cuda"),
                        max_new_tokens=1,
                        do_sample=False,
                        pad_token_id=tokenizer.pad_token_id,
                    )
                try:
                    ready = self._request({"task": "ready"})
                except (ModelUnavailableError, OSError, ValueError):
                    self._kill()
                    self.device = "cpu"
                    ready = self._request({"task": "ready"})
                if torch.cuda.mem_get_info()[0] < 2 * 1024**3:
                    self._kill()
                    self.device = "cpu"
                    ready = self._request({"task": "ready"})
                if torch.cuda.mem_get_info()[0] < 2 * 1024**3:
                    raise ModelUnavailableError("Insufficient GPU headroom")
                self.deadline = time.monotonic() + 60
                return {
                    "ready": True,
                    "speech": ready,
                    "freeGpuBytes": torch.cuda.mem_get_info()[0],
                }
            except Exception:
                self._kill()
                self.owner = None
                self.core.release()
                raise

    def _ensure_worker(self):
        if self.process and self.process.poll() is None:
            return
        python = Path(
            os.environ.get(
                "TALK_PYTHON", str(self.core.root.parent / "speech-venv/Scripts/python.exe")
            )
        )
        self.responses = queue.Queue(maxsize=2)
        self.process = subprocess.Popen(
            [
                str(python),
                "-B",
                str(Path(__file__).parents[1] / "talk_worker.py"),
                str(self.core.root / "voice"),
                self.device,
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        process = self.process
        responses = self.responses

        def read():
            try:
                for line in process.stdout:
                    responses.put_nowait(json.loads(line))
            except (OSError, ValueError, queue.Full):
                pass

        threading.Thread(target=read, daemon=True).start()

    def _request(self, payload, cancelled=None):
        with self.process_lock:
            self._ensure_worker()
            request_id = str(uuid.uuid4())
            self.process.stdin.write(json.dumps({"id": request_id, **payload}) + "\n")
            self.process.stdin.flush()
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                try:
                    response = self.responses.get(timeout=0.1)
                except queue.Empty:
                    if self.process.poll() is not None:
                        break
                    continue
                if response.get("id") != request_id or response.get("error"):
                    break
                if cancelled and cancelled.is_set():
                    raise TalkCancelledError("Cancelled")
                return response["result"]
            self._kill()
            raise ModelUnavailableError("Persistent speech is unavailable")

    def speech(self, session, payload, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            return self._request(payload, cancelled)

    def chat(self, session, messages, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            model = self.core._load("cbt")[0]
            original = model.generate
            from transformers import StoppingCriteria, StoppingCriteriaList

            class Cancel(StoppingCriteria):
                def __call__(self, *args, **kwargs):
                    return bool(cancelled and cancelled.is_set())

            def generate(*args, **kwargs):
                if cancelled and cancelled.is_set():
                    raise TalkCancelledError("Cancelled")
                kwargs["stopping_criteria"] = StoppingCriteriaList(
                    [*kwargs.get("stopping_criteria", []), Cancel()]
                )
                return original(*args, **kwargs)

            model.generate = generate
            try:
                self.core._talk_context.active = True
                self.core._talk_classifier = self.cpu_classifier
                result = self.core.chat(messages)
                if cancelled and cancelled.is_set():
                    raise TalkCancelledError("Cancelled")
                return result
            finally:
                model.generate = original
                self.core._talk_classifier = None
                self.core._talk_context.active = False

    def _kill(self):
        process = self.process
        if process:
            if process.poll() is None:
                process.kill()
            process.wait()
            process.stdin.close()
            process.stdout.close()
        self.process = None

    def stop(self, session):
        with self.core.lock:
            if self.owner != session:
                return
            self._kill()
            self.owner = None
            self.core.release()

    def close(self):
        self.closed = True
        if self.owner:
            self.stop(self.owner)
