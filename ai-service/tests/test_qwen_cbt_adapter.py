"""Isolated random tiny tensors test loading rules, never research-model evidence."""

import asyncio
import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.model.cli import fixture_manifest
from app.model.manifest import ManifestError, ModelManifest
from app.model.qwen_cbt_adapter import QwenCbtAdapter
from app.model.registry import ModelRegistry


def profile():
    return fixture_manifest("cbt") | {
        "artifact_kind": "research_checkpoint",
        "family": "qwen2_cbt",
        "architecture": "Qwen2ForCausalLM",
        "export_format": "hf_safetensors",
        "device": "cpu",
        "compute_dtype": "bfloat16",
        "research_status": "provisional_nonfinal",
        "inference_spec_file": "inference-spec.json",
        "frameworks": {"torch": ">=2.6", "transformers": ">=4.57"},
        "preprocessing": {"normalization": "identity", "max_tokens": 128, "max_windows": 1},
        "provenance": {
            "source": "fictional random test tensors",
            "scope": "local_fictional_consultation_only",
        },
    }


@pytest.mark.parametrize(
    "change",
    [
        {"task": "phq8"},
        {"family": "seallms"},
        {"device": "cuda"},
        {"compute_dtype": "float32"},
        {"research_status": None},
        {"base_model_id": "unrelated"},
        {"provenance": {"source": "fictional fixture"}},
    ],
)
def test_qwen_cannot_substitute_another_profile(change):
    with pytest.raises(ValidationError):
        ModelManifest.model_validate(profile() | change)


@pytest.mark.parametrize(
    "env,enabled", [("production", False), ("development", False), ("test", False)]
)
def test_registry_refuses_qwen_outside_fictional_consultation(tmp_path, env, enabled):
    manifest = ModelManifest.model_validate(profile())
    runtime = ModelRegistry(
        Settings(
            _env_file=None,
            app_env=env,
            ai_service_token="fictional-test-only-token-1234567890",
            echo_execution_mode="real",
            echo_models_dir=tmp_path,
            echo_consultation_demo=enabled,
            echo_active_models={"cbt": "test@v1"},
        )
    )
    runtime.entries["test@v1"] = (tmp_path, manifest)
    try:
        with pytest.raises(ManifestError, match="QWEN_REQUIRES_LOCAL_FICTIONAL_CONSULTATION"):
            runtime.selected("cbt")
    finally:
        runtime.close()


def tiny_bundle(root):
    import torch
    from safetensors.torch import save_file
    from transformers import Qwen2Config, Qwen2ForCausalLM

    config = Qwen2Config(
        vocab_size=64,
        hidden_size=16,
        intermediate_size=32,
        num_hidden_layers=1,
        num_attention_heads=2,
        num_key_value_heads=1,
        tie_word_embeddings=True,
    )
    config.save_pretrained(root)
    config_data = json.loads((root / "config.json").read_text())
    config_data.pop("rope_theta", None)
    config_data["architectures"] = ["Qwen2ForCausalLM"]
    config_data["rope_parameters"] = {"rope_type": "default", "rope_theta": 1000000}
    (root / "config.json").write_text(json.dumps(config_data))
    model = Qwen2ForCausalLM(config).to(torch.bfloat16)
    weights = {
        k: v.contiguous().clone() for k, v in model.state_dict().items() if k != "lm_head.weight"
    }
    save_file(weights, root / "model.safetensors")
    spec = {
        "schema_version": "echo-qwen-cbt-inference-v1",
        "scope": "local_fictional_consultation_only",
        "training_reference_parity_verified": False,
        "sampling": "greedy",
        "max_new_tokens": 16,
        "max_time_seconds": 2,
        "system_prompt": "Fictional random test model; not participant data, therapy or clinical advice.",
    }
    (root / "inference-spec.json").write_text(json.dumps(spec))
    return QwenCbtAdapter(
        root, SimpleNamespace(inference_spec_file="inference-spec.json"), 1
    ), weights


def test_exact_tensors_and_omitted_tied_alias_load_without_random_parameters(tmp_path):
    import torch

    adapter, weights = tiny_bundle(tmp_path)
    loaded = adapter._load_model()
    assert not any(p.is_meta for p in loaded.parameters())
    assert loaded.lm_head.weight.data_ptr() == loaded.model.embed_tokens.weight.data_ptr()
    assert loaded.config.rope_theta == 1000000
    assert torch.equal(loaded.model.embed_tokens.weight, weights["model.embed_tokens.weight"])
    assert torch.isfinite(
        loaded(input_ids=torch.tensor([[1, 2, 3]]), logits_to_keep=1).logits
    ).all()


@pytest.mark.parametrize("fault", ["missing", "extra", "shape", "dtype"])
def test_incomplete_or_incompatible_weights_fail_closed(tmp_path, fault):
    import torch
    from safetensors.torch import save_file

    adapter, weights = tiny_bundle(tmp_path)
    key = "model.layers.0.mlp.down_proj.weight"
    if fault == "missing":
        del weights[key]
    elif fault == "extra":
        weights["unrecognized.weight"] = torch.zeros(1, dtype=torch.bfloat16)
    elif fault == "shape":
        weights[key] = torch.zeros(1, dtype=torch.bfloat16)
    else:
        weights[key] = weights[key].float()
    save_file(weights, tmp_path / "model.safetensors")
    with pytest.raises(ManifestError):
        adapter._load_model()


def test_unverified_rope_variant_is_not_guessed(tmp_path):
    tiny_bundle(tmp_path)
    config = json.loads((tmp_path / "config.json").read_text())
    config["rope_parameters"]["rope_type"] = "yarn"
    (tmp_path / "config.json").write_text(json.dumps(config))
    with pytest.raises(ManifestError, match="UNVERIFIED_QWEN_ROPE_PROFILE"):
        QwenCbtAdapter(tmp_path, SimpleNamespace(inference_spec_file="inference-spec.json"), 1)


@pytest.mark.parametrize(
    "synthetic,state", [(True, "DEMO_FALLBACK"), (False, "REAL_PROVISIONAL_MODEL")]
)
def test_generation_stage_preserves_attribution_for_buddy_and_journal(
    tmp_path, monkeypatch, synthetic, state
):
    runtime = ModelRegistry(
        Settings(
            _env_file=None,
            app_env="test",
            echo_models_dir=tmp_path,
            echo_execution_mode="synthetic" if synthetic else "real",
        )
    )
    manifest = ModelManifest.model_validate(fixture_manifest("cbt") if synthetic else profile())
    monkeypatch.setattr(
        runtime,
        "infer",
        lambda *args: ({"text": "Fictional test double", "disclaimer": "Test only"}, manifest),
    )
    try:
        output = asyncio.run(runtime.stage("cbt", "Fictional"))
        assert output["status"] == "completed" and output["executionState"] == state
        assert output["modelId"] == manifest.model_id
    finally:
        runtime.close()
