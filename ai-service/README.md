# ECHO Analysis service

This FastAPI service orchestrates journal analysis. It validates signed gateway identity, obtains consented journal text through the Journal Service API, calls the independently deployed ML Inference Service, persists analysis-owned records with an `analysis_service_role` key, and requests recommendation output over HTTP.

It never loads a model itself and never queries Journal Service tables. Missing ML runtime capability is propagated as an unavailable response; no score is fabricated.

## Development

```powershell
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Health does not require a token: `GET /health`. Analysis routes require gateway identity signed with `ANALYSIS_SERVICE_TOKEN`. Outbound calls use only the target tokens listed in `.env.example`; model readiness, metadata, and inference belong to the ML service. Analysis returns a safe unavailable response when that dependency is not ready.
