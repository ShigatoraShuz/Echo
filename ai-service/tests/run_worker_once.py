"""Explicit synthetic integration runner; backend URL must be loopback."""

import asyncio
import os
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[3]
for key, sub in [("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"), ("HF_XET_CACHE", "hf/xet")]:
    d = root / "runtime-cache" / sub
    d.mkdir(parents=True, exist_ok=True)
    os.environ[key] = str(d)
from app.core.config import Settings
from app.model.core import CoreRuntime
from app.worker import Worker


async def main():
    settings = Settings(core_models_enabled=True, models_root=str(root / "models"))
    assert urlparse(settings.backend_url).hostname == "127.0.0.1"
    runtime = CoreRuntime(settings)
    worker = Worker(runtime, settings)
    try:
        await worker.post(
            "worker-health",
            {
                "workerId": "local-worker",
                "acceptingJobs": True,
                "modelStatus": "synthetic-validation",
                "modelVersion": "echo-core-v2",
            },
        )
        job = await worker.post("jobs/claim", {"workerId": "local-worker"})
        assert job is not None
        await worker.process(job)
    finally:
        runtime.release()
        await worker.client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
