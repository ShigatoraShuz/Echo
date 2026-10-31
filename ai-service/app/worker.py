"""Runs in the API process, sharing its single GPU owner. Never stores journal plaintext."""

import asyncio
import contextlib
import re
import uuid

import httpx


class Worker:
    def __init__(self, runtime, settings):
        self.runtime = runtime
        self.settings = settings
        self.client = httpx.AsyncClient(
            base_url=settings.backend_url.rstrip("/") + "/",
            headers={"Authorization": "Bearer " + settings.ai_worker_token},
            timeout=20,
            trust_env=False,  # Internal loopback callbacks must not traverse system proxies.
        )

    async def post(self, path, payload, key=None):
        headers = {"Idempotency-Key": key or str(uuid.uuid4())}
        # Transport retries reuse the same callback identity and payload.
        for attempt in range(3):
            try:
                response = await self.client.post(path, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()["data"]
            except httpx.TransportError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)

    async def callback(self, job, kind, payload=None):
        body = {"workerId": "local-worker", "leaseToken": job["leaseToken"]}
        if payload is not None:
            body["payload"] = payload
        return await self.post(f"jobs/{job['jobId']}/{kind}", body)

    async def heartbeat(self, job):
        while True:
            await asyncio.sleep(15)
            await self.callback(job, "heartbeat")
            await self.post(
                "worker-health",
                {
                    "workerId": "local-worker",
                    "acceptingJobs": True,
                    "modelStatus": "verified-local-artifacts",
                    "modelVersion": "echo-core-v2",
                },
            )

    async def stage(self, job, heartbeat, fn):
        await self.callback(job, "heartbeat")  # Revalidate lease/gates before each stage.
        task = asyncio.create_task(asyncio.to_thread(fn))
        done, _ = await asyncio.wait([task, heartbeat], return_when=asyncio.FIRST_COMPLETED)
        if heartbeat in done:
            # GPU work cannot be killed safely; await and discard its output.
            with contextlib.suppress(Exception):
                await task
            heartbeat.result()
        result = await task
        await self.callback(job, "heartbeat")
        return result

    async def process(self, job):
        heartbeat = asyncio.create_task(self.heartbeat(job))
        try:
            text = job["input"]["journalText"]
            language = job["input"].get("language", "unknown")
            if job["status"] == "queued":
                await self.callback(job, "progress", {"status": "safety_checking"})
            classification = await self.stage(
                job, heartbeat, lambda: self.runtime.classify(text, language)
            )
            if job["status"] != "analyzing_emotions":
                flagged = classification["suicidal_language_flag"] or bool(
                    re.search(
                        r"\b(kill myself|end my life|hurt myself|want to die)\b",
                        text,
                        re.IGNORECASE,
                    )
                )
                await self.callback(job, "safety-result", {"actionRequired": flagged})
                if flagged:
                    return
            result = await self.stage(
                job, heartbeat, lambda: self.runtime.analyze(text, language, classification)
            )
            for status in [
                "classifying_distress",
                "estimating_screening",
                "generating_recommendation",
            ]:
                await self.callback(job, "progress", {"status": status})
            await self.callback(job, "final-result", result)
        except Exception:  # noqa: BLE001 -- report a bounded job failure without leaking journal text
            with contextlib.suppress(Exception):
                await self.callback(job, "failure", {"code": "PROCESSING_FAILED"})
        finally:
            heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat

    async def run(self):
        try:
            while True:
                try:
                    await self.post(
                        "worker-health",
                        {
                            "workerId": "local-worker",
                            "acceptingJobs": True,
                            "modelStatus": "verified-local-artifacts",
                            "modelVersion": "echo-core-v2",
                        },
                    )
                    job = await self.post("jobs/claim", {"workerId": "local-worker"})
                    if job:
                        await self.process(job)
                    else:
                        await asyncio.sleep(5)
                except (httpx.HTTPError, KeyError):
                    await asyncio.sleep(5)
        finally:
            await self.client.aclose()
