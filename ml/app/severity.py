from typing import Literal

Severity = Literal["minimal", "mild", "moderate", "moderately_severe", "severe"]


def severity_from_phq8(score: int) -> Severity:
    if not 0 <= score <= 24:
        raise ValueError("PHQ-8 score must be between 0 and 24.")
    if score <= 4:
        return "minimal"
    if score <= 9:
        return "mild"
    if score <= 14:
        return "moderate"
    if score <= 19:
        return "moderately_severe"
    return "severe"
