from app.inference.severity import severity_from_phq8
from app.safety.urgent_language import has_urgent_language


def test_severity_mapping_is_deterministic() -> None:
    assert severity_from_phq8(0) == "minimal"
    assert severity_from_phq8(5) == "mild"
    assert severity_from_phq8(10) == "moderate"
    assert severity_from_phq8(15) == "moderately_severe"
    assert severity_from_phq8(24) == "severe"


def test_explicit_urgent_language_is_detected_independently() -> None:
    assert has_urgent_language("I want to die tonight") is True
    assert has_urgent_language("I felt disconnected today") is False
