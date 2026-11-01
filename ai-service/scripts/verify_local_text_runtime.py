"""Windows, fixed fictional inputs only. Owns its loopback server; never connects a DB.
Run with .venv-core from any cwd. Refuses an occupied port; kills only its own tree.
Results are fictional engineering evidence, not clinical validation.
"""

import json
import os
import secrets
import socket
import subprocess
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[2]
output = root / ".integration-verification/real-http-smoke.json"
output.parent.mkdir(exist_ok=True)
with socket.socket() as probe:
    assert probe.connect_ex(("127.0.0.1", 8000)) != 0, (
        "Port occupied; do not stop unrelated process"
    )
token = secrets.token_urlsafe(48)
env = {
    **os.environ,
    "APP_ENV": "development",
    "HOST": "127.0.0.1",
    "AI_SERVICE_TOKEN": token,
    "CORE_MODELS_ENABLED": "true",
    "CORE_TRANSPORT": "text_memory",
    "WORKER_ENABLED": "false",
    "REALTIME_TALK_ENABLED": "false",
    "ECHO_ACTIVE_MODELS": "{}",
    "MODELS_ROOT": str(root / "backend/models"),
    "HF_HUB_OFFLINE": "1",
    "TRANSFORMERS_OFFLINE": "1",
    "ECHO_ISOLATED_TEST": "true",
}
process = subprocess.Popen(
    [
        str(root / "ai-service/.venv-core/Scripts/python.exe"),
        "-B",
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--workers",
        "1",
        "--no-access-log",
    ],
    cwd=root / "ai-service",
    env=env,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
)
report = {}
started = time.perf_counter()
try:
    with httpx.Client(base_url="http://127.0.0.1:8000", trust_env=False, timeout=295) as c:
        while time.perf_counter() - started < 100:
            if process.poll() is not None:
                raise RuntimeError("AI startup failed")
            try:
                if c.get("/ready").status_code == 200:
                    break
            except httpx.TransportError:
                pass
            time.sleep(0.5)
        else:
            raise RuntimeError("Startup timeout")
        report["startupSeconds"] = time.perf_counter() - started
        print("AI ready", report["startupSeconds"], flush=True)
        assert c.post("/v2/classify", json={"text": "Fictional"}).status_code == 401
        h = {"Authorization": "Bearer " + token}
        assert c.post("/v2/analyze", json={"text": ""}, headers=h).status_code == 422
        assert c.post("/v2/analyze", content=b"x" * 65537, headers=h).status_code == 413
        for name, path, payload in [
            (
                "classify",
                "/v2/classify",
                {
                    "text": "Fictional test: I made a study plan and enjoyed lunch with a friend.",
                    "language": "en",
                },
            ),
            (
                "classifyWarm",
                "/v2/classify",
                {
                    "text": "Fictional test: I made a study plan and enjoyed lunch with a friend.",
                    "language": "en",
                },
            ),
            (
                "analysis",
                "/v2/analyze",
                {
                    "text": "Fictional test: I felt nervous before a practice presentation, then I prepared with a friend.",
                    "language": "en",
                },
            ),
            (
                "chat",
                "/v2/chat",
                {
                    "messages": [
                        {
                            "role": "user",
                            "content": "Fictional thesis test: I keep putting off my practice presentation. Can you help me choose one small step to prepare?",
                        }
                    ]
                },
            ),
        ]:
            t = time.perf_counter()
            r = c.post(path, json=payload, headers=h)
            report[name] = {
                "seconds": time.perf_counter() - t,
                "status": r.status_code,
                "result": r.json(),
            }
            if r.status_code != 200:
                raise RuntimeError("Model endpoint unavailable: " + name)
            if name == "analysis":
                assert r.json()["schemaVersion"] == "echo-journal-analysis-v3"
                assert r.json()["isSimulated"] is False
                assert r.json()["journalScreening"]["total"] is None
            if name == "chat":
                assert r.json()["reply"] and r.json()["supportRequired"] is False
            output.write_text(json.dumps(report, indent=2), encoding="utf-8")
            print(name, r.status_code, round(report[name]["seconds"], 3), flush=True)
        report["screeningStatus"] = c.post(
            "/v3/screening", json={"text": "Fictional"}, headers=h
        ).status_code
        report["faceStatus"] = c.post("/v1/face", json={"image": "YQ=="}, headers=h).status_code
        report["metrics"] = c.get("/v2/runtime", headers=h).json()
        report["authMalformedSizeChecks"] = True
finally:
    # Graceful Ctrl+C to uvicorn via a same-console process is unreliable on Windows.
    # The owned tree is explicitly terminated; no unrelated PID is targeted.
    subprocess.run(
        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    process.wait(timeout=15)
    report["ownedTreeStopped"] = True
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
print("Saved fictional-only HTTP evidence", flush=True)
