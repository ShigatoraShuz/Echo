"""A later optional PHQ failure must not discard successful emotion/classification."""
from types import SimpleNamespace
import pytest
from app.model.text_transport import TextRuntime
from app.model.core import CoreRuntime
from app.core.exceptions import ModelUnavailableError,TalkBusyError,TalkCancelledError


def runtime_with_failure(error,stage="screening"):
    runtime=TextRuntime.__new__(TextRuntime);runtime.buddy_enabled=True
    calls=[]
    def call(operation,*args,**metadata):
        calls.append((operation,args,metadata))
        if operation==stage:raise error
        if operation=="classify":return {"classification":"synthetic safe classification"}
        if operation=="emotions":return {"dominant_plutchik":"joy","plutchik_8":{"joy":1}}
        if operation=="analyze":return {"classification":args[2],"emotion":args[3],"screening":args[4]}
        raise AssertionError(operation)
    runtime._call=call
    return runtime,calls


@pytest.mark.parametrize("code,status",[("NATIVE_PHQ_ASSET_UNAVAILABLE","unavailable"),
 ("NATIVE_PHQ_ASSET_MISSING","unavailable"),("NATIVE_PHQ_LOAD_FAILED","failed"),
 ("Model operation unavailable.","failed")])
def test_optional_phq_failure_preserves_completed_native_outputs(code,status):
    runtime,calls=runtime_with_failure(ModelUnavailableError(code))
    value=runtime.analyze("synthetic text",owner="a"*64)
    assert value["emotion"]["dominant_plutchik"]=="joy"
    assert value["classification"]["classification"]=="synthetic safe classification"
    assert value["screening"]=={"status":status,"experimental":True,"inferenceVersion":"journal-nullable-v1",
        "items":None,"coverage":0,"subtotal":None,"total":None}
    assert all(metadata=={"journal_owner":"a"*64} for _,_,metadata in calls)


@pytest.mark.parametrize("error",[TalkBusyError("waiting"),TalkCancelledError("cancelled"),
 ModelUnavailableError("Text worker unavailable or timed out."),ValueError("bad request")])
def test_wait_cancel_transport_and_invalid_requests_are_not_hidden(error):
    runtime,calls=runtime_with_failure(error)
    with pytest.raises(type(error)):runtime.analyze("synthetic text",owner="a"*64)
    assert not any(operation=="analyze" for operation,_,_ in calls)


def test_emotion_failure_remains_a_real_failure():
    runtime,calls=runtime_with_failure(ModelUnavailableError("NATIVE_EMOTION_LOAD_FAILED"),"emotions")
    with pytest.raises(ModelUnavailableError,match="EMOTION"):
        runtime.analyze("synthetic text",owner="a"*64)
    assert not any(operation=="analyze" for operation,_,_ in calls)


def test_missing_screening_assets_have_a_sanitized_stage_code():
    runtime=CoreRuntime.__new__(CoreRuntime);runtime.screening_unavailable="MODEL_INTEGRITY_FAILED"
    with pytest.raises(ModelUnavailableError,match="NATIVE_PHQ_ASSET_UNAVAILABLE"):
        runtime.screening("synthetic text")


def test_progress_events_precede_the_actual_screening_and_cbt_work():
    value=TextRuntime.__new__(TextRuntime);value.buddy_enabled=True
    events=[]
    def call(operation,*args,**metadata):
        events.append(operation)
        return {"ok":True}
    value._call=call
    value.analyze("synthetic",classification={"safe":True},on_stage=lambda state:events.append(state))
    assert events==["emotions","classifying_distress","estimating_screening","screening","generating_recommendation","analyze"]
