import asyncio
import json
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from fastapi import HTTPException

from app.api.routes import analysis
from app.core.config import Settings

JOURNAL_ID = UUID("00000000-0000-4000-8000-000000000001")
USER_ID = "00000000-0000-4000-8000-000000000002"
REQUEST_ID = "00000000-0000-4000-8000-000000000003"


def harness(monkeypatch, failure=None, stored_status="completed"):
    updates = []
    calls = []
    settings = Settings(
        supabase_url="http://database", user_service_url="http://user",
        journal_service_url="http://journal", ml_service_url="http://ml",
        recommendation_service_url="http://recommendation",
        user_service_token="user-token", journal_service_token="journal-token",
        ml_service_token="ml-token", recommendation_service_token="recommendation-token",
    )
    monkeypatch.setattr(analysis, "get_settings", lambda: settings)

    def respond(request):
        calls.append(request.url.host)
        if request.url.host == "user":
            return httpx.Response(200, json={"data": {"approved": True}})
        if request.url.host == "journal":
            return httpx.Response(200, json={"data": {"analysisConsent": True, "journalText": "private"}})
        if request.url.host == "ml":
            if failure == "unavailable":
                return httpx.Response(503, json={"detail": "unavailable"})
            if failure == "malformed":
                return httpx.Response(200, json={"phq8_score": 999})
            return httpx.Response(200, json={
                "request_id": REQUEST_ID, "phq8_score": 2, "severity": "minimal",
                "urgent_language_detected": False, "model_version": "validated-test",
                "processing_time_ms": 10,
            })
        if request.url.host == "recommendation":
            if failure == "recommendation":
                return httpx.Response(503, json={})
            return httpx.Response(200, json={"data": {
                "title": "Next steps", "clinicalDisclaimer": "Not a diagnosis", "steps": ["Reflect"],
            }})
        if request.method == "PATCH":
            updates.append(json.loads(request.content))
        return httpx.Response(200, json=[{
            "id": "analysis-id", "created_at": "2026-09-05T00:00:00Z", "status": stored_status,
        }])

    original_client = httpx.AsyncClient
    monkeypatch.setattr(analysis.httpx, "AsyncClient", lambda **kwargs: original_client(
        transport=httpx.MockTransport(respond), **kwargs,
    ))
    request = SimpleNamespace(state=SimpleNamespace(request_id=REQUEST_ID))
    return request, updates, calls


@pytest.mark.parametrize(("failure", "status_code"), [
    ("unavailable", 503), ("malformed", 502), ("recommendation", 503),
])
def test_dependency_failures_record_failed_not_completed(monkeypatch, failure, status_code):
    request, updates, _ = harness(monkeypatch, failure)
    with pytest.raises(HTTPException) as captured:
        asyncio.run(analysis.analyze(JOURNAL_ID, request, USER_ID))
    assert captured.value.status_code == status_code
    assert [update["status"] for update in updates] == ["failed"]
    assert "phq8_score" not in updates[0]


def test_success_completes_only_after_recommendation(monkeypatch):
    request, updates, calls = harness(monkeypatch)
    result = asyncio.run(analysis.analyze(JOURNAL_ID, request, USER_ID))
    assert result["data"]["is_demo_data"] is False
    assert result["data"]["phq8_score"] == 2
    assert [update["status"] for update in updates] == ["completed"]
    assert calls[-2:] == ["recommendation", "database"]


def test_failed_latest_result_does_not_claim_completion(monkeypatch):
    request, _, _ = harness(monkeypatch, stored_status="failed")
    result = asyncio.run(analysis.latest_analysis(JOURNAL_ID, request, USER_ID))
    assert result["data"]["status"] == "failed"
    assert result["data"]["summary"] != "Analysis completed."
    assert result["data"]["phq8_score"] is None
