# Local core model integration

ECHO now supports the copied XLM-R V2 classifier, E4-C emotion model, and selected
mixed_lr_1e4 CBT adapter on its SeaLLMs-v3-7B-Chat base. Qwen3Guard, SEA-LION Guard,
historical PHQ-8 adapters, and facial emotion/fusion models are excluded.

## Installed environment and artifacts

Python: `E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe`.
Models: `E:\Python Project\CODEX\models`.

`manifest.json` records source paths, sizes, SHA-256 checksums, inference-code
checksums, model locations, and context settings. The copied artifacts include
tokenizers, chat templates, calibration, encoder/head weights, all CBT base shards,
and its LoRA adapter. No datasets or optimizer states are copied. Original files
remain unchanged. Startup verifies checksums and successfully loads each model
serially before advertising readiness. The adapter's historical base path is ignored;
the explicit copied base is instantiated before PEFT loads the copied adapter.

The Python runtime owns one GPU queue. It unloads the previous model before
switching; queue admission is bounded and lock waiting times out. Buddy requests
have a bounded backend inference timeout; the browser allows an additional 15
seconds for the backend to return that outcome. All model loading is offline.
The selected conversational prompt, stopping, rewrite, review, and version
logic are vendored under `ai-service/app/vendor`. That source currently identifies
itself as the selected V49 inference policy despite its historical V41 folder name.
The runtime calls its direct single-adapter policy, not the optional cascade experiment.

The installed environment is frozen in `ai-service/requirements-local.lock`.
The existing GPU package versions were retained. Missing service/test tools were
installed; `pycparser` and `hf-xet` were corrected to make `pip check` pass.
Use this exact environment, not a different `python` found on PATH.

## Start locally

Before starting, stop existing development instances on ports 3000, 4200, and 8000.
The launcher refuses occupied ports rather than stopping another process.

From the repository root in PowerShell:

```powershell
.\scripts\start-local-core.ps1
```

This builds contracts, verifies and warms the Python models on port 8000, and starts
the frontend/backend. It enables model-backed Buddy but leaves journal job claims
disabled. It does not apply migrations or generate test records.

The launcher creates credentials in the sibling `CODEX/runtime-cache/core-secrets.json`.
They stay out of Git and browser configuration. Do not copy them to NEXT_PUBLIC variables.
The Python server has one process and binds to loopback. Express is its only browser-facing caller.

For journal jobs, first configure a **disposable local Supabase project** in
`backend/.env`, apply the repository migration chain to that local project, and run:

```powershell
.\scripts\start-local-core.ps1 -EnableWorker
```

The launcher rejects a non-loopback Supabase URL in this mode. This implementation
did not apply migrations to the connected ECHO project. Full native Supabase browser
testing requires a local stack with Auth/PostgREST/Realtime; the isolated validation
described below is supplemental.

For a future separately authorized deployment, use the additive
`20261030010000_native_core_analysis_v2.sql` migration and service credentials from
the deployment environment. Keep the internal model service inaccessible to browsers.

## Data flow and compatibility

Journal jobs use existing authenticated claims, 60-second leases, independent
heartbeats, consent/ownership gates, safety pauses, callback receipts, encrypted
completion, and dashboard invalidation. Callback retries reuse the same identity.
Late results are discarded when the lease or execution gates fail. The Python worker
runs inside the API process, so Buddy and journal inference share the same GPU owner.

XLM-R flags or existing explicit concern checks pause journal analysis for the
existing human-review workflow. An approved resumed job can continue. Buddy routes
flagged messages to the existing supportive response instead of CBT generation.
No messages are automatically sent to contacts. Negative flags are not safety clearance.
Language is marked `unknown` when the worker has no explicit declaration.

`echo-journal-analysis-v2` stores the native five classification scores, eight
Plutchik emotion scores, 27 independent auxiliary scores, calibrated flag metadata,
and per-model provenance. Detailed outputs remain encrypted. Clinical severity,
screening ranges, facial emotion, and fusion remain unavailable. Actual questionnaire
PHQ-8 scoring is unchanged. V1 results remain readable, and charts do not combine
emotion distributions across model formats. Recommendations remain versioned
application rules, not generated clinical conclusions.

Model-backed Buddy retrieves only the authenticated owner's saved context, applies
XLM-R first, invokes the selected CBT policy, withholds outputs marked for review,
and uses existing encrypted persistence. Model errors return unavailable rather
than silently claiming a generated template response. The existing scripted mode
is retained only when no core service is configured.

## Verification commands

```powershell
$python = 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe'
npm run check:contracts
npm run typecheck
npm test
npm run lint
npm run test:sql:isolated
Push-Location ai-service
& $python -m pip check
& $python -B -m pytest -q
Pop-Location
node --import tsx backend/scripts/test-core-disposable.mts
node --import tsx backend/scripts/test-core-http.mts
```

The two explicit GPU tests use synthetic inputs and loopback services. The first
creates and discards an in-memory PostgreSQL database, executes all migrations,
runs a real Python worker over HTTP, and checks encrypted v2 completion and status
projection. The second starts an actual FastAPI process, checks authentication and
input rejection, and exercises the actual backend Buddy client. It checks the
resident model count and measured GPU peak. Neither connects to Supabase.

The default unit tests do not load GPUs or download models. The explicit smoke
script `ai-service/tests/smoke_core.py` additionally covers English, Filipino, and
Taglish. It uses only model copies and a separate writable cache. Research source
folders are not imported. Synthetic execution is not evidence of journal-domain,
multilingual, clinical, or response-quality validity.

## Environment rollback

Before installation, the complete 64,192-file Python environment was copied to
`E:\Python Project\CODEX\integration-backup\Thesis2_VENV`. Its copy log reports
zero failed files. `packages-before.txt` preserves the original package inventory.

To restore it, stop all processes using Thesis2_VENV, preserve the changed environment
under another name, then copy the backup back to the **original Thesis2_VENV path**.
The backup is intended for restoration to that exact location; do not assume the
relocated Conda environment is independently portable. Verify Python, package
versions, and CUDA after restoration. No rollback was performed during integration.

## Current limits

- Guard models are intentionally absent.
- Real models and model-backed Buddy work locally; connected-project journal
  processing remains disabled until a separately approved rollout.
- The camera's permission/error cleanup is tested with mocks; real camera inference
  and native Supabase browser delivery remain unverified.
- No retraining, recalibration, clinical certification, or participant deployment
  is part of this implementation.
