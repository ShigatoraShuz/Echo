"""Buddy residency uses the existing CoreRuntime lock and yields to its scheduler."""
import threading
import time
from app.buddy.config import paths
from app.buddy.process import Process
from app.buddy.loading import ATTEMPTS, RETRY_DELAYS, COMPONENT_SECONDS, retryable, ParallelPreparation
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
        self.progress_lock = threading.RLock()
        self.loading_generation = 0
        self.whisper_preparation = None
        self.component_status = {}
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
                        self.stop_speech()
                        cbt = self.workers.get("cbt")
                        if cbt and cbt.process.poll() is not None:
                            self.workers.pop("cbt", None)
                            cbt.close()
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

    def _worker(self, kind, request, cancelled=None, *, deadline=None):
        if cancelled and cancelled.is_set():
            raise TalkCancelledError("Cancelled")
        if getattr(self, "closed", False):
            raise TalkCancelledError("Cancelled")
        if kind not in self.workers:
            worker = Process(paths()[kind], kind, cancelled, **({"deadline":deadline} if deadline else {}))
            with getattr(self, "progress_lock", self.core.lock):
                rejected = getattr(self, "closed", False) or (cancelled and cancelled.is_set())
                if not rejected:
                    self.workers[kind] = worker
            if rejected:
                worker.close()
                raise TalkCancelledError("Cancelled")
        try:
            return self.workers[kind].call(request, cancelled, **({"deadline":deadline} if deadline else {}))
        except Exception:
            failed = self.workers.pop(kind, None)
            if failed:
                failed.close()
            # A cancelled or failed GPU worker must warm again before listening.
            self.ready = False
            raise

    def _publish(self, component, state, attempt=1, **fields):
        generation = fields.pop("_generation", None)
        # Progress can arrive from CPU preparation while Nano owns the GPU lane.
        with self.progress_lock:
            if generation is not None and generation != self.loading_generation:
                return
            self.status = {"ready": False, "component": component, "state": state,
                           "attempt": attempt, "maxAttempts": ATTEMPTS, **fields}
            self.component_status[component] = state
            self.status["loadingComponents"] = [name for name,state in self.component_status.items()
                                                if state in ("checking","loading","warming","retrying")]
            callback = getattr(self, "progress", None)
            if callback:
                callback(dict(self.status))

    def _prepare(self, kind, cancelled=None):
        started = time.monotonic()
        generation = self.loading_generation
        def publish(state, attempt, **fields):
            self._publish(kind, state, attempt, _generation=generation, **fields)
        for attempt in range(1, ATTEMPTS + 1):
            if cancelled and cancelled.is_set():
                raise TalkCancelledError("Cancelled")
            publish("loading", attempt, elapsedSeconds=time.monotonic()-started)
            deadline = time.monotonic() + COMPONENT_SECONDS[kind]
            try:
                result = self._worker(kind, {"check": True}, cancelled, deadline=deadline)
                if kind == "nano":
                    publish("warming", attempt, elapsedSeconds=time.monotonic()-started)
                    result = self._worker(kind, {"texts": ["You can take one slow breath."]}, cancelled, deadline=deadline)
                    if result["freeGpuBytes"] < 2 * 1024**3:
                        raise ModelUnavailableError("BUDDY_INSUFFICIENT_GPU_HEADROOM")
                if cancelled and cancelled.is_set():
                    raise TalkCancelledError("Cancelled")
                publish("ready", attempt, elapsedSeconds=time.monotonic()-started)
                return result
            except TalkCancelledError:
                publish("cancelled", attempt, elapsedSeconds=time.monotonic()-started)
                raise
            except Exception as error:
                code = str(error)
                transient = retryable(code)
                failed = self.workers.pop(kind, None)
                if failed:
                    failed.close()
                if attempt == ATTEMPTS or not transient:
                    publish("failed", attempt, code=code, retryable=transient,
                                  elapsedSeconds=time.monotonic()-started)
                    raise
                delay = RETRY_DELAYS[attempt - 1]
                publish("retrying", attempt, code=code, retryable=True,
                              retryInSeconds=delay, elapsedSeconds=time.monotonic()-started)
                if cancelled:
                    if cancelled.wait(delay):
                        publish("cancelled", attempt, elapsedSeconds=time.monotonic()-started)
                        raise TalkCancelledError("Cancelled")
                else:
                    time.sleep(delay)

    def stop_speech(self):
        self.ready = False
        for kind in ("nano", "whisper"):
            worker = self.workers.pop(kind, None)
            if worker: worker.close()

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

    def start(self, session, cancelled=None, speech=True):
        with self.core.lock:
            cbt = self.workers.get("cbt")
            if not speech and cbt and cbt.process.poll() is None:
                return {"ready": True, "chatReady": True, "speechReady": self.ready,
                        "workers": {k: v.process.pid for k, v in self.workers.items()}}
            if self.owner and self.owner != session:
                raise TalkBusyError("Talk is busy")
            pending = self.whisper_preparation
            if pending and not pending.done.is_set():
                raise ModelUnavailableError("BUDDY_WHISPER_RECOVERY_PENDING")
            self.loading_generation += 1
            self.component_status = {}
            self.owner = session
            parallel = None
            try:
                started = time.perf_counter()
                self._publish("safety", "checking")
                self._classifier()
                self._publish("safety", "ready")
                cbt = self.workers.get("cbt")
                if cbt is None or cbt.process.poll() is not None:
                    self.core.release()
                    self._prepare("cbt", cancelled)
                if speech and (not self.ready or not self.healthy()):
                    parallel = ParallelPreparation(lambda signal:self._prepare("whisper", signal), cancelled)
                    self.whisper_preparation = parallel
                    warm = self._prepare("nano", parallel.cancelled)
                    parallel.result()
                    if cancelled and cancelled.is_set():
                        raise TalkCancelledError("Cancelled")
                    self.free_gpu_bytes = warm["freeGpuBytes"]
                    self.ready = True
                self.status = {"ready": True, "chatReady": True, "speechReady": self.ready,
                               **({"freeGpuBytes":self.free_gpu_bytes} if speech and getattr(self,"free_gpu_bytes",None) is not None else {}),
                               "loadAndWarmSeconds": time.perf_counter() - started,
                               "workers": {k: v.process.pid for k, v in self.workers.items()}}
                self.deadline = time.monotonic() + 60
                return {**self.status, "speech": {"model": {"whisperDevice": "cpu"}}}
            except TalkCancelledError:
                if parallel: parallel.cancel_and_join()
                self.loading_generation += 1
                self.stop_speech()
                self.owner = None
                if parallel and parallel.error and not isinstance(parallel.error, TalkCancelledError) and not (cancelled and cancelled.is_set()):
                    code = str(parallel.error)
                    self.status = {"ready":False,"code":code if code.startswith("BUDDY_") else "BUDDY_WHISPER_PREFLIGHT_FAILED"}
                    raise ModelUnavailableError(self.status["code"]) from None
                raise
            except Exception as exc:
                if parallel: parallel.cancel_and_join()
                self.loading_generation += 1
                self.stop_speech()
                self.owner = None
                code = str(exc)
                self.status = {"ready": False, "code": code if code.startswith("BUDDY_") else "BUDDY_PREFLIGHT_FAILED"}
                raise ModelUnavailableError(self.status["code"]) from None

    def chat(self, session, messages, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            if not self.ready:
                self.start(session, cancelled, speech=False)
            result = self.generate(messages, cancelled)
            self.require(session)
            return result

    def speech(self, session, payload, cancelled=None):
        self.require(session)
        with self.core.lock:
            self.require(session)
            task = payload["task"]
            kind = "whisper" if task == "transcribe" else "nano"
            worker = self.workers.get(kind)
            if worker is None or worker.process.poll() is not None:
                self._prepare(kind, cancelled)
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
        if task in ("warm_nano", "warm_whisper"):
            with self.core.lock:
                pending = self.whisper_preparation
                if pending and not pending.done.is_set():
                    raise ModelUnavailableError("BUDDY_WHISPER_RECOVERY_PENDING")
                if self.owner and self.owner != session: raise TalkBusyError("Talk is busy")
                self.owner = session
                self.deadline = time.monotonic() + 60
                self._prepare("nano" if task == "warm_nano" else "whisper", cancelled)
                self.deadline = time.monotonic() + 60
                return {"ready": True}
        if task == "warm_chat":
            return self.start(session, cancelled, speech=False)
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
                self.stop_speech()

    def close(self):
        with self.progress_lock:
            self.closed = True
            self.loading_generation += 1
        if self.whisper_preparation: self.whisper_preparation.cancel_and_join()
        self.owner = None
        self.evict()
        worker = self.workers.pop("whisper", None)
        if worker:
            worker.close()

