"""Interactive requests precede background work at stage boundaries."""
import threading
import time

class PriorityGate:
    def __init__(self):
        self.condition = threading.Condition()
        self.busy = False
        self.interactive_waiters = 0

    def acquire(self, timeout=-1, *, interactive=False):
        deadline = None if timeout < 0 else time.monotonic() + timeout
        with self.condition:
            if interactive:
                self.interactive_waiters += 1
            try:
                while self.busy or (not interactive and self.interactive_waiters):
                    remaining = None if deadline is None else deadline - time.monotonic()
                    if remaining is not None and remaining <= 0:
                        return False
                    self.condition.wait(remaining)
                self.busy = True
                return True
            finally:
                if interactive:
                    self.interactive_waiters -= 1
                self.condition.notify_all()

    def release(self):
        with self.condition:
            self.busy = False
            self.condition.notify_all()
