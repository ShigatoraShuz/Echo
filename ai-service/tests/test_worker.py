import asyncio
from types import SimpleNamespace

import httpx

from app.worker import Worker


def test_worker_pauses_flagged_jobs_before_emotion_inference():
    async def run():
        calls = []

        def handler(request):
            calls.append((request.url.path, request.content.decode()))
            return httpx.Response(200, json={"data": {"status": "safety_action_required"}})

        class Runtime:
            def classify(self, *args):
                return {"suicidal_language_flag": True}

            def analyze(self, *args):
                raise AssertionError("Safety pause must prevent analysis")

        worker = Worker(
            Runtime(),
            SimpleNamespace(
                backend_url="http://127.0.0.1:18001/api/v1/internal/ai", ai_worker_token="synthetic"
            ),
        )
        await worker.client.aclose()
        worker.client = httpx.AsyncClient(
            base_url="http://127.0.0.1:18001/", transport=httpx.MockTransport(handler)
        )
        try:
            await worker.process(
                {
                    "jobId": "synthetic",
                    "leaseToken": "lease",
                    "status": "queued",
                    "input": {"journalText": "Synthetic safety example"},
                }
            )
        finally:
            await worker.client.aclose()
        assert any("/safety-result" in p and "true" in body for p, body in calls)
        assert not any("/final-result" in p for p, _ in calls)

    asyncio.run(run())


def test_core_api_rejects_empty_input_without_loading_models():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, client=("core-validation-test", 50001)) as client:
        response = client.post(
            "/v2/analyze",
            json={"text": ""},
            headers={"Authorization": "Bearer test-internal-token"},
        )
    assert response.status_code == 422


def test_chat_rejects_context_overflow_before_generation():
    import pytest

    from app.model.core import CoreRuntime

    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.classify = lambda *args: {"suicidal_language_flag": False}
    tokenizer = SimpleNamespace(apply_chat_template=lambda *args, **kwargs: [0] * 5000)
    runtime.call = lambda name, fn: fn((None, tokenizer))
    with pytest.raises(ValueError, match="context budget"):
        runtime.chat([{"role": "user", "content": "Synthetic long-input test"}])


def test_gpu_queue_rejects_excess_work_without_loading_a_model():
    import threading

    import pytest

    from app.core.exceptions import ModelUnavailableError
    from app.model.core import CoreRuntime

    runtime = CoreRuntime.__new__(CoreRuntime)
    runtime.loaded = True
    runtime.slots = threading.BoundedSemaphore(1)
    runtime.slots.acquire()
    with pytest.raises(ModelUnavailableError, match="queue is full"):
        runtime.call("xlmr", lambda model: None)
