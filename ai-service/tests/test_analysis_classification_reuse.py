from types import SimpleNamespace
import pytest
from app.api.routes.core import AnalyzeInput,analyze
from pydantic import ValidationError

def classification():
    return {'distress_category':'Others','suicidal_language_flag':False,
        'all_category_scores_relative_not_diagnoses':{'Others':.6,'Anxious':.1,'Depressed':.1,'Frustrated':.1,'Suicidal':.1},
        'validation_selected_suicidal_flag_threshold':.4,'number_of_windows':1}

def test_internal_analyze_reuses_the_existing_complete_safety_result():
    seen=[]
    runtime=SimpleNamespace(analyze=lambda *args,**kwargs:seen.append((args,kwargs)) or {'result':'synthetic'})
    request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(model_runtime=runtime)))
    payload=AnalyzeInput(text='A fictional reflection.',classification=classification())
    assert analyze(payload,request)=={'result':'synthetic'}
    assert seen==[(('A fictional reflection.','unknown'),{'classification':classification()})]

def test_analyze_without_a_precheck_preserves_the_existing_path():
    seen=[];runtime=SimpleNamespace(analyze=lambda *args,**kwargs:seen.append(kwargs))
    request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(model_runtime=runtime)))
    analyze(AnalyzeInput(text='Fictional text'),request)
    assert seen==[{}]

@pytest.mark.parametrize('change',[{'number_of_windows':0},{'suicidal_language_flag':'false'}, {'all_category_scores_relative_not_diagnoses':{'Others':1}}, {'validation_selected_suicidal_flag_threshold':2}])
def test_reused_safety_results_are_fully_validated(change):
    with pytest.raises(ValidationError):AnalyzeInput(text='Fictional text',classification={**classification(),**change})
