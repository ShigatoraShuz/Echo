"""Random tiny fixtures only. Actual checkpoint diagnostics are recorded separately."""

import json
import shutil
from collections import OrderedDict

import pytest
import torch
from safetensors.torch import load_file, save_file
from test_research_adapters import (
    bundle,  # noqa: F401 -- reuse existing fictional tokenizer factory
)

from app.core.config import Settings
from app.model.diagnostic import run_diagnostic, validate_diagnostic
from app.model.manifest import ManifestError
from app.model.registry import ModelRegistry
from app.model.research_conversion import convert_e4_heads, restricted_e4_heads, sha256
from app.model.weight_normalization import normalize_weights, normalized_tensor_map


def write_json(path, value):
    path.write_text(json.dumps(value), encoding="utf8")


def legacy_state(state):
    output = {}
    for key, value in state.items():
        if key.endswith(".LayerNorm.weight"):
            key = key[:-6] + "gamma"
        elif key.endswith(".LayerNorm.bias"):
            key = key[:-4] + "beta"
        output[key] = value.clone()
    return output


@pytest.mark.parametrize("kind", ["e4", "xlmr"])
def test_architecture_normalization_is_lossless_complete_and_immutable(bundle, tmp_path, kind):  # noqa: F811 -- imported pytest fixture
    source, _ = bundle(kind)
    config_path = source / ("encoder/config.json" if kind == "e4" else "config.json")
    config = json.loads(config_path.read_text())
    architecture = config["architectures"][0]
    weights = config_path.parent / "model.safetensors"
    canonical = load_file(weights)
    # Existing E4 fixture excludes the pooler; make the test's encoder include it
    # explicitly to match the actual inspected RobertaModel export profile.
    if kind == "e4":
        from transformers import RobertaConfig, RobertaModel

        canonical = RobertaModel(
            RobertaConfig.from_dict(config), add_pooling_layer=True
        ).state_dict()
    legacy = tmp_path / "legacy.safetensors"
    save_file(legacy_state(canonical), legacy)
    original_sha = sha256(legacy)
    target = tmp_path / "normalized.safetensors"
    report = normalize_weights(legacy, target, config, architecture, original_sha)
    assert report["tensor_values_preserved"] and report["complete_tensor_coverage"]
    assert report["source_tensor_payload_sha256"] == report["destination_tensor_payload_sha256"]
    assert len(report["key_map"]) == 6
    normalized = load_file(target)
    assert set(normalized) == set(canonical)
    for key in canonical:
        torch.testing.assert_close(normalized[key], canonical[key], rtol=0, atol=0)
    assert sha256(legacy) == original_sha
    with pytest.raises(ManifestError, match="DESTINATION_MUST_BE_NEW"):
        normalize_weights(legacy, target, config, architecture, original_sha)


@pytest.mark.parametrize("fault", ["collision", "missing", "unexpected", "shape", "ambiguous"])
def test_normalization_rejects_incomplete_ambiguous_and_mismatched_tensors(fault):
    expected = {
        "embeddings.LayerNorm.weight": torch.empty(4, device="meta"),
        "embeddings.LayerNorm.bias": torch.empty(4, device="meta"),
    }
    actual = {"embeddings.LayerNorm.gamma": [4], "embeddings.LayerNorm.beta": [4]}
    if fault == "collision":
        actual["embeddings.LayerNorm.weight"] = [4]
    elif fault == "missing":
        del actual["embeddings.LayerNorm.gamma"]
    elif fault == "unexpected":
        actual["classifier.gamma"] = [4]
    elif fault == "shape":
        actual["embeddings.LayerNorm.gamma"] = [5]
    else:
        actual["not_roberta.LayerNorm.gamma"] = actual.pop("embeddings.LayerNorm.gamma")
    with pytest.raises(ManifestError):
        normalized_tensor_map(actual, expected, "RobertaModel")


def nested_source(tmp_path, hidden=4):
    labels = {
        "plutchik": [f"fixture_emotion_{i}" for i in range(8)],
        "goemotions": [f"fixture_aux_{i}" for i in range(27)],
    }
    state = {
        name: OrderedDict(weight=torch.randn(len(values), hidden), bias=torch.randn(len(values)))
        for name, values in labels.items()
    }
    source = tmp_path / "heads.pt"
    torch.save(state, source)
    return source, labels, state


def test_nested_conversion_preserves_all_values_labels_and_head_identity(tmp_path):
    source, labels, state = nested_source(tmp_path)
    source_hash = sha256(source)
    target = tmp_path / "heads.safetensors"
    report = convert_e4_heads(source, target, source_hash, labels, 4)
    actual = load_file(target)
    assert report["ordered_head_labels"] == labels and report["tensor_values_preserved"]
    assert set(actual) == {
        "plutchik.weight",
        "plutchik.bias",
        "goemotions.weight",
        "goemotions.bias",
    }
    for head, values in state.items():
        for name, value in values.items():
            torch.testing.assert_close(actual[f"{head}.{name}"], value, rtol=0, atol=0)
    assert sha256(source) == source_hash
    with pytest.raises(ManifestError, match="DESTINATION_MUST_BE_NEW"):
        convert_e4_heads(source, target, source_hash, labels, 4)


@pytest.mark.parametrize(
    "fault", ["missing", "extra", "shape", "extra_tensor", "nan", "label_count"]
)
def test_nested_converter_never_drops_extra_heads_or_guesses_shape(tmp_path, fault):
    source, labels, state = nested_source(tmp_path)
    if fault == "missing":
        del state["goemotions"]
    elif fault == "extra":
        state["optimizer"] = {}
    elif fault == "shape":
        state["plutchik"]["weight"] = torch.zeros(8, 5)
    elif fault == "extra_tensor":
        state["plutchik"]["projection"] = torch.zeros(2)
    elif fault == "nan":
        state["plutchik"]["bias"][0] = float("nan")
    else:
        labels["goemotions"] = labels["goemotions"][:-1]
    torch.save(state, source)
    with pytest.raises(ManifestError):
        restricted_e4_heads(source, sha256(source), labels, 4)


@pytest.fixture
def diagnostic_bundle(bundle, tmp_path):  # noqa: F811 -- imported pytest fixture
    def create(kind="xlmr"):
        source, _ = bundle(kind)
        target = tmp_path / (kind + "-diagnostic")
        target.mkdir()
        config_path = source / ("encoder/config.json" if kind == "e4" else "config.json")
        config = json.loads(config_path.read_text())
        shutil.copyfile(config_path, target / "config.json")
        for name in ("tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"):
            if (source / name).is_file():
                shutil.copyfile(source / name, target / name)
        from transformers import AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(target, local_files_only=True)
        tokenizer.backend_tokenizer.enable_truncation(max_length=16)
        tokenizer.save_pretrained(target)
        architecture = config["architectures"][0]
        weights = config_path.parent / "model.safetensors"
        if kind == "e4":
            from transformers import RobertaConfig, RobertaModel

            original = tmp_path / "e4-pooler-source.safetensors"
            save_file(
                RobertaModel(RobertaConfig.from_dict(config), add_pooling_layer=True).state_dict(),
                original,
            )
            weights = original
        report = normalize_weights(
            weights, target / "model.safetensors", config, architecture, sha256(weights)
        )
        head_labels = {}
        classes = [config["id2label"][str(i)] for i in range(5)] if kind == "xlmr" else []
        if kind == "e4":
            head_source, head_labels, _ = nested_source(tmp_path, hidden=config["hidden_size"])
            convert_e4_heads(
                head_source,
                target / "heads.safetensors",
                sha256(head_source),
                head_labels,
                config["hidden_size"],
            )
            write_json(
                target / "e4_config.json",
                {
                    "plutchik_labels": head_labels["plutchik"],
                    "goemotions_labels": head_labels["goemotions"],
                },
            )
        else:
            write_json(
                target / "source-calibration.json",
                {"model_weights_sha256": "f" * 64, "class_order": classes},
            )
            write_json(
                target / "source-training-manifest.json",
                {"model_weights_sha256": "f" * 64, "class_order": classes},
            )
        m = {
            "schema_version": "echo-checkpoint-diagnostic-v1",
            "artifact_kind": "synthetic_engineering",
            "model_id": "fixture-diagnostic-" + kind,
            "version": "fixture-v1",
            "architecture": architecture,
            "research_status": "provisional_nonfinal",
            "readiness": "diagnostics_only",
            "application_eligible": False,
            "calibration_applied": False,
            "max_tokens": 16,
            "input_policy": "literal_text_saved_tokenizer_single_window_reject_overflow",
            "external_preprocessing_verified": False,
            "class_labels": classes,
            "head_labels": head_labels,
            "original_weight_sha256": report["source_sha256"],
            "calibration_expected_weight_sha256": "f" * 64 if kind == "xlmr" else None,
            "calibration_binding": "mismatch_unresolved" if kind == "xlmr" else "not_available",
            "source_reference": "Fictional RANDOM weights; no research inference or parity",
            "files": {p.name: sha256(p) for p in target.iterdir() if p.is_file()},
        }
        write_json(target / "diagnostic-manifest.json", m)
        settings = Settings(
            _env_file=None, app_env="test", echo_execution_mode="synthetic", echo_models_dir=target
        )
        return target, settings, m

    return create


@pytest.mark.parametrize("kind", ["e4", "xlmr"])
def test_component_forward_is_distinct_from_calibrated_or_application_output(
    diagnostic_bundle, kind
):
    root, settings, _ = diagnostic_bundle(kind)
    result = run_diagnostic(root, settings, "kind")
    assert result["encoder_forward"] == "completed" and result["weights_loaded"]
    assert (
        result["probabilities"] is None
        and not result["calibration_applied"]
        and not result["application_eligible"]
    )
    if kind == "e4":
        assert result["heads_loaded"] and result["classifier_error"] == "E4_FORWARD_SPEC_REQUIRED"
        assert result["raw_logits"] is None
    else:
        assert len(result["raw_logits"]) == 5 and result["repeat_consistent"]
        assert result["calibration_binding"] == "mismatch_unresolved"
    registry = ModelRegistry(settings)
    try:
        assert not registry.entries
        assert all(
            v["errorCode"] == "MODEL_NOT_ENABLED" for v in registry.status()["models"].values()
        )
    finally:
        registry.close()


def test_diagnostic_cannot_relabel_mismatch_production_or_synthetic_weights(diagnostic_bundle):
    root, settings, m = diagnostic_bundle()
    m["calibration_binding"] = "unverified"
    write_json(root / "diagnostic-manifest.json", m)
    with pytest.raises(ManifestError, match="CALIBRATION_MISMATCH_MUST_REMAIN_VISIBLE"):
        validate_diagnostic(root, settings)
    with pytest.raises(ManifestError, match="PRODUCTION"):
        validate_diagnostic(root, settings.model_copy(update={"app_env": "production"}))
    with pytest.raises(ManifestError, match="SYNTHETIC_ARTIFACT_REFUSED"):
        validate_diagnostic(root, settings.model_copy(update={"echo_execution_mode": "real"}))


def test_diagnostic_rejects_corrupt_artifacts_and_overlong_input(diagnostic_bundle):
    root, settings, _ = diagnostic_bundle()
    with pytest.raises(ManifestError, match="SINGLE_WINDOW_ONLY"):
        run_diagnostic(root, settings, "kind " * 200)
    (root / "model.safetensors").write_bytes(b"corrupt fictional test artifact")
    with pytest.raises(ManifestError, match="CHECKSUM_MISMATCH"):
        validate_diagnostic(root, settings)


@pytest.mark.parametrize(
    "fault", ["missing_payload_hash", "changed_source_hash", "changed_payload_hash"]
)
def test_diagnostic_provenance_cannot_be_forged_by_rehashing_metadata(diagnostic_bundle, fault):
    root, settings, m = diagnostic_bundle()
    path = root / "model.normalization.json"
    data = json.loads(path.read_text())
    if fault == "missing_payload_hash":
        data.pop("source_tensor_payload_sha256")
        data.pop("destination_tensor_payload_sha256")
    elif fault == "changed_source_hash":
        data["source_sha256"] = "0" * 64
    else:
        data["destination_tensor_payload_sha256"] = "0" * 64
    write_json(path, data)
    m["files"][path.name] = sha256(path)
    write_json(root / "diagnostic-manifest.json", m)
    with pytest.raises(ManifestError, match="NORMALIZATION_PROVENANCE_MISMATCH"):
        validate_diagnostic(root, settings)


def test_unknown_architecture_never_uses_generic_key_replacement():
    with pytest.raises(ManifestError, match="UNSUPPORTED_NORMALIZATION_ARCHITECTURE"):
        normalized_tensor_map(
            {"canonical.weight": [4]}, {"canonical.weight": torch.empty(4)}, "UnknownModel"
        )


def test_local_api_cannot_serve_diagnostic_logits_even_with_an_explicit_active_id(
    diagnostic_bundle, monkeypatch
):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes.pipeline import router
    from app.core.config import get_settings

    _root, settings, manifest = diagnostic_bundle()
    settings.echo_active_models = {"distress": manifest["model_id"] + "@" + manifest["version"]}
    registry = ModelRegistry(settings)
    app = FastAPI()
    app.state.pipeline_registry = registry
    app.include_router(router)
    monkeypatch.setenv("AI_SERVICE_TOKEN", "fixture-diagnostic-boundary-token")
    get_settings.cache_clear()
    try:
        with TestClient(app) as client:
            assert (
                client.post("/engineering/v2/analyze", json={"text": "Fictional kind afternoon"}).status_code
                == 401
            )
            response = client.post(
                "/engineering/v2/analyze",
                json={"text": "Fictional kind afternoon"},
                headers={"Authorization": "Bearer fixture-diagnostic-boundary-token"},
            )
            assert response.status_code == 200
            assert response.json()["overallStatus"] == "unavailable"
            assert response.json()["stages"]["distress"]["result"] is None
            assert response.json()["stages"]["distress"]["errorCode"] == "MODEL_MISSING_OR_INVALID"
            assert client.get("/v2/diagnose").status_code == 404
    finally:
        registry.close()
        get_settings.cache_clear()
