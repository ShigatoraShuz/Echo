from dataclasses import dataclass
from pathlib import Path

from .config import Settings


@dataclass(frozen=True)
class ModelRuntime:
    model_name: str
    model_version: str
    adapter_path: str
    device: str
    ready: bool
    blocker: str

    @classmethod
    def load(cls, settings: Settings) -> "ModelRuntime":
        path = Path(settings.lora_adapter_path)
        if not path.exists():
            blocker = f"Required model adapter is absent at {path}."
        else:
            blocker = "Model artifacts exist, but the repository has no validated transformers/torch loader or clinical evaluation manifest."
        return cls(
            settings.base_model_id,
            settings.model_version,
            str(path),
            settings.device,
            False,
            blocker,
        )
