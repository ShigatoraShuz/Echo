# ECHO machine-learning workspace

This directory contains the independently runnable ML inference service as well as protected experimentation folders. The service owns model loading and prediction only; analysis orchestration lives in `ai-service/`.

The repository currently contains no model checkpoint/LoRA adapter and no validated Torch/Transformers loader or clinical evaluation manifest. Consequently `/health` succeeds while `/health/ready` and `/v1/infer` truthfully return `503`. No score is fabricated.

Run with `uv run uvicorn app.main:app --port 8001` after installing Python 3.12 and `uv`. Internal model and inference routes require the ML-only `ML_SERVICE_TOKEN`; liveness does not.

Never commit journal text, participant transcripts, proprietary datasets, model checkpoints, LoRA adapters, or private evaluation output.
