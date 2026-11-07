"""Offline conversion validation tests; never read real weights."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace as NS
import sys
import pytest

spec=importlib.util.spec_from_file_location('prepare_shared',Path(__file__).parents[2]/'scripts/prepare-shared-seallms.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


def reader(monkeypatch,*,alpha=32,pair=True,base=False):
 names=[f'layer_{i}.lora_{side}' for i in range(196) for side in ('a','b')]
 if not pair:names[-1]='other.lora_b'
 fields={'general.architecture':'qwen2','adapter.type':'lora','adapter.lora.alpha':alpha}
 fake=NS(tensors=[NS(name=name,tensor_type=NS(name='F32')) for name in names],
         get_field=lambda key:NS(contents=lambda:fields[key]))
 monkeypatch.setitem(sys.modules,'gguf',NS(GGUFReader=lambda path:fake))
 return fake


def test_adapter_validation_rejects_wrong_alpha_and_missing_pair(monkeypatch,tmp_path):
 reader(monkeypatch);assert module.validate(tmp_path/'model',tmp_path,adapter=True)['tensorCount']==392
 reader(monkeypatch,alpha=16)
 with pytest.raises(ValueError,match='alpha'):module.validate(tmp_path/'model',tmp_path,adapter=True)
 reader(monkeypatch,pair=False)
 with pytest.raises(ValueError,match='pair'):module.validate(tmp_path/'model',tmp_path,adapter=True)


def test_base_validation_refuses_merged_adapter_tensors(monkeypatch,tmp_path):
 fake=reader(monkeypatch);fake.tensors=[NS(name=f'layer_{i}',tensor_type=NS(name='Q4_K')) for i in range(339)]
 assert module.validate(tmp_path/'model',tmp_path,quantized=True)['tensorCount']==339
 fake.tensors[-1].name='attn.lora_a'
 with pytest.raises(ValueError,match='Base tensor'):module.validate(tmp_path/'model',tmp_path,quantized=True)
