import pytest
from app.model.screening import ITEMS, validate_items


def test_nullable_items():
    items = dict.fromkeys(ITEMS)
    assert validate_items(items)["subtotal"] is None
    items["sleep"] = 0
    assert validate_items(items)["coverage"] == 1
    assert validate_items(items)["subtotal"] == 0
    assert validate_items(items)["total"] is None
    for invalid in ["null", True, 4, -1]:
        with pytest.raises(ValueError):
            validate_items({**items, "sleep": invalid})
    with pytest.raises(ValueError):
        validate_items({})


def test_long_input_retains_budget_and_does_not_impute_nulls():
    import json, torch
    from app.model.screening import infer

    class Tokenizer:
        eos_token_id = 2

        def apply_chat_template(self, *args, **kwargs):
            return list(range(2000))

        def decode(self, *args, **kwargs):
            return json.dumps(dict.fromkeys(ITEMS))

    class Model:
        device = "cpu"

        def generate(self, **kwargs):
            ids = kwargs["input_ids"]
            assert ids.shape[1] == 1700
            assert torch.all(kwargs["attention_mask"] == 1)
            assert ids[0, :400].tolist() == list(range(400))
            assert ids[0, -1300:].tolist() == list(range(700, 2000))
            return torch.cat([ids, torch.zeros((1, 1), dtype=ids.dtype)], dim=1)

    result = infer(Model(), Tokenizer(), "synthetic long input")
    assert result["truncated"] and result["retainedTokens"] == 1700
    assert result["coverage"] == 0 and result["subtotal"] is None and result["total"] is None


def test_missing_screening_adapter_does_not_disable_native_runtime(tmp_path,monkeypatch):
    import json
    from types import SimpleNamespace
    from app.model.core import CoreRuntime
    (tmp_path/'manifest.json').write_text(json.dumps({'inferenceCode':[],'files':[{'path':'phq8-seallms/adapter/missing.safetensors','bytes':1,'sha256':'0'*64}]}))
    calls=[]
    monkeypatch.setattr(CoreRuntime,'_load',lambda self,name:calls.append(name))
    monkeypatch.setattr(CoreRuntime,'release',lambda self:None)
    import torch
    monkeypatch.setattr(torch.cuda,'is_available',lambda:True)
    monkeypatch.setattr(torch.cuda,'reset_peak_memory_stats',lambda:None)
    runtime=CoreRuntime(SimpleNamespace(models_root=str(tmp_path),queue_limit=4))
    assert runtime.loaded and runtime.screening_unavailable=='MODEL_INTEGRITY_FAILED'
    assert calls==['xlmr','e4','cbt']
    with pytest.raises(Exception):runtime.screening('Synthetic journal')


@pytest.mark.parametrize('unavailable,expected',[(None,'failed'),('MODEL_INTEGRITY_FAILED','unavailable')])
def test_screening_failure_preserves_native_outputs(unavailable,expected):
    import json
    from pathlib import Path
    from app.model.core import CoreRuntime
    fixture=json.loads((Path(__file__).resolve().parents[2]/'packages/contracts/fixtures/core-v2.json').read_text())
    runtime=CoreRuntime.__new__(CoreRuntime)
    runtime.screening_unavailable=unavailable
    emotion={'plutchik_8':{v['emotion']:v['value'] for v in fixture['emotionDistribution']},'dominant_plutchik':fixture['dominantEmotion'],'goemotions_27':fixture['goEmotions']}
    runtime.call=lambda name,fn:emotion
    runtime.provenance=lambda name:fixture['models'][name]
    def fail(text):raise ValueError('Malformed synthetic model output')
    runtime.screening=fail
    classification={'distress_category':fixture['distressCategory'],'all_category_scores_relative_not_diagnoses':fixture['categoryScores'],'suicidal_language_flag':False,'validation_selected_suicidal_flag_threshold':fixture['classificationMetadata']['threshold'],'number_of_windows':1}
    result=runtime.analyze('Synthetic journal',classification=classification)
    assert result['journalScreening']['status']==expected
    assert result['journalScreening']['items'] is None
    assert result['journalScreening']['total'] is None
    assert result['categoryScores']==fixture['categoryScores']
    assert result['emotionDistribution']==fixture['emotionDistribution']
