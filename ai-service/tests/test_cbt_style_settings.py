from pathlib import Path
import hashlib
import json
import pytest
from app.vendor.cbt import echo_v41 as cbt

@pytest.mark.parametrize('role,language,expected',[
 ('brief','english',25),('ordinary','english',75),('ordinary','filipino',65),
 ('ordinary','taglish',65),('professional','english',155),('potential_safety','english',None)])
def test_soft_targets(role,language,expected):
    assert cbt.response_target(role,language)==expected

def test_sampling_stays_frozen():
    assert (cbt.CREATIVE_TEMPERATURE,cbt.CREATIVE_TOP_P,cbt.CREATIVE_TOP_K,cbt.CREATIVE_SEED,cbt.CREATIVE_REPETITION_PENALTY)==(.75,.92,40,2026,1.05)

def test_initial_and_rewrite_use_same_style_target(monkeypatch):
    calls=[]
    monkeypatch.setattr(cbt,'_ensure_assistant_marker',lambda tokenizer:'valid')
    monkeypatch.setattr(cbt,'classify',lambda messages:('ordinary',105))
    monkeypatch.setattr(cbt,'detect_language',lambda messages:'filipino')
    def generate(*args):
        calls.append(args[5]);return 'A complete reply.',{'finish_reason':'end_of_turn','context':{}}
    monkeypatch.setattr(cbt,'_generate',generate)
    monkeypatch.setattr(cbt,'issues',lambda *args:['empty'] if len(calls)==1 else [])
    reply,audit=cbt.infer_v41(None,None,[{'role':'user','content':'Synthetic input'}])
    assert calls==[65,65]
    assert audit['rewrite_attempted'] and not audit['needs_review']

def test_manifest_matches_updated_policy():
    root=Path(__file__).resolve().parents[3]
    manifest=json.loads((root/'models/manifest.json').read_text('utf-8'))
    entry=next(x for x in manifest['inferenceCode'] if x['path'].replace('\\','/').endswith('/cbt/echo_v41.py'))
    assert entry['sha256']==hashlib.sha256(Path(cbt.__file__).read_bytes()).hexdigest()
