import asyncio
from datetime import UTC, datetime

import httpx
import pytest

from app.api.routes import analysis
from app.core.config import Settings


@pytest.mark.parametrize("cooldown", [False, True])
def test_professional_support_respects_persisted_cooldown(monkeypatch, cooldown):
    monkeypatch.setattr(analysis, "get_settings", lambda: Settings(supabase_url="http://db"))
    calls = []
    def respond(request):
        calls.append(request)
        assert request.url.params.get("user_id") == "eq.owner" or request.method == "POST"
        if "journal_analyses" in request.url.path:
            return httpx.Response(200, json=[{"journal_id": str(i), "status": "completed", "severity": "severe", "completed_at": datetime.now(UTC).isoformat()} for i in range(3)])
        if request.method == "GET":
            return httpx.Response(200, json=[{"id": "previous"}] if cooldown else [])
        return httpx.Response(201, json=[{"id": "new-event"}])
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await analysis.evaluate_support(client, "owner", "journal", {"id": "analysis", "severity": "severe"}, False)
    result = asyncio.run(run())
    assert result == ({"kind": "none"} if cooldown else {"kind": "professional_support", "eventId": "new-event"})
    assert sum(request.method == "POST" for request in calls) == (0 if cooldown else 1)


def test_urgent_ignores_professional_cooldown_and_survives_event_store_failure(monkeypatch):
    monkeypatch.setattr(analysis, "get_settings", lambda: Settings(supabase_url="http://db"))
    calls = []
    def respond(request):
        calls.append(request.method)
        return httpx.Response(503, json={})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await analysis.evaluate_support(client, "owner", "journal", {"id": "analysis"}, True)
    assert asyncio.run(run()) == {"kind": "immediate", "eventId": "analysis"}
    assert calls == ["POST"]
