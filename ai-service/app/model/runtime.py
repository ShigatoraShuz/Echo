from dataclasses import dataclass
from pathlib import Path

from app.core.config import Settings
from app.core.exceptions import ModelUnavailableError


@dataclass(frozen=True)
class ModelRuntime:
    model_name: str
    model_version: str
    adapter_path: str
    device: str
    max_input_tokens: int
    loaded: bool

    @classmethod
    def from_settings(cls, settings: Settings) -> "ModelRuntime":
        # Artifact presence alone is not evidence that a model is safe to serve.
        # A validated loader must explicitly replace this scaffolding.
        _artifact_path_exists = Path(settings.lora_adapter_path).exists()
        return cls(
            model_name=settings.base_model_id,
            model_version=settings.model_version,
            adapter_path=settings.lora_adapter_path,
            device=settings.device,
            max_input_tokens=settings.max_input_tokens,
            loaded=False,
        )

    def require_ready(self) -> None:
        if not self.loaded:
            raise ModelUnavailableError("Validated model runtime is not ready.")
