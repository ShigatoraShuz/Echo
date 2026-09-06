"""Product support heuristic; never a diagnosis or self-harm score classifier."""
from datetime import UTC, datetime, timedelta
from typing import Any


def support_signal(rows: list[dict[str, Any]], *, urgent: bool, threshold: int = 3,
                   window_days: int = 14, now: datetime | None = None) -> str:
    if urgent:
        return "immediate"
    cutoff = (now or datetime.now(UTC)) - timedelta(days=window_days)
    recent = []
    seen = set()
    for row in sorted(rows, key=lambda value: value.get("completed_at") or "", reverse=True):
        if row.get("status") != "completed" or not row.get("completed_at"):
            continue
        completed = datetime.fromisoformat(row["completed_at"])
        if completed < cutoff or completed > (now or datetime.now(UTC)):
            continue
        if row.get("journal_id") in seen:
            continue
        seen.add(row.get("journal_id"))
        recent.append(row)
    return "professional_support" if len(recent) >= threshold and all(
        row.get("severity") == "severe" for row in recent[:threshold]
    ) else "none"
