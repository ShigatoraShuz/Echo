import json
from types import SimpleNamespace

import pytest

from app.model import consultation_diagnostics as module
from app.model.manifest import ManifestError


def runtime(root, **change):
    return SimpleNamespace(
        settings=SimpleNamespace(
            echo_consultation_demo=True,
            app_env="test",
            echo_execution_mode="real",
            echo_research_diagnostic_id="fictional-diagnostic@v1",
            echo_diagnostic_models_dir=root,
            **change,
        )
    )


def manifest(root, name="a"):
    directory = root / name
    directory.mkdir()
    (directory / "diagnostic-manifest.json").write_text(
        json.dumps({"model_id": "fictional-diagnostic", "version": "v1"})
    )


def test_missing_and_duplicate_selection_fail_before_loading_weights(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(module, "run_diagnostic", lambda *args: calls.append(args))
    with pytest.raises(ManifestError, match="MISSING_OR_DUPLICATE"):
        module.research_forward(runtime(tmp_path), "Fictional")
    manifest(tmp_path)
    manifest(tmp_path, "b")
    with pytest.raises(ManifestError, match="MISSING_OR_DUPLICATE"):
        module.research_forward(runtime(tmp_path), "Fictional")
    assert not calls


def test_not_selected_and_non_demo_modes_fail_closed(tmp_path):
    instance = runtime(tmp_path)
    instance.settings.echo_research_diagnostic_id = ""
    with pytest.raises(ManifestError, match="NOT_SELECTED"):
        module.research_forward(instance, "Fictional")
    instance.settings.echo_consultation_demo = False
    with pytest.raises(ManifestError, match="DISABLED"):
        module.research_forward(instance, "Fictional")


def test_selected_complete_raw_output_remains_uncalibrated_and_generic(tmp_path, monkeypatch):
    manifest(tmp_path)
    output = {
        "artifact_kind": "research_checkpoint",
        "repeat_consistent": True,
        "raw_logits": [1.0, 2.0, 3.0, 4.0, 5.0],
        "model_id": "fictional-diagnostic",
        "version": "v1",
        "class_labels": list("abcde"),
        "input_tokens": 10,
        "max_tokens": 384,
        "windows": 1,
        "calibration_binding": "unverified",
        "validation_and_load_ms": 1,
        "classifier_forward_ms": [1, 1],
    }
    monkeypatch.setattr(module, "run_diagnostic", lambda *args: output)
    result = module.research_forward(runtime(tmp_path), "Fictional")
    assert (
        result["modelId"] == "fictional-diagnostic" and result["rawLogits"] == output["raw_logits"]
    )
    assert result["calibrationApplied"] is result["clinicalUseAllowed"] is False
    assert "probabilities" not in result
    output["raw_logits"] = None
    with pytest.raises(ManifestError, match="COMPLETE_RAW_CLASSIFIER_REQUIRED"):
        module.research_forward(runtime(tmp_path), "Fictional")
