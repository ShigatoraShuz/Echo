from datetime import UTC, datetime, timedelta

import pytest

from app.core.safety import support_signal

NOW = datetime(2026, 9, 6, tzinfo=UTC)


def rows(count=3, severity="severe", age=1):
    return [{"journal_id": str(i), "status": "completed", "severity": severity,
             "completed_at": (NOW - timedelta(days=age + i)).isoformat()} for i in range(count)]


@pytest.mark.parametrize(("items", "expected"), [
    (rows(2), "none"), (rows(3), "professional_support"),
    (rows(3, age=20), "none"), (rows(3, severity="moderately_severe"), "none"),
    (rows(3, severity="moderate"), "none"), (rows(0), "none"),
    ([rows(1)[0]] * 3, "none"),
])
def test_streak_requirements(items, expected):
    assert support_signal(items, urgent=False, now=NOW) == expected


def test_lower_recent_severity_breaks_streak():
    items = rows(4)
    items[0]["severity"] = "mild"
    assert support_signal(items, urgent=False, now=NOW) == "none"


def test_failed_analyses_do_not_count():
    items = rows(3)
    items[0]["status"] = "failed"
    assert support_signal(items, urgent=False, now=NOW) == "none"


def test_self_harm_overrides_streak_and_score():
    assert support_signal(rows(3), urgent=True, now=NOW) == "immediate"
    assert support_signal(rows(1, severity="minimal"), urgent=True, now=NOW) == "immediate"


def test_configuration_controls_threshold_and_window():
    assert support_signal(rows(2), urgent=False, threshold=2, now=NOW) == "professional_support"
    assert support_signal(rows(3), urgent=False, window_days=1, now=NOW) == "none"
