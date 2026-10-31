class ModelUnavailableError(RuntimeError):
    """Raised when a validated model runtime is not ready for inference."""


class TalkCancelledError(ModelUnavailableError):
    """A cancelled Talk generation; its warm model remains usable."""


class TalkBusyError(ModelUnavailableError):
    """A journal stage must wait for the active Talk reservation."""
