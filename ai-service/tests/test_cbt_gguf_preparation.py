"""Offline fault tests; synthetic inventories, no model downloads or model loading."""
import importlib.util
import json
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location("echo_cbt_conversion", Path(__file__).resolve().parents[2] / "scripts/prepare-cbt-gguf.py")
conversion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conversion)


def fixture(root, monkeypatch):
    files = {
        "buddy/adapter/adapter_config.json": "{}",
        "buddy/adapter/adapter_model.safetensors": "synthetic adapter",
        "buddy/adapter/tokenizer.json": "{}",
        "buddy/adapter/tokenizer_config.json": "{}",
        "buddy/adapter/chat_template.jinja": "template",
        "buddy/base/config.json": json.dumps({"architectures": ["Qwen2ForCausalLM"], "model_type": "qwen2"}),
        "buddy/base/model.safetensors.index.json": json.dumps({"weight_map": {"tensor": "weights.safetensors"}}),
        "buddy/base/weights.safetensors": "synthetic base",
    }
    for name, content in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    monkeypatch.setattr(conversion, "ADAPTER_SHA", conversion.digest(root / "buddy/adapter/adapter_model.safetensors"))
    monkeypatch.setattr(conversion, "CONFIG_SHA", conversion.digest(root / "buddy/adapter/adapter_config.json"))
    (root / "manifest.json").write_text(json.dumps({"files": conversion.inventory(root)}))


def test_verifies_complete_inputs_and_stable_identity(tmp_path, monkeypatch):
    fixture(tmp_path, monkeypatch)
    first = conversion.verify_inputs(tmp_path)
    assert first == conversion.verify_inputs(tmp_path)
    assert first["baseBytes"] == len(b"synthetic base")


def test_rejects_wrong_selected_adapter(tmp_path, monkeypatch):
    fixture(tmp_path, monkeypatch)
    monkeypatch.setattr(conversion, "ADAPTER_SHA", "wrong adapter")
    with pytest.raises(ValueError, match="identity"):
        conversion.verify_inputs(tmp_path)


def test_corrupt_base_cannot_convert(tmp_path, monkeypatch):
    fixture(tmp_path, monkeypatch)
    (tmp_path / "buddy/base/weights.safetensors").write_text("corrupt")
    with pytest.raises(ValueError, match="integrity"):
        conversion.verify_inputs(tmp_path)


def test_uninventoried_weight_shard_rejected(tmp_path, monkeypatch):
    fixture(tmp_path, monkeypatch)
    (tmp_path / "buddy/base/extra.safetensors").write_text("unknown")
    with pytest.raises(ValueError, match="Unexpected"):
        conversion.verify_inputs(tmp_path)


@pytest.mark.parametrize("name", ["../outside", "a/../../outside"])
def test_inventory_cannot_escape_root(tmp_path, name):
    with pytest.raises(ValueError, match="Unsafe"):
        conversion.verify_files(tmp_path, [{"path": name, "bytes": 0, "sha256": "none"}])


def test_duplicate_inventory_rejected(tmp_path):
    (tmp_path / "item").write_bytes(b"fixture")
    item = conversion.inventory(tmp_path)[0]
    with pytest.raises(ValueError, match="duplicate"):
        conversion.verify_files(tmp_path, [item, item])


def test_capacity_checks_do_not_start_build(tmp_path):
    gib = 1024**3
    assert conversion.resource_check(tmp_path, 10*gib, ram=20*gib, free=40*gib)
    with pytest.raises(ValueError, match="RAM"):
        conversion.resource_check(tmp_path, 10*gib, ram=15*gib, free=40*gib)
    with pytest.raises(ValueError, match="disk"):
        conversion.resource_check(tmp_path, 10*gib, ram=20*gib, free=20*gib)


def test_conversion_lease_prevents_concurrent_builds(tmp_path):
    with conversion.build_lease(tmp_path):
        with pytest.raises(ValueError, match="lease"):
            with conversion.build_lease(tmp_path):
                pytest.fail("second writer admitted")
    assert not (tmp_path / "llama/artifacts/.cbt-conversion.lock").exists()


def test_failed_operation_releases_its_lease(tmp_path):
    with pytest.raises(RuntimeError):
        with conversion.build_lease(tmp_path):
            raise RuntimeError("synthetic failure")
    assert not (tmp_path / "llama/artifacts/.cbt-conversion.lock").exists()


def test_partial_unvalidated_stage_is_preserved(tmp_path):
    stage = tmp_path / "llama/artifacts" / (conversion.ARTIFACT + ".staging")
    stage.mkdir(parents=True)
    (stage / "partial").write_text("preserve")
    with pytest.raises(ValueError, match="Partial"):
        conversion.build(tmp_path, {"identity": "identity"}, {}, None, None, {})
    assert (stage / "partial").read_text() == "preserve"


def test_verified_artifact_reuse_checks_provenance_and_hashes(tmp_path):
    target = tmp_path / "llama/artifacts" / conversion.ARTIFACT
    target.mkdir(parents=True)
    (target / "output.gguf").write_bytes(b"synthetic GGUF")
    receipt = {"sourceIdentity": "identity", "llamaCommit": "commit", "files": conversion.inventory(target)}
    (target / "manifest.json").write_text(json.dumps(receipt))
    assert conversion.build(tmp_path, {"identity": "identity"}, {"commit": "commit"}, None, None, {}) == target
    (target / "output.gguf").write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="integrity"):
        conversion.build(tmp_path, {"identity": "identity"}, {"commit": "commit"}, None, None, {})


def test_real_peft_safe_merge_and_tokenizer_roundtrip(tmp_path, monkeypatch):
    torch = pytest.importorskip("torch")
    pytest.importorskip("peft")
    from peft import LoraConfig, get_peft_model
    from tokenizers import Tokenizer
    from tokenizers.models import WordLevel
    from tokenizers.pre_tokenizers import Whitespace
    from transformers import PreTrainedTokenizerFast, Qwen2Config, Qwen2ForCausalLM
    # Synthetic miniature model, never the private CBT weights or external assets.
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "-1")
    base = tmp_path / "buddy/base"
    adapter = tmp_path / "buddy/adapter"
    vocabulary = {word: index for index, word in enumerate(["[UNK]", "[PAD]", "[EOS]", "Hello", "Buddy", "You", "are", "helpful", "assistant", ".", ",", "?"])}
    tokenizer_impl = Tokenizer(WordLevel(vocabulary, unk_token="[UNK]"))
    tokenizer_impl.pre_tokenizer = Whitespace()
    tokenizer = PreTrainedTokenizerFast(tokenizer_object=tokenizer_impl, unk_token="[UNK]", pad_token="[PAD]", eos_token="[EOS]")
    tokenizer.chat_template = "{% for message in messages %}{{ message['content'] + ' ' }}{% endfor %}"
    model = Qwen2ForCausalLM(Qwen2Config(vocab_size=len(vocabulary), hidden_size=16, intermediate_size=32,
        num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=2, max_position_embeddings=256)).to(torch.bfloat16)
    model.save_pretrained(base)
    adapted = get_peft_model(model, LoraConfig(r=2, lora_alpha=4, target_modules=["q_proj"], task_type="CAUSAL_LM"))
    with torch.no_grad():
        for name, parameter in adapted.named_parameters():
            if "lora_" in name:
                parameter.fill_(0.02)
    adapted.save_pretrained(adapter)
    tokenizer.save_pretrained(adapter)
    stage = tmp_path / "output"
    stage.mkdir()
    result = conversion.merge(tmp_path, stage)
    assert result["tokenizerTemplateParity"] is True
    assert result["maxAbsoluteLogitDifference"] <= result["absoluteTolerance"]
    assert (stage / "merged/model.safetensors").is_file()
    assert not (stage / "merged/adapter_model.safetensors").exists()


def test_merge_adds_delta_in_fp32_before_bf16_rounding():
    torch = pytest.importorskip("torch")
    from peft import LoraConfig, get_peft_model
    from peft.tuners.lora.layer import Linear
    from transformers import Qwen2Config, Qwen2ForCausalLM
    base = Qwen2ForCausalLM(Qwen2Config(vocab_size=12, hidden_size=16, intermediate_size=32,
        num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=2)).to(torch.bfloat16)
    adapted = get_peft_model(base, LoraConfig(r=2, lora_alpha=2, target_modules=["q_proj"], task_type="CAUSAL_LM"))
    layer = next(module for module in adapted.modules() if isinstance(module, Linear))
    with torch.no_grad():
        layer.get_base_layer().weight.fill_(1)
        layer.lora_A["default"].weight.fill_(1)
        layer.lora_B["default"].weight.fill_(0.00196)
    delta = layer.get_delta_weight("default")
    expected = (layer.get_base_layer().weight.float() + delta.float()).to(torch.bfloat16)
    premature = layer.get_base_layer().weight + delta.to(torch.bfloat16)
    assert not torch.equal(expected, premature), "fixture must expose premature delta rounding"
    merged, count = conversion.merge_standard_lora_fp32(adapted)
    assert count == 1
    assert torch.equal(merged.model.layers[0].self_attn.q_proj.weight, expected)
    assert merged.model.layers[0].self_attn.q_proj.weight.dtype == torch.bfloat16


def test_child_environment_retains_windows_identity_without_service_secrets(monkeypatch):
    monkeypatch.setenv("USERNAME", "synthetic-windows-account")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-secret")
    monkeypatch.setenv("ECHO_CONVERSION_JOB_NAME", "synthetic-job")
    env = conversion.worker_environment()
    assert env["USERNAME"] == "synthetic-windows-account"
    assert env["ECHO_CONVERSION_JOB_NAME"] == "synthetic-job"
    assert "SUPABASE_SERVICE_ROLE_KEY" not in env
    assert env["HF_HUB_OFFLINE"] == "1" and env["CUDA_VISIBLE_DEVICES"] == "-1"
    assert env["TORCHINDUCTOR_CACHE_DIR"].endswith("torch-inductor")
