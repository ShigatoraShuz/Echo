"""Explicit synthetic CPU/GPU parity probe; run without other GPU jobs."""

import hashlib
import json
import os
import time
from pathlib import Path

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
import torch

from app.vendor.xlmr.classifier import Classifier

root = Path(__file__).resolve().parents[3]
torch.set_num_threads(8)
cases = [
    ("neutral-en", "en", "Today I took a short walk and finished my homework."),
    ("distress-en", "en", "I feel overwhelmed and tired after classes."),
    ("concern-en", "en", "I want to hurt myself tonight."),
    ("negation-en", "en", "I do not want to hurt myself. I am discussing a quotation in a story."),
    (
        "quotation-en",
        "en",
        'The fictional character said, "I want to die." This is a quotation from a story.',
    ),
    ("neutral-fil", "fil", "Masaya ang araw ko ngayon at naglakad ako sa parke."),
    ("concern-taglish", "taglish", "Feeling lost ako ngayon at naiisip kong saktan ang sarili ko."),
    (
        "long-en",
        "en",
        ("Today I wrote notes about the weather and my schoolwork. " * 90)
        + 'The fictional character said, "I want to die." This is a quotation from a story.',
    ),
    ("empty", "unknown", ""),
]
started = time.perf_counter()
classifier = Classifier(str(root / "models/xlmr-v2"), stride=64)
load_ms = (time.perf_counter() - started) * 1000
rows = []
for device in ["cpu", "cuda"]:
    classifier.model.to(device)
    classifier.device = torch.device(device)
    for i, (name, language, text) in enumerate(cases):
        started = time.perf_counter()
        result = classifier.classify(text, language=language)
        if device == "cuda":
            torch.cuda.synchronize()
        if device == "cpu":
            rows.append(
                {
                    "case": name,
                    "language": language,
                    "cpu": result,
                    "cpuMs": (time.perf_counter() - started) * 1000,
                }
            )
        else:
            row = rows[i]
            row["gpu"] = result
            row["gpuMs"] = (time.perf_counter() - started) * 1000
            row["sameCategory"] = row["cpu"].get("distress_category") == result.get(
                "distress_category"
            )
            row["sameFlag"] = row["cpu"].get("suicidal_language_flag") == result.get(
                "suicidal_language_flag"
            )
            row["sameRoute"] = row["cpu"].get("safety_status") == result.get(
                "safety_status"
            ) and row["cpu"].get("safety_route") == result.get("safety_route")
            row["maxScoreDifference"] = max(
                [
                    abs(value - result["all_category_scores_relative_not_diagnoses"][label])
                    for label, value in row["cpu"]
                    .get("all_category_scores_relative_not_diagnoses", {})
                    .items()
                ],
                default=0,
            )
assert all(
    r["sameCategory"] and r["sameFlag"] and r["sameRoute"] and r["maxScoreDifference"] <= 0.00003
    for r in rows
)
output = {
    "passed": True,
    "loadMs": load_ms,
    "maxLength": 384,
    "stride": 64,
    "calibrationHash": hashlib.sha256(
        (root / "models/xlmr-v2/calibration/calibration.json").read_bytes()
    ).hexdigest(),
    "cases": rows,
    "scope": "Synthetic device parity only; no safety or clinical accuracy claim; frozen calibration unchanged",
}
(root / "runtime-cache/talk-parity.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
print(
    "PASS",
    len(rows),
    "synthetic CPU/GPU parity cases; max score delta",
    max(r["maxScoreDifference"] for r in rows),
)
