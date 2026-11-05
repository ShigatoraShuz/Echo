"""Bounded loading policy and allowlisted progress; never include model payloads."""
import math
import re

ATTEMPTS = 5
RETRY_DELAYS = (2, 5, 10, 20)
COMPONENT_SECONDS = {"cbt": 600, "nano": 300, "whisper": 180}
# Includes safety preparation, all component attempts/backoffs and scheduling margin.
# Ordinary generation deadlines remain unchanged.
PREPARATION_SECONDS = 6600
PREPARATION_TASKS = frozenset(("warm", "warm_chat", "warm_nano", "warm_whisper"))


def retryable(code):
    return not any(word in code for word in (
        "INTEGRITY", "IDENTITY", "ACCESS_DENIED", "ENV_IMPORT", "ENV_UNAVAILABLE",
        "CHECKPOINT", "CUDA", "MEMORY", "HEADROOM", "MISSING", "ASSET", "MISMATCH", "METADATA",
    ))


def safe_progress(value):
    """Rebuild, rather than forward, internal worker status packets."""
    if not isinstance(value, dict):
        return None
    if value.get("component") not in ("safety", "cbt", "nano", "whisper"):
        return None
    if value.get("state") not in ("checking", "loading", "warming", "retrying", "ready", "failed", "cancelled"):
        return None
    attempt = value.get("attempt")
    if type(attempt) is not int or not 1 <= attempt <= ATTEMPTS:
        return None
    result = {"component": value["component"], "state": value["state"], "attempt": attempt, "maxAttempts": ATTEMPTS}
    for name in ("elapsedSeconds", "retryInSeconds"):
        number = value.get(name)
        if type(number) in (int, float) and math.isfinite(number) and 0 <= number <= PREPARATION_SECONDS:
            result[name] = number
    components = value.get("loadingComponents")
    if isinstance(components, list) and len(components) <= 4 and all(name in ("safety","cbt","nano","whisper") for name in components):
        result["loadingComponents"] = list(dict.fromkeys(components))
    code = value.get("code")
    if isinstance(code, str) and re.fullmatch(r"BUDDY_[A-Z_]{1,70}", code):
        result["code"] = code
    if type(value.get("retryable")) is bool:
        result["retryable"] = value["retryable"]
    correlation = value.get("correlationId")
    if isinstance(correlation, str) and re.fullmatch(r"[a-f0-9]{32}", correlation):
        result["correlationId"] = correlation
    return result


class ParallelPreparation:
    """One CPU-only preparation branch with cancellation linked to its owner."""
    def __init__(self, prepare, parent=None):
        import threading
        import time
        self.stopped = threading.Event()
        self.done = threading.Event()
        self.value = None
        self.error = None
        owner = self
        class Cancellation:
            def is_set(self):
                return owner.stopped.is_set() or bool(parent and parent.is_set())
            def wait(self, seconds):
                deadline = time.monotonic() + seconds
                while not self.is_set():
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        return False
                    owner.stopped.wait(min(.05, remaining))
                return True
        self.cancelled = Cancellation()
        def run():
            try:
                self.value = prepare(self.cancelled)
            except BaseException as error:
                self.error = error
                self.stopped.set()
            finally:
                self.done.set()
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def result(self):
        from app.core.exceptions import TalkCancelledError
        while not self.done.wait(.05):
            if self.cancelled.is_set():
                raise TalkCancelledError("Cancelled")
        if self.error:
            raise self.error
        if self.cancelled.is_set():
            raise TalkCancelledError("Cancelled")
        return self.value

    def cancel_and_join(self):
        self.stopped.set()
        self.thread.join(timeout=5)
        return self.done.is_set()
