from types import SimpleNamespace
import pytest
from app.model.core import CoreRuntime
from app.vendor.cbt.v5 import echo_cbt_standalone as backend, run_echo_v5 as policy
from app.core.exceptions import ModelUnavailableError


def runtime():
    r=CoreRuntime.__new__(CoreRuntime)
    r.provenance=lambda name:{'providerName':name,'modelVersion':'synthetic','inferenceVersion':'synthetic'}
    r.classify=lambda text:{'distress_category':'Others','suicidal_language_flag':False,'max_window_suicidal_label_score':.01,'validation_selected_suicidal_flag_threshold':.16983573167936325,'all_category_scores_relative_not_diagnoses':{},'number_of_windows':1}
    r.call=lambda name,fn:fn((None,SimpleNamespace(pad_token_id=1)))
    return r


def test_formatted_approved_reply_crosses_application_boundary(monkeypatch):
    r=runtime();monkeypatch.setattr(backend,'verify_template',lambda t:'valid');monkeypatch.setattr(backend,'stop_ids',lambda t:[1])
    monkeypatch.setattr(policy,'generate_approved',lambda *args:{'reply':'First paragraph.\n\nSecond paragraph.','needs_review':False,'model_output':True,'auto_format_applied':True,'auto_format_preserved_content':True,'output_paragraphs':2})
    result=r.chat([{'role':'user','content':'I enjoyed lunch today.'}])
    assert '\n\n' in result['reply'] and result['quality']['contentPreserved']


def test_rejected_draft_is_unavailable(monkeypatch):
    r=runtime();monkeypatch.setattr(backend,'verify_template',lambda t:'valid');monkeypatch.setattr(backend,'stop_ids',lambda t:[1])
    monkeypatch.setattr(policy,'generate_approved',lambda *args:{'reply':None,'needs_review':True,'model_output':False})
    with pytest.raises(ModelUnavailableError):r.chat([{'role':'user','content':'Hello Buddy.'}])


def test_historical_concern_prevents_generation():
    r=runtime();original=r.classify
    def classify(text):
        result=original(text)
        if text=='Prior concern':result['suicidal_language_flag']=True
        return result
    r.classify=classify;r.call=lambda *args:pytest.fail('Review must not generate')
    assert r.chat([{'role':'user','content':'Prior concern'},{'role':'assistant','content':'Support'},{'role':'user','content':'Hello'}])['supportRequired']
