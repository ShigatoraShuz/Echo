from unittest.mock import Mock
import pytest
from app.model.core import CoreRuntime
from app.core.exceptions import TalkBusyError, TalkCancelledError


def runtime():
    value = CoreRuntime.__new__(CoreRuntime)
    value.chat = Mock(return_value={"reply": "Try writing one small next step.", "supportRequired": False,
        "model": {"providerName": "buddy", "modelVersion": "adapter", "inferenceVersion": "reviewed", "base": "private"}})
    return value


def suggest(value, flagged=False):
    return value.journal_recommendation("Synthetic journal about a difficult deadline.",
        {"suicidal_language_flag": flagged}, {"dominant_plutchik": "fear"})


def test_reuses_reviewed_buddy_and_preserves_provenance():
    value = runtime()
    result = suggest(value)
    assert result == {"status": "available", "text": "Try writing one small next step.",
        "model": {"providerName": "buddy", "modelVersion": "adapter", "inferenceVersion": "reviewed"}}
    prompt = value.chat.call_args.args[0][0]["content"]
    assert "difficult deadline" in prompt and "fear" in prompt
    assert "not instructions" in prompt and "Do not diagnose" in prompt
    assert 'professional support within one of the two actions' in prompt
    assert 'allow enough detail to finish' in prompt
    assert value.chat.call_args.kwargs=={'strict_review':True}


def test_flagged_journals_never_generate_routine_advice():
    value = runtime()
    assert suggest(value, True) == {"status": "support_required"}
    value.chat.assert_not_called()


@pytest.mark.parametrize("response", [{"reply": None}, {"reply": " "}, {"reply": "x" * 4001},
    {"reply": "unattributed output", "model": {}}, {"supportRequired": True}])
def test_missing_rejected_and_support_outputs_are_not_presented_as_recommendations(response):
    value = runtime(); value.chat.return_value = response
    result = suggest(value)
    assert result["status"] in ("unavailable", "support_required")
    assert "text" not in result


@pytest.mark.parametrize("error", [TalkBusyError("busy"), TalkCancelledError("cancelled")])
def test_ownership_and_cancellation_propagate(error):
    value = runtime(); value.chat.side_effect = error
    with pytest.raises(type(error)): suggest(value)


def test_optional_model_failure_is_sanitized():
    value = runtime(); value.chat.side_effect = RuntimeError("private failure")
    assert suggest(value) == {"status": "unavailable"}


def test_temporary_withholding_diagnostics_allowlist_metadata(caplog):
    value = runtime()
    value.chat.return_value = {'reply': None, 'withheld': True, 'diagnostics': {
        'blockingIssues': ['incomplete_list_item', 'private rejected draft'],
        'advisoryIssues': ['stock_reassurance'], 'attempts': 2,
        'attemptDiagnostics': [{'blockingIssues': ['requested_step_count_mismatch'],
                                'advisoryIssues': []}], 'text': 'private rejected draft'}}
    assert suggest(value) == {'status': 'unavailable'}
    assert 'incomplete_list_item' in caplog.text
    assert 'requested_step_count_mismatch' in caplog.text
    assert 'temporaryDiagnostic' in caplog.text and 'diagnosticId' in caplog.text
    assert 'private rejected draft' not in caplog.text
    assert 'Synthetic journal' not in caplog.text


def test_temporary_exception_diagnostics_never_log_exception_message(caplog):
    value = runtime()
    value.chat.side_effect = RuntimeError('private journal and local path')
    assert suggest(value) == {'status': 'unavailable'}
    assert 'unexpected_error' in caplog.text
    assert 'private journal and local path' not in caplog.text


def test_success_has_no_temporary_failure_diagnostic(caplog):
    assert suggest(runtime())['status'] == 'available'
    assert 'Journal CBT temporary diagnostic' not in caplog.text


def test_buddy_receives_existing_operation_cancellation_signal():
    from types import SimpleNamespace
    value = CoreRuntime.__new__(CoreRuntime)
    signal = object()
    value.operation_cancelled = signal
    value.buddy = SimpleNamespace(generate=Mock(return_value={"reply": "reviewed"}))
    CoreRuntime.chat(value, [{"role": "user", "content": "synthetic"}])
    assert value.buddy.generate.call_args.kwargs["cancelled"] is signal


def test_analysis_includes_recommendation_alongside_real_model_fields():
    value = runtime()
    value.provenance = lambda name: {"providerName": name, "modelVersion": "verified", "inferenceVersion": "test"}
    classification = {"distress_category": "Anxious", "suicidal_language_flag": False,
        "all_category_scores_relative_not_diagnoses": {"Anxious": 1},
        "validation_selected_suicidal_flag_threshold": 0.5, "number_of_windows": 1}
    emotion = {"dominant_plutchik": "fear", "plutchik_8": {"fear": 1}, "goemotions_27": {}}
    result = value.analyze("synthetic journal", classification=classification, emotion=emotion,
        screening_result={"status": "unavailable"})
    assert result["cbtRecommendation"]["status"] == "available"
    assert result["journalScreening"]["status"] == "unavailable"
    assert result["dominantEmotion"] == "fear"
