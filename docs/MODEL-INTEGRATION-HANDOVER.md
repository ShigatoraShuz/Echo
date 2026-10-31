# ECHO model integration and environment handover

Snapshot: 2026-10-31, Asia/Taipei. This document combines a **fresh installed-package audit** with source inspection and previously recorded integration results. It does not claim every earlier test was rerun today. No environment packages, models, database records, application configuration, or Git settings were changed to prepare this handover. Protected environment/credential files were not opened.

## 1. Current checkout and change ownership

Branch: `model-integration`; HEAD: `8439f3d68838bc2d608856d1ef2004e94c4772d3`. The working tree is extensively modified. [working-tree-changes.txt](handover/working-tree-changes.txt) is the complete observed tracked/untracked path inventory relative to HEAD, including additions and deletions. It is a snapshot, not proof of authorship: it contains main-branch reconciliation, user/other-session changes and model integration together. Do not discard it, reset the repository, or apply the backup wholesale. No commit or push was made for this handover.

## 2. Python environments and requirements

All three active interpreters report Python 3.12.14. Their installed distribution counts are core **138**, speech **70**, and face **27**. All three freshly passed `python -m pip check`. This checks declared dependency consistency; it does not prove CUDA/native ABI compatibility or model accuracy. Installed distributions include development/training packages that are not all needed for inference; do not blindly copy all core packages into the smaller environments.

| Environment | Interpreter | Responsibility |
| --- | --- | --- |
| Core | `E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe` | FastAPI, XLM-R, E4-C, CBT and SeaLLMs journal screening; GPU scheduling |
| Speech | `E:\Python Project\CODEX\speech-venv\Scripts\python.exe` | Whisper, manual MOSS/tokenizer, real-time MMS voices; isolated Transformers/CUDA dependencies |
| Face | `E:\Python Project\CODEX\face-venv\Scripts\python.exe` | CPU image/MediaPipe/scikit-learn face inference |
| Older Thesis `.venv` | `E:\Python Project\PROJECTS\Thesis2\.venv\Scripts\python.exe` | Not selected by current launcher; interpreter execution failed with exit 3221225506 (0xC0000022/access-denied status), no package output; contents **unverified** |

| Package | Core | Speech | Face |
| --- | --- | --- | --- |
| torch | 2.12.0+cu130 | 2.11.0+cu130 | — |
| torchaudio | 2.11.0+cu130 | 2.11.0+cu130 | — |
| transformers | 5.5.0 | 4.57.6 | — |
| accelerate | 1.15.0 | 1.15.0 | — |
| peft | 0.21.0 | — | — |
| unsloth | 2026.9.7 | — | — |
| bitsandbytes | 0.50.2 | — | — |
| triton-windows | 3.8.0.post28 | — | — |
| fastapi | 0.162.0 | — | — |
| uvicorn | 0.54.0 | — | — |
| pydantic | 2.13.5 | — | — |
| pydantic-settings | 2.16.2 | — | — |
| pytest | 8.4.2 | 8.4.2 | — |
| ruff | 0.17.3 | — | — |
| faster-whisper | — | 1.2.1 | — |
| ctranslate2 | — | 4.8.4 | — |
| onnxruntime | — | 1.31.1 | — |
| numpy | 1.26.4 | 2.5.4 | 2.1.3 |
| mediapipe | — | — | 0.10.35 |
| scikit-learn | 1.4.0 | 1.9.1 | 1.6.1 |
| opencv-contrib-python | — | — | 4.11.0.86 |
| pillow | 12.3.0 | — | 11.3.0 |
| safetensors | 0.8.0 | 0.8.0 | — |

Full package/version tables: [installed-packages.md](handover/installed-packages.md). Every distribution's declared `Requires-Dist` list, interpreter details and pip-check output: [environment-inventory.json](handover/environment-inventory.json).

### Requirements sources and reproducibility

The AI service `pyproject.toml` declares Python >=3.12, FastAPI/Pydantic/Uvicorn runtime dependencies, optional core requirements and development tools. `uv.lock` belongs to the scaffold/package workflow; it is not proof of the complete manually provisioned CUDA/model environments. The actual environment locks and their fresh comparisons are:

- `requirements-local.lock`: 117 pins; 0 missing; 2 differing versions; 16 installed packages outside these pins.
- `requirements-speech.lock`: 69 pins; 0 missing; 0 differing versions; 1 installed packages outside these pins.
- `requirements-realtime-speech.lock`: 69 pins; 0 missing; 0 differing versions; 1 installed packages outside these pins.
- `requirements-face.lock`: 26 pins; 0 missing; 0 differing versions; 1 installed packages outside these pins.

Details, including exact differing/missing/extra package names and lock hashes: [lock-comparison.json](handover/lock-comparison.json). Locks are snapshots, not portable installers for every platform. CUDA-tagged PyTorch wheels, Windows Triton, Unsloth/bitsandbytes and native face wheels require compatible platform/build sources. Preserve separate environments; notably core and speech use different Transformers/PyTorch stacks, and face pins an older NumPy/scikit-learn stack compatible with its serialized estimator. Do not upgrade or merge these environments without copied-environment smoke tests and rollback. Avoid global pip, blanket `pip install -U`, or regenerating all locks from one environment.

Fresh audit scope: package metadata and pip consistency only; no new model load, GPU allocation, microphone use or downloads. The inaccessible older `.venv` is not a demonstrated runtime dependency. No missing requirement was reported by the three active environments' pip checks; lock drift is reported independently above.

## 3. Model/application wiring and changes

- **Core copies:** `CODEX/models/manifest.json` connects copied XLM-R V2, E4-C encoder/heads, CBT adapter and SeaLLMs base. Runtime code was vendored into ECHO instead of importing training entry points. Preserve XLM-R label order, calibration hashes, temperature, threshold, length 384 and stride 64. Core loading is offline/local-only; source experiments remain separate.
- **Native journal results:** shared contracts/readers support saved v1 plus native v2 categories/eight emotions and v3 nullable screening. E4's 27 auxiliary scores are independent rather than normalized emotion probabilities. Inferred clinical severity/fusion remain unavailable; questionnaire PHQ-8 remains separate.
- **Journal screening:** combined REDSM5 + DAIC adapter in `models/phq8-seallms/adapter`, reusing the copied compatible CBT base. `journal-nullable-v1` requires all eight criteria with integer 0–3 or JSON null; missing/string-null/boolean values are invalid. Never coerce missing/null to zero. Partial coverage shows an unscaled subtotal; only eight numeric values produce a complete model total. Screening-only retries are bounded; other valid results survive screening failure. Original interview metrics do not validate this changed journal prompt.
- **Storage:** Supabase retains identity, privacy, encrypted journal and eligibility responsibilities. New analysis results, support/review/progress state and saved Buddy content use readable account-scoped local JSON in `CODEX/local-data/Echo`. Atomic updates, validation, account checks and restart recovery replace the draft storage path. Local mode disables cloud analysis/Buddy result writes and does not import/delete cloud history. With Buddy history off, bounded context stays in memory. Protect readable local files and do not commit them.
- **Buddy:** selected CBT prompt/stopping/rewrite/review policy and XLM-R support routing are preserved. Chat and Talk share saved or temporary context. No automatic contact is initiated. A negative support flag is not a safety guarantee.
- **Manual speech:** recording/stop -> local Whisper -> approved CBT reply -> MOSS default voice; isolated speech child exits before the next GPU task. No cloned/reference voice, browser speech, or cloud speech fallback. Media limits, cancellation and temporary cleanup are enforced.
- **Experimental hands-free speech:** explicit Start Talk, browser-local Silero VAD/ONNX WASM, provisional/final transcription, authenticated Express WebSocket, persistent speech worker, progressive phrase audio, playback credits, interruption, generation IDs, expiry and cleanup. CBT and tested CUDA Whisper may coexist with >=2 GiB free reserve; MMS synthesis runs on CPU. GPU work is serialized and journal stages wait while Talk owns the reservation. History/provenance/delivery metadata is backward compatible. Default remains off because speed acceptance failed.
- **Face:** browser capture/permission cleanup and existing local `face_model` inference are connected. The face worker verifies `model_manifest.json`, uses the copied `selected_development_model.joblib`, MediaPipe/image checks and CPU runtime. It is experimental/development-only, can return no-usable-face/unavailable, and must not be described as clinical facial diagnosis or validated text/face fusion. Raw captures are transient with bounded queue TTL.
- **Startup/access fixes:** one launcher starts Python/Express/Next and builds contracts first; process-local proxy exclusions and occupied-port rejection prevent competing instances. Access-service failure is distinguished from rejected sessions. Duplicate professional login route and onboarding invalid UTF-8 were repaired. Real microphone permission denial and sentence/endpoint pauses remain user-visible operational considerations.
- **Broader checkout changes:** registration/authentication (including Google-auth retirement and email-confirmation work), verification/admin, professional workflows, notifications, calendar, security, exports, tests and SQL migrations are present in the working tree. Their complete affected-path inventory is attached. This handover does not certify the authorship, deployment, or live-database application of each of those changes; review the diff and the corresponding release documents before merging.

Runtime entry points: `ai-service/app/model/core.py`, its `talk.py` scheduler and speech/face workers; backend core client, journal/experience services and JSON repositories; frontend journal native-analysis/capture and Buddy voice hooks; shared versioned contracts. These map to the behavior groups above and the full path inventory.

## 4. Start, verify and roll back

From PowerShell:

```powershell
& 'E:\Python Project\CODEX\Echo\scripts\start-local-core.ps1'
# Experimental hands-free option:
& 'E:\Python Project\CODEX\Echo\scripts\start-local-core.ps1' -EnableRealtimeTalk
```

Use one invocation, not both. The launcher starts ports 8000/4200/3000; do not also run `npm run dev`. Default mode is `local_json`. `-EnableWorker` is a separate disposable-local-Supabase-only mode and must not be used to bypass that guard against a hosted project. Browser calls stay on Express; internal Python is loopback/bearer protected. Existing protected configuration must be supplied by the installation owner; this document contains no tokens or credentials.

Requirements/locks alone do not contain model weights: retain `CODEX/models` and its manifests, local inference code and browser assets. Keep model binaries and private JSON out of Git. Runtime caches stay within CODEX. For synthetic verification use local Vitest configs and `ECHO_ISOLATED_TEST=true` for Python; never run live integration scripts against a connected project by accident.

Recorded validation (from the earlier reports, not rerun by this dependency handover): frontend full 1,102 tests; backend full 922 with 4 gated skips plus later targeted Talk coverage; Python 37 with 1 gated skip; 21 isolated SQL suites; 43 final real-model Talk turns, complete speech/JSON reopen in three language cases, synthetic Edge VAD/permission/cleanup tests, and nine CPU/GPU support-check parity cases. Consult [real-time validation](realtime-talk-validation.md), [core validation](core-integration-validation.md), [local JSON validation](local-json-validation.md), [journal screening](journal-phq8-integration.md) and [speech setup](speech-environment.md) for scope/date/evidence rather than treating historical counts as current-checkout certification.

**Remaining release gaps:** real-time first-audio p95 was English 16.408 s, Filipino 21.687 s, Taglish 18.525 s, exceeding 10 s. Final English/Filipino samples were only 6/7, Taglish 30; do not pool earlier baselines as final-build approval. Preparation was about 265.5 s in that run. Hardware microphone/listening quality, real account/launcher flow and deliberate real GPU exhaustion remain unverified. Synthetic checks do not validate clinical/language accuracy. npm previously reported 15 moderate development-tool findings; this handover did not refresh the network vulnerability audit. Current dependency consistency is not a security clearance.

Rollback: omit the experimental flag to retain manual speech; preserve JSON history. Selected pre-real-time file backup is `CODEX/integration-backup/realtime-talk-20261031-130349`; other earlier integration backups also exist. Review before restoring because the tree contains unrelated edits. Restore package manifests/locks with their matching environments, not one environment's packages into another. Do not delete source experiments, recalibrate checkpoints, reset the database, or overwrite the entire tree to roll back one feature.

## 5. Handover artifacts and limitations

This handover directory supplies the complete installed-package inventory, declared dependency metadata, lock comparison and observed changed-path list. Repository status was read using a command-local `safe.directory` override because this session has different filesystem ownership; global Git configuration was not altered. No package was installed, removed, repaired or upgraded. The older `.venv` failure is documented rather than silently replaced. No private journals, local conversation files, credential files or environment-file contents were read.
