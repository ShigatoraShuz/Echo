"""Prompted intensity is separate from classifier scores and PHQ-8."""
import contextlib
from types import SimpleNamespace as NS
import pytest
from app.model.distress_estimate import BANDS, infer, parse_output, result
from app.core.exceptions import ModelUnavailableError, TalkCancelledError

@pytest.mark.parametrize("band", [*BANDS, None])
def test_accepts_only_operational_bands_and_preserves_absent_evidence(band):
    import json
    value = parse_output(json.dumps({"band": band}))
    assert value["band"] == band and value["experimental"] is True
    assert value["status"] == ("available" if band else "insufficient_evidence")
    assert "confidence" not in value

@pytest.mark.parametrize("text", ['{"band":"Depressed"}', '{"band":true}', '{"band":0.9}',
    '{"band":"high","confidence":0.99}', '```json\n{"band":"low"}\n```', 'null'])
def test_rejects_categories_probabilities_and_unstructured_outputs(text):
    with pytest.raises(ValueError):parse_output(text)

class Tokenizer:
    eos_token_id = 2
    def __init__(self, count=5):self.count=count
    def apply_chat_template(self, messages, **kwargs):
        self.messages=messages
        return [1]*self.count
    def encode(self, text, **kwargs):return [ord(char) for char in text]
    def convert_tokens_to_ids(self, token):return 2
    def decode(self, tokens, **kwargs):return '{"band":"moderate"}'

class Model:
    device="cpu"
    def __init__(self):self.disabled=False
    @contextlib.contextmanager
    def disable_adapter(self):
        self.disabled=True
        try:yield
        finally:self.disabled=False
    def generate(self, **kwargs):
        import torch
        assert self.disabled and kwargs["do_sample"] is False and kwargs["max_new_tokens"] == 48
        return torch.cat((kwargs["input_ids"],torch.tensor([[2]])),dim=1)

def test_inference_uses_base_without_adapter_and_never_truncates_silently():
    model=Model();tokenizer=Tokenizer()
    assert infer(model,tokenizer,"I feel overwhelmed and cannot focus.")["band"]=="moderate"
    assert not model.disabled and tokenizer.messages[-1]["content"]=="I feel overwhelmed and cannot focus."
    assert infer(model,Tokenizer(3801),"Long journal")["status"]=="unavailable"

@pytest.mark.parametrize("text", ["", " ", None, "x"*20001])
def test_invalid_input_never_reaches_model(text):
    with pytest.raises(ValueError):infer(Model(),Tokenizer(),text)

def test_optional_failure_retains_other_outputs_and_closes_its_handle():
    from app.model.core import CoreRuntime
    runtime=CoreRuntime.__new__(CoreRuntime);runtime.hf_enabled=True;runtime.operation_cancelled=None
    runtime.ensure_buddy_capacity=lambda:None
    closed=[]
    handle=NS(call=lambda *a:(_ for _ in ()).throw(ModelUnavailableError("NATIVE_DISTRESS_OUTPUT_INVALID")),close=lambda:closed.append(True))
    runtime.hf_runtime=NS(acquire=lambda *a:handle)
    assert runtime.estimate_distress("synthetic")["status"]=="failed" and closed==[True]
    handle.call=lambda *a:(_ for _ in ()).throw(TalkCancelledError("cancelled"))
    with pytest.raises(TalkCancelledError):runtime.estimate_distress("synthetic")

def test_invalid_model_json_restores_cbt_adapter(monkeypatch):
    from app.buddy import worker
    calls=[]
    monkeypatch.setattr(worker,"ENGINE",NS(model=NS(set_adapter=lambda name:calls.append(name),eval=lambda:None),tokenizer=object()))
    def bad(*args):raise ValueError("invalid output")
    monkeypatch.setattr("app.model.distress_estimate.infer",bad)
    with pytest.raises(RuntimeError,match="NATIVE_DISTRESS_OUTPUT_INVALID"):worker.cbt({"distressText":"synthetic"})
    assert calls==["cbt"]
    assert worker.loading_error_code(RuntimeError("NATIVE_DISTRESS_OUTPUT_INVALID"),"cbt")=="NATIVE_DISTRESS_OUTPUT_INVALID"

def test_constrained_output_allows_each_band_and_null_without_fixing_the_choice():
    import json, torch
    from app.model.distress_estimate import response_tokens
    tokenizer=Tokenizer();allowed=response_tokens(tokenizer,2)
    for band in (*BANDS,None):
        tokens=tokenizer.encode(json.dumps({"band":band}))
        for index,token in enumerate(tokens):
            assert token in allowed(0,torch.tensor([1,1]+tokens[:index]))
        assert allowed(0,torch.tensor([1,1]+tokens))==[tokenizer.eos_token_id]
