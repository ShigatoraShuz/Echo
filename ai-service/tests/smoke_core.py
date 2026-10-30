"""Explicit offline GPU smoke test (not part of default pytest)."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
for name, sub in [
    ("HF_HOME", "hf"),
    ("HF_HUB_CACHE", "hf/hub"),
    ("HF_XET_CACHE", "hf/xet"),
    ("TRITON_CACHE_DIR", "triton"),
    ("TORCHINDUCTOR_CACHE_DIR", "inductor"),
]:
    path = ROOT / "runtime-cache" / sub
    path.mkdir(parents=True, exist_ok=True)
    os.environ[name] = str(path)
os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_DATASETS_OFFLINE="1")
import json
import time

from app.core.config import Settings
from app.model.core import CoreRuntime


def main():
    runtime = CoreRuntime(Settings(core_models_enabled=True, models_root=str(ROOT / "models")))
    import torch

    torch.cuda.reset_peak_memory_stats()
    output = ROOT / "integration-backup/core-smoke.json"
    cases = [
        ("en", "I enjoyed lunch with a friend."),
        ("fil", "Masaya ako ngayon dahil kasama ko ang pamilya ko."),
        ("taglish", "Overwhelmed ako sa school at kailangan ko ng pahinga."),
    ]
    rows = []
    for language, text in cases:
        t = time.perf_counter()
        result = runtime.analyze(text, language)
        assert (
            len(result["emotionDistribution"]) == 8
            and abs(sum(x["value"] for x in result["emotionDistribution"]) - 1) < 0.001
        )
        assert result["depressiveSymptomRange"] is None
        rows.append(
            {
                "language": language,
                "elapsed_seconds": time.perf_counter() - t,
                "result": result,
                "peak_gpu_bytes": torch.cuda.max_memory_allocated(),
            }
        )
        output.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    t = time.perf_counter()
    chat = runtime.chat(
        [
            {
                "role": "user",
                "content": "I feel stressed about schoolwork. Can you help me choose one small next step?",
            }
        ]
    )
    rows.append({"chat": chat, "elapsed_seconds": time.perf_counter() - t})
    output.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    assert chat["reply"] or chat["supportRequired"]
    runtime.release()
    print("Offline core smoke passed", flush=True)


if __name__ == "__main__":
    main()
