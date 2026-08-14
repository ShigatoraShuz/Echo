# ECHO AI service

This FastAPI service is an internal inference boundary. It does not authenticate end users, store journals, or expose a browser-facing API. The Express backend is the only permitted caller and must send the internal bearer token.

The scaffold deliberately reports `ready: false` until a validated fine-tuned model loader and model artefacts are supplied. It does **not** fabricate a PHQ-8 score or a clinical result. Model artefacts belong in `model-artifacts/` locally and are ignored by Git.

## Development

```powershell
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Health does not require a token: `GET /health`. Readiness, model metadata, and analysis are internal endpoints. The application returns only a safe unavailable response until a production-safe model runtime is implemented and verified.
