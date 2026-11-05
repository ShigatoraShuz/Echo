"""Tiny local-model regression checks for bounded-memory conversion."""
import copy
import json
from pathlib import Path
import sys
import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import cbt_shard_merge as shards
import importlib.util
spec = importlib.util.spec_from_file_location("conversion_for_shard_test", SCRIPTS / "prepare-cbt-gguf.py")
conversion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conversion)


def tiny(root):
    import torch
    from peft import LoraConfig, get_peft_model
    from tokenizers import Tokenizer
    from tokenizers.models import WordLevel
    from tokenizers.pre_tokenizers import Whitespace
    from transformers import PreTrainedTokenizerFast, Qwen2Config, Qwen2ForCausalLM
    model = Qwen2ForCausalLM(Qwen2Config(vocab_size=12, hidden_size=16, intermediate_size=32,
        num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=2, max_position_embeddings=256)).to(torch.bfloat16)
    model.save_pretrained(root / "buddy/base", max_shard_size="6KB")
    model = get_peft_model(model, LoraConfig(r=2, lora_alpha=2, target_modules=["q_proj"], task_type="CAUSAL_LM"))
    with torch.no_grad():
        for name, parameter in model.named_parameters():
            if "lora_" in name:
                parameter.fill_(0.02)
    model.save_pretrained(root / "buddy/adapter")
    vocab = {word: index for index, word in enumerate(["[UNK]", "[PAD]", "[EOS]", "Hello", "Buddy", "You", "are", "helpful", "assistant", ".", ",", "?"])}
    implementation = Tokenizer(WordLevel(vocab, unk_token="[UNK]"))
    implementation.pre_tokenizer = Whitespace()
    tokenizer = PreTrainedTokenizerFast(tokenizer_object=implementation, unk_token="[UNK]", pad_token="[PAD]", eos_token="[EOS]")
    tokenizer.chat_template = "{% for message in messages %}{{ message['content'] + ' ' }}{% endfor %}"
    tokenizer.save_pretrained(root / "buddy/adapter")
    return model.eval()


def test_sharded_weights_equal_peft_fp32_safe_merge_and_resume(tmp_path):
    import torch
    from transformers import AutoModelForCausalLM
    model = tiny(tmp_path)
    stage = tmp_path / "stage"
    stage.mkdir()
    original = conversion.inventory(tmp_path / "buddy/base")
    result = shards.merge_shards(tmp_path, stage, "synthetic identity")
    expected, _ = conversion.merge_standard_lora_fp32(model)
    actual = AutoModelForCausalLM.from_pretrained(stage / "merged", local_files_only=True, dtype=torch.bfloat16)
    assert set(expected.state_dict()) == set(actual.state_dict())
    for name, tensor in expected.state_dict().items():
        assert torch.equal(tensor, actual.state_dict()[name]), name
    assert result["mergedLinearLayers"] == 1
    assert result["savedTensorHashesVerified"] is True
    assert shards.merge_shards(tmp_path, stage, "synthetic identity") == result
    conversion.verify_files(tmp_path / "buddy/base", original)
    with pytest.raises(ValueError, match="identity"):
        shards.merge_shards(tmp_path, stage, "different identity")


def test_streamed_fp32_arithmetic_matches_full_fp32_tiny_model(tmp_path):
    import torch
    model = tiny(tmp_path)
    full = copy.deepcopy(model).float().eval()
    ids = torch.tensor([[3, 4, 5, 6]])
    dtypes = {name: parameter.dtype for name, parameter in model.named_parameters()}
    with torch.inference_mode():
        expected = full(input_ids=ids, use_cache=False).logits
        with shards.fp32_layer_compute(model):
            actual = model(input_ids=ids, use_cache=False).logits
    torch.testing.assert_close(actual, expected, rtol=1e-5, atol=1e-6)
    assert {name: parameter.dtype for name, parameter in model.named_parameters()} == dtypes


def test_fp32_temporary_weights_restore_after_failure():
    import torch
    class Broken(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.weight = torch.nn.Parameter(torch.ones(4, dtype=torch.bfloat16))
        def forward(self, value):
            assert self.weight.dtype == torch.float32
            raise RuntimeError("synthetic failure")
    model = Broken()
    pointer = model.weight.data_ptr()
    with pytest.raises(RuntimeError, match="synthetic"):
        with shards.fp32_layer_compute(model):
            model(None)
    assert model.weight.dtype == torch.bfloat16 and model.weight.data_ptr() == pointer


def test_adapter_pair_validation_rejects_variants_and_incomplete_pairs():
    import torch
    config = {"peft_type": "LORA", "r": 2, "lora_alpha": 2, "target_modules": ["q_proj"]}
    tensors = {"base_model.model.model.q_proj.lora_A.weight": torch.ones(2, 4)}
    with pytest.raises(ValueError, match="Incomplete"):
        shards.adapter_pairs(config, tensors)
    with pytest.raises(ValueError, match="plain"):
        shards.adapter_pairs({**config, "use_dora": True}, tensors)


def test_unverified_committed_shard_is_preserved(tmp_path):
    tiny(tmp_path)
    stage = tmp_path / "stage"
    output = stage / "merged"
    output.mkdir(parents=True)
    index = json.loads((tmp_path / "buddy/base/model.safetensors.index.json").read_text())
    name = sorted(set(index["weight_map"].values()))[0]
    (output / name).write_bytes(b"unverified partial")
    with pytest.raises(ValueError, match="Unverified"):
        shards.merge_shards(tmp_path, stage, "synthetic identity")
    assert (output / name).read_bytes() == b"unverified partial"


def test_chunked_fp32_projection_matches_full_projection_and_restores():
    import torch
    layer = torch.nn.Linear(32, 2300).to(torch.bfloat16).eval()
    inputs = torch.randn(2, 3, 32)
    expected = torch.nn.functional.linear(inputs, layer.weight.float(), layer.bias.float())
    assert "forward" not in layer.__dict__
    with torch.inference_mode(), shards.fp32_layer_compute(layer):
        actual = layer(inputs)
    torch.testing.assert_close(actual, expected, rtol=1e-5, atol=1e-6)
    assert "forward" not in layer.__dict__ and layer.weight.dtype == torch.bfloat16
