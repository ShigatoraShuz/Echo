"""Explicit synthetic, offline selected-screening smoke."""

import json, os, time, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
os.environ.update(
    HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HOME=str(ROOT / "runtime-cache/hf")
)
from app.core.config import Settings
from app.model.core import CoreRuntime

runtime = CoreRuntime(Settings(core_models_enabled=True, models_root=str(ROOT / "models")))
results = []
try:
    for text in [
        "For two weeks I have trouble sleeping nearly every day and feel tired several days.",
        "Dalawang linggo na akong hirap matulog at madalas pagod.",
        "Hirap matulog lately, and I feel tired after school.",
        "For two weeks I have trouble sleeping nearly every day and feel tired several days.",
    ]:
        start = time.perf_counter()
        try:
            result = runtime.screening(text)
            results.append({"result": result, "seconds": time.perf_counter() - start})
        except Exception as e:
            results.append(
                {
                    "error": type(e).__name__,
                    "detail": str(e),
                    "seconds": time.perf_counter() - start,
                }
            )
            traceback.print_exc()
finally:
    runtime.release()
    (ROOT / "runtime-cache/screening-smoke.json").write_text(json.dumps(results, indent=2))
