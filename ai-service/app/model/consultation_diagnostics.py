"""Configured, immutable diagnostic selection; never ordinary clinical serving."""

import json
import os
from pathlib import Path

from app.model.diagnostic import run_diagnostic
from app.model.manifest import ManifestError


def research_forward(runtime, text):
    settings = runtime.settings
    if (
        not (
            getattr(settings, "echo_local_research", False)
            or (settings.echo_consultation_demo and settings.app_env == "test")
        )
        or settings.echo_execution_mode != "real"
    ):
        raise ManifestError("RESEARCH_DEMO_DISABLED")
    identity = settings.echo_research_diagnostic_id
    if not identity:
        raise ManifestError("RESEARCH_DIAGNOSTIC_NOT_SELECTED")
    base = settings.echo_diagnostic_models_dir.resolve()
    matches = []
    candidates = []
    for directory, names, files in os.walk(base, followlinks=False):
        names[:] = [
            name
            for name in names
            if not (
                name.startswith(".")
                or name.lower().startswith(("tmp", "temp", "incomplete"))
                or name.lower().endswith((".tmp", ".partial", ".incomplete"))
                or (Path(directory) / name).is_symlink()
                or (Path(directory) / name).is_junction()
            )
        ]
        if "diagnostic-manifest.json" in files:
            candidates.append(Path(directory) / "diagnostic-manifest.json")
    for path in candidates:
        if (
            path.is_symlink()
            or not path.resolve().is_relative_to(base)
            or path.stat().st_size > 128000
        ):
            continue
        metadata = json.loads(path.read_text(encoding="utf8"))
        if f"{metadata.get('model_id')}@{metadata.get('version')}" == identity:
            matches.append(path.parent)
    if len(matches) != 1:
        raise ManifestError("DIAGNOSTIC_SELECTION_MISSING_OR_DUPLICATE")
    result = run_diagnostic(matches[0], settings, text)
    if (
        result["artifact_kind"] != "research_checkpoint"
        or not result.get("repeat_consistent")
        or result.get("raw_logits") is None
    ):
        raise ManifestError("COMPLETE_RAW_CLASSIFIER_REQUIRED")
    return {
        "executionState": "REAL_PROVISIONAL_MODEL",
        "modelId": result["model_id"],
        "modelVersion": result["version"],
        "labels": result["class_labels"],
        "rawLogits": result["raw_logits"],
        "inputTokens": result["input_tokens"],
        "maxInputTokens": result["max_tokens"],
        "windows": result["windows"],
        "calibrationApplied": False,
        "calibrationBinding": result["calibration_binding"],
        "preprocessingVerified": False,
        "classificationSemanticsVerified": False,
        "trainingReferenceParityVerified": False,
        "clinicalUseAllowed": False,
        "repeatConsistent": True,
        "validationAndLoadMs": result["validation_and_load_ms"],
        "forwardMs": result["classifier_forward_ms"],
    }
