# Model integration: simple startup guide

Branch: `model-integration` (Git branch names cannot contain spaces).

This branch uses local models for journal analysis and Buddy text chat. Journal model results and saved Buddy text stay in local JSON. Supabase still handles sign-in, encrypted journals and privacy settings. Internet access is therefore needed for the application even though model loading is offline. MOSS integration is deferred.

## Requirements

| Requirement | What to use |
| --- | --- |
| Operating system | Windows with PowerShell for the supplied launcher |
| JavaScript | Node.js 24+ and npm 11+ |
| Python | Python 3.12+ |
| Models | Complete local copies and matching manifest in CODEX/models |
| Application setup | Frontend/backend environment settings, an existing configured Supabase project, and ECHO account setup |
| Available ports | 3000 frontend, 4200 backend, 8000 internal model service |

Python executable on this machine:

```text
E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe
```

Required Python packages are declared in [pyproject.toml](../ai-service/pyproject.toml). The tested core includes Torch 2.12.0+cu130, Transformers 5.5.0, Accelerate 1.15.0, PEFT 0.21.0, bitsandbytes 0.50.2 and safetensors 0.8.0, plus FastAPI, Uvicorn and the scientific Python dependencies. See [the recorded environment](../ai-service/requirements-local.lock). These dependencies already exist on this machine; do not replace the working CUDA stack with an unqualified PyPI Torch installation. Speech dependencies are not required for the current PHQ-8 work.

Local model layout:

```text
CODEX/
  Echo/                         application repository
  models/
    manifest.json
    xlmr-v2/                    journal categories and support flag
    e4-c/                       emotions
    cbt/base/                   shared SeaLLMs base
    cbt/adapter/                Buddy CBT adapter
    phq8-seallms/adapter/       experimental journal PHQ-8 adapter
  local-data/Echo/              generated local results and saved Buddy history
  runtime-cache/                generated caches and internal service tokens
```

Model binaries, environments, private configuration and local history are not supplied by the Git branch. Keep them outside Git. Existing voice files may remain on disk for later work.

## One-time application setup

1. Open PowerShell in the repository:

   ```powershell
   Set-Location 'E:\Python Project\CODEX\Echo'
   git switch model-integration
   npm ci
   ```

2. Complete the existing frontend and backend environment configuration. Use the templates described in the main README and supply real values privately. The frontend needs its Supabase URL and publishable key; the backend needs matching Supabase access, encryption and idempotency settings. Do not regenerate encryption keys for an existing database or commit secrets.
3. For Google sign-in, enable the Google provider on that same Supabase project. Match the frontend Google client ID, backend client ID and provider configuration. Authorize `http://127.0.0.1:3000` in the Google OAuth client; add `http://localhost:3000` only if you also use that origin.
4. Check the existing Python environment:

   ```powershell
   & 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe' -m pip check
   ```

Existing database setup is still required for normal ECHO operations. This workflow does not apply hosted migrations, reset databases, or download models. See [local model details](local-core-models.md) if restoring the model copies on another machine.

## Run each session

1. Stop older ECHO development instances if they occupy the required ports.
2. Run:

   ```powershell
   .\scripts\start-local-core.ps1
   ```

   If PowerShell blocks the script, use a process-only invocation:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-core.ps1
   ```

   The launcher builds shared contracts, starts the Python service, waits for model readiness, then starts frontend and backend. Model checks and warmup can take time. Keep this terminal open. Use Ctrl+C to stop the session.

   Do not add `-EnableWorker`: the default local JSON mode is the intended workflow. That switch selects a different worker restricted to disposable local Supabase.

3. Open **http://127.0.0.1:3000** and sign in. Complete ECHO's onboarding, verification, current consent and required trusted-contact setup.
4. Enable and save **Settings / Privacy / Journal analysis consent**.
5. Create a new reflection and click **Save reflection**. Draft autosaves do not start inference.

Workflow:

```text
Save reflection
  -> encrypted journal saved in Supabase
  -> local support checks / XLM-R
  -> E4 emotions
  -> SeaLLMs journal PHQ-8 estimate
  -> validated local JSON
  -> journal details and dashboard refresh
```

Concerning language can pause analysis for authorized review. Screening failure keeps valid category/emotion results and shows the estimate as unavailable. The PHQ-8 card supports screening-only retry without rerunning those successful stages.

Buddy text chat uses its separate CBT adapter on the shared SeaLLMs base. GPU models run sequentially. MOSS is not part of the current completion scope.

## Read the PHQ-8 result

- A criterion can be 0, 1, 2, 3 or null. Null means not evidenced in this journal; it is never replaced with zero.
- With fewer than eight numeric criteria, ECHO shows a partial subtotal and coverage. It does not extrapolate a complete score.
- All-null output has no subtotal or total.
- Eight numeric criteria allow a complete experimental model total.
- Questionnaire PHQ-8 scores remain separate. Model estimates are not clinical diagnoses or accuracy-validated journal scores.

## Quick checks

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/ready'
Invoke-RestMethod 'http://127.0.0.1:4200/api/v1/health'
```

| Problem | Check |
| --- | --- |
| Port already in use | Stop the older instance; the launcher deliberately does not kill unrelated processes |
| Model service not ready | Check Python/CUDA, model files and manifest; read the model-service startup error |
| Journal saved without analysis | Save the privacy consent setting, then create a new reflection; old journals are not automatically reprocessed |
| Partial PHQ-8 result | Inspect coverage and null criteria; partial is not a low complete score |
| Screening unavailable | Other native results remain valid; use screening-only retry after resolving the model issue |
| Google issuer/provider not enabled | Enable and configure Google in the correct Supabase project |

For implementation evidence and limits, see [journal PHQ-8 integration](journal-phq8-integration.md).
