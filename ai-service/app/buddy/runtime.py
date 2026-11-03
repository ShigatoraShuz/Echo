"""Buddy residency uses the existing CoreRuntime lock and yields to its scheduler."""
import threading
import time
from app.buddy.config import paths
from app.buddy.process import Process
from app.core.exceptions import ModelUnavailableError, TalkCancelledError, TalkBusyError

class BuddyRuntime:
    device = "cuda"

    def __init__(self, core):
        self.core = core
        self.owner = None
        self.deadline = 0
        self.cpu_classifier = None
        self.workers = {}
        self.ready = False
        self.status = {"ready": False, "code": "BUDDY_NOT_LOADED"}
        self.closed = False
        threading.Thread(target=self._watch, daemon=True).start()

    @property
    def process(self):
        worker = self.workers.get("nano")
        return worker.process if worker else None

    def _watch(self):
        while not self.closed:
            time.sleep(1)
            if self.core.lock.acquire(blocking=False):
                try:
                    if self.ready and not self.healthy():
                        self.evict()
                        self.status = {"ready": False, "code": "BUDDY_WORKER_LOST"}
                    if self.owner and time.monotonic() > self.deadline:
                        self.stop(self.owner)
                finally:
                    self.core.lock.release()

    def healthy(self):
        return all(kind in self.workers and self.workers[kind].process.poll() is None
                   for kind in ("cbt", "nano", "whisper"))

    def require(self, session):
        if not self.owner or self.owner != session:
            raise ModelUnavailableError("BUDDY_TALK_NOT_ACTIVE")
        self.deadline = time.monotonic() + 60

    def evict(self):
        self.ready = False
        for kind in ("cbt", "nano"):
            worker = self.workers.pop(kind, None)
            if worker:
                worker.close()
        self.status = {"ready": False, "code": "BUDDY_NOT_LOADED"}

    def _worker(self, kind, request, cancelled=None):
        if cancelled and cancelled.is_set():
            raise TalkCancelledError("Cancelled")
        if kind not in self.workers:
            self.workers[kind] = Process(paths()[kind], kind, cancelled)
        try:
            return self.workers[kind].call(request, cancelled)
        except Exception:
            failed = self.workers.pop(kind, None)
            if failed:
                failed.close()
            # A cancelled or failed GPU worker must warm again before listening.
            self.evict()
            raise

    def _classifier(self):
        if self.cpu_classifier is None:
            import torch
            from app.vendor.xlmr.classifier import Classifier
            self.core.release()
            classifier = Classifier(str(self.core.root / "xlmr-v2"), stride=64)
            classifier.model.to("cpu")
            classifier.device = torch.device("cpu")
            self.cpu_classifier = classifier
            torch.cuda.empty_cache()
        return self.cpu_classifier

    def generate(self, messages, cancelled=None):
        with self.core.lock:
            # Same frozen classifier/calibration as main, before any Buddy generation.
            classification = self._classifier().classify(messages[-1]["content"])
            if classification["suicidal_language_flag"]:
                return {"reply": None, "supportRequired": True, "model": self.core.provenance("xlmr")}
            self.core.release() if self.core.instance is not None else None
            value = self._worker("cbt", {"messages": messages}, cancelled)
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            if value.get("withheld") or not value.get("reply"):
                raise ModelUnavailableError("BUDDY_RESPONSE_WITHHELD")
            return {"reply": value["reply"], "supportRequired": False, "model": value["model"],
                    "quality": {**value.get("quality", {}), "generationSeconds": value["seconds"]}}

    def start(self, session, cancelled=None):
        with self.core.lock:
            if self.owner and self.owner != session:
                raise TalkBusyError("Talk is busy")
            self.owner = session
            try:
                started = time.perf_counter()
                self._classifier()
                if self.ready and not self.healthy():
                    self.evict()
                if not self.ready:
                    self.core.release()
                    self._worker("cbt", {"check": True}, cancelled)
                    self._worker("nano", {"check": True}, cancelled)
                    self._worker("whisper", {"check": True}, cancelled)
                    self._worker("cbt", {"messages": [{"role": "user", "content": "I feel overwhelmed by schoolwork."}]}, cancelled)
                    warm = self._worker("nano", {"texts": ["You can take one slow breath."] * 3}, cancelled)
                    if warm["freeGpuBytes"] < 2 * 1024**3:
                        raise ModelUnavailableError("BUDDY_INSUFFICIENT_GPU_HEADROOM")
                    self.ready = True
                    self.status = {"ready": True, "freeGpuBytes": warm["freeGpuBytes"],
                                   "loadAndWarmSeconds": time.perf_counter() - started,
                                   "workers": {k: v.process.pid for k, v in self.workers.items()}}
                self.deadline = time.monotonic() + 60
                return {**self.status, "speech": {"model": {"whisperDevice": "cpu"}}}
            except Exception as exc:
                self.evict()
                self.owner = None
                code = str(exc)
                self.status = {"ready": False, "code": code if code.startswith("BUDDY_") else "BUDDY_PREFLIGHT_FAILED"}
                raise ModelUnavailableError(self.status["code"]) from None

    def chat(self, session, messages, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            if not self.ready:
                self.start(session, cancelled)
            result = self.generate(messages, cancelled)
            self.require(session)
            return result

    def speech(self, session, payload, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            if not self.ready:
                self.start(session, cancelled)
            task = payload["task"]
            kind = "whisper" if task == "transcribe" else "nano"
            result = self._worker(kind, payload, cancelled)
            self.require(session)
            return result

    def dispatch(self, session, payload, cancelled=None):
        task = payload["task"]
        if task == "unload":
            with self.core.lock:
                if self.owner:
                    raise TalkBusyError("BUDDY_TALK_BUSY")
                self.evict()
                worker = self.workers.pop("whisper", None)
                if worker:
                    worker.close()
                self.cpu_classifier = None
                return {"unloaded": True}
        if task == "warm":
            return self.start(session, cancelled)
        if task == "close":
            self.stop(session)
            return {"closed": True}
        self.require(session)
        if task == "pulse":
            if not self.ready or not self.healthy():
                raise ModelUnavailableError("BUDDY_WORKER_LOST")
            return {"active": True}
        if task == "chat":
            return self.chat(session, payload["messages"], cancelled)
        if task == "support_check":
            with self.core.lock:
                return self._classifier().classify(payload["text"])
        if task == "prepare":
            from app.buddy.text_audio import prepare
            from app.buddy.sentences import sentences, batches
            from app.buddy.segmenting import speech_segments
            text = prepare(payload["text"], payload.get("language", "English"))
            parts = sentences(text) if payload.get("speechMode") == "sentences_2_then_3" else speech_segments(text)
            groups = list(batches(parts)) if payload.get("speechMode") == "sentences_2_then_3" else [[part] for part in parts]
            if "".join(parts) != text:
                raise ValueError("Speech coverage failed")
            return {"preparedText": text, "groups": groups}
        if task in ("transcribe", "speak"):
            return self.speech(session, payload, cancelled)
        raise ValueError("Unsupported Buddy task")

    def stop(self, session):
        # Conversation release must not discard healthy process-wide model weights.
        with self.core.lock:
            if self.owner == session:
                self.owner = None

    def close(self):
        self.closed = True
        self.owner = None
        self.evict()
        worker = self.workers.pop("whisper", None)
        if worker:
            worker.close()

