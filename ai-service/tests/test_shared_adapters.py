"""Tiny loader tests. Real GPU output/timing comparisons are separate evidence."""
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.model.core import CoreRuntime


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    free = [16 * 1024**3]
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(cuda=SimpleNamespace(
        empty_cache=lambda: None, mem_get_info=lambda: (free[0], 16 * 1024**3))))
    tokenizer = Mock(chat_template="unchanged-template")
    monkeypatch.setitem(sys.modules, "transformers", SimpleNamespace(AutoTokenizer=SimpleNamespace(
        from_pretrained=Mock(return_value=tokenizer))))
    for directory in ("cbt/adapter", "phq8-seallms/adapter", "cbt/base"):
        (tmp_path / directory).mkdir(parents=True)
    for directory in ("cbt/adapter", "phq8-seallms/adapter"):
        (tmp_path / directory / "adapter_config.json").write_text(json.dumps({"peft_type":"LORA","bias":"none"}))
        (tmp_path / directory / "adapter_model.safetensors").write_bytes(b"fictional-adapter-bytes")
    (tmp_path / "cbt/base/config.json").write_text(json.dumps({"architectures":["Qwen2ForCausalLM"]}))
    obj = CoreRuntime.__new__(CoreRuntime)
    obj.root, obj.resident, obj.active, obj.instance = tmp_path, {}, None, None
    obj.load_milliseconds, obj.load_counts = {}, {}
    return obj, free, tokenizer


def test_same_base_is_reused_but_each_task_activates_its_own_adapter_and_tokenizer(runtime):
    obj, _, phq_tokenizer = runtime
    model, cbt_tokenizer = Mock(), object()
    obj.resident["cbt"] = (model, cbt_tokenizer)
    assert obj._load("phq8") == (model, phq_tokenizer)
    model.load_adapter.assert_called_once_with(obj.root / "phq8-seallms/adapter",
        adapter_name="phq8", is_trainable=False, local_files_only=True)
    assert obj._load("cbt") == (model, cbt_tokenizer)
    model.set_adapter.assert_called_with("cbt", inference_mode=True)
    assert obj._load("phq8") == (model, phq_tokenizer)
    model.set_adapter.assert_called_with("phq8", inference_mode=True)
    assert obj.load_counts == {"phq8": 1}
    assert model.load_adapter.call_count == 1
    assert model.eval.call_count == 3


def test_reverse_loading_from_phq_to_buddy_also_shares_only_the_base(runtime):
    obj, _, tokenizer = runtime
    model = Mock()
    obj.resident["phq8"] = (model, object())
    assert obj._load("cbt") == (model, tokenizer)
    model.set_adapter.assert_called_with("cbt", inference_mode=True)


def test_shared_base_aliases_are_evicted_together(runtime):
    obj, _, _ = runtime
    model, classifier = Mock(), object()
    obj.resident = {"xlmr": classifier, "cbt": (model, object()), "phq8": (model, object())}
    obj._evict_resident(obj.resident, "cbt")
    assert obj.resident == {"xlmr": classifier}


def test_memory_headroom_is_required_and_unsupported_configs_use_the_isolated_fallback(runtime):
    obj, free, _ = runtime
    model = Mock()
    obj.resident["cbt"] = (model, object())
    free[0] = 1024**3
    assert obj._shared_adapter("phq8", obj.resident) is None
    model.load_adapter.assert_not_called()
    free[0] = 16 * 1024**3
    (obj.root / "phq8-seallms/adapter/adapter_config.json").write_text(json.dumps({"peft_type":"LORA","bias":"all"}))
    assert obj._shared_adapter("phq8", obj.resident) is None
    model.load_adapter.assert_not_called()


def test_shared_adapter_loading_does_not_bypass_architecture_validation(runtime):
    obj, _, _ = runtime
    obj.resident["phq8"] = (Mock(), object())
    (obj.root / "cbt/adapter/adapter_config.json").write_text(json.dumps({
        "peft_type":"LORA","bias":"none","auto_mapping":{"base_model_class":"WrongArchitecture"}}))
    with pytest.raises(Exception, match="architecture mismatch"):
        obj._load("cbt")


def test_peer_with_shared_base_bias_must_not_be_reused(runtime):
    obj, _, _ = runtime
    model = Mock()
    obj.resident["cbt"] = (model, object())
    (obj.root / "cbt/adapter/adapter_config.json").write_text(json.dumps({"peft_type":"LORA","bias":"all"}))
    assert obj._shared_adapter("phq8", obj.resident) is None
    model.load_adapter.assert_not_called()
