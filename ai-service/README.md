# ECHO AI service

## Separate model environments

Ordinary root `npm run dev` starts Next.js and Express, not this service.
The optional model implementations require separate environments; do not combine
the `inference` and `core` extras or replace one profile's libraries to satisfy another.

| Profile | Declared model libraries | Environment evidence |
|---|---|---|
| Research registry / `inference` | torch 2.10.0, transformers 4.57.6 | Current `uv.lock` includes inference/cuda, not core. |
| Incoming native `core` | torch 2.12.0+cu130, transformers 5.5.0, peft 0.21.0 | `requirements-local.lock` also contains 15 machine-specific file URLs; it is not a portable installer yet. |
| Speech subprocess | torch 2.11.0+cu130, transformers 4.57.6 | Separate `requirements-speech.lock` and speech interpreter; not covered by the CPU test environment. |

The project declares Python >=3.12; local isolated checks used Python 3.12.10.
That does not verify other interpreter versions, CUDA, checkpoint inference or speech.
`scripts/start-local-core.ps1 -Python <path>` accepts an explicit prepared native-core
interpreter; its existing default points to a teammate's environment. Do not point it
at the CPU research environment or run it merely to check dependency metadata.
Model roots/manifests also differ; preserve their identities and original artifacts.

The development instructions below describe the base service workflow. They are not
a supported installation recipe for all optional models or a claim of core readiness.


This FastAPI service is an internal inference boundary. It does not authenticate end users, store journals, or expose a browser-facing API. The Express backend is the only permitted caller and must send the internal bearer token.

The scaffold deliberately reports `ready: false` until a validated fine-tuned model loader and model artefacts are supplied. It does **not** fabricate a PHQ-8 score or a clinical result. Model artefacts belong in `model-artifacts/` locally and are ignored by Git.

## Development

```powershell
Copy-Item .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Health does not require a token: `GET /health`. Readiness, model metadata, and analysis are internal endpoints. The application returns only a safe unavailable response until a production-safe model runtime is implemented and verified.

## Approved integration containment (2026-10-31)

The native core owns `/v2/analyze`, `/v2/classify`, `/v2/chat`, `/v2/speech`,
`/v2/runtime` and `/v3/screening`. The retained research registry owns
`/engineering/v2/analyze`, `/engineering/v2/generate` and `/engineering/v2/models`.
Both require the server-only internal token. No compatibility redirect exists.
The frontend continues to call authenticated Express routes only.

**Historical containment baseline (2026-10-31):** native activation was blocked with
`CORE_MODELS_ENABLED=true` or `WORKER_ENABLED=true`, before loaders/worker callbacks.
Native speech uses plaintext temporary subprocess files; core and speech also
need incompatible libraries. The retained optional CBT research cascade also writes
plaintext IPC and prints generated expert notes; native HTTP chat calls direct
`infer_v41`, not that cascade. These implementations remain research source, not an
approved application profile. A disabled native API returns unavailable, never a
fabricated model result. Do not run the native launcher or smoke scripts to work
around this guard. Default base service and metadata-only registry remain usable.

That baseline rejected `AI_ANALYSIS_MODE=local_json` or any `AI_SERVICE_URL` during
configuration validation. This prevents constructing plaintext local stores or
sending user content to native core in the application. No automatic substitution
of storage/backend, encryption backfill, record deletion or account change occurs.
Existing local JSON files are not opened or migrated by this remediation.
Normal startup and encrypted cloud history use the existing standard profile.

Future environment preparation must use **new, service-specific** Python 3.12
virtual environments (e.g. `.venv-inference`, `.venv-core`, `.venv-speech`), check that
paths do not already exist, and never reuse or overwrite a teammate's environment.
The inference lock can be reviewed with `uv sync --locked --extra inference` in its
own environment; do not combine `core` and `inference` extras. This command was not
executed in remediation. Native installation is still blocked pending a portable
core lock: replace the 15 machine-local file URLs with researcher-confirmed versions,
then produce a separate resolved lock in a reviewed CUDA environment. Do not infer
those versions from the CPU environment or update the shared lock speculatively.
Speech uses its own interpreter and lock; never install it into core's environment.
Re-enabling native service also requires reviewed non-plaintext subprocess transport,
retention/consent/account isolation, native result callback compatibility and isolated
verification. New encrypted local persistence is deferred. No activation is implied
by these preparation instructions or the passing synthetic contract tests.


## Installed native bundle paths (2026-11-01)

The `echo-core-models-v1` bundle belongs at this checkout's `backend/models/manifest.json`.
`Settings.models_root` now resolves that absolute default independently of the current
working directory. A private `MODELS_ROOT` override is still honored. The retained
native launcher uses the same default and accepts `-ModelsRoot <absolute path>`;
the newer bounded text profile below now supplies safe launcher behavior.
No environment file or native/worker/Talk activation flag is changed by this update.

The native bundle is for `app.model.core.CoreRuntime`; it is not an
`echo-model-manifest-v1` research-registry bundle. Do not force it into
`ECHO_ACTIVE_MODELS` or change its schema/adapter provenance to make another validator
accept it. The separate engineering registry and its saved selections stay unchanged.

Native core expects `xlmr-v2`, `e4-c`, `cbt/base`, `cbt/adapter`, and
`phq8-seallms/adapter` below this root. Speech uses `voice/manifest.json` and the
separate speech interpreter; face uses `face_model/model_manifest.json` and the
separate face interpreter. Browser VAD files belong under
`frontend/public/vendor/buddy-vad`, not inside `voice/realtime`. Existing training
paths in adapter JSON are provenance; the native loader explicitly passes the local
`cbt/base` model object into both adapters. Do not rewrite hash-protected JSON to
replace those historical E: paths.

Artifact hashes, static shape/tokenizer checks, CUDA diagnostics and model readiness
are recorded in `artifacts/model-integration/LEO-INSTALLED-MODELS-VERIFICATION.md`.
Hash verification alone does not activate any runtime, prove inference compatibility,
or resolve the privacy and environment blockers above. Historical smoke scripts still
encode Leo's sibling `CODEX/models` layout; they are not safe installation checks and
must not be run to bypass activation safeguards.


## Bounded text-memory profile (2026-11-01)

The approved development exception requires `CORE_MODELS_ENABLED=true`, `CORE_TRANSPORT=text_memory`,
loopback host, a 32+ character internal token, no engineering active selections and Talk off.
`TextRuntime` uses bounded stdin/stdout JSON in an isolated child: no payload files, inherited DB/service
credentials or private logs; one request at a time; a maximum 270-second deadline kills/reaps failures.
The child verifies exact code/weight hashes, probes an actual CUDA kernel, and lazily loads text models.
Speech/face methods remain denied; the optional source is preserved. PHQ-8 is semantically unverified
and unavailable in the served profile. A failed model never generates a replacement success.

For application jobs, Express additionally requires `AI_CORE_PROFILE=local_encrypted_worker`,
`AI_ANALYSIS_MODE=local_worker`, separate service/worker tokens and a loopback local Supabase target.
It seals native v2/v3 results using the existing AES-GCM history format and the existing authenticated
lease/idempotency/gate transaction. Plaintext `local_json`, hosted targets and Talk remain denied.
No new storage scheme or migration was introduced. New worker activation was tested with mocks only.

Use the pinned Windows environments and startup procedure in
[the runtime report](../artifacts/model-integration/ECHO-LOCAL-MODEL-RUNTIME-READY.md).
The earlier environment/blocker paragraphs are historical; they do not authorize the old tempfile IPC,
research cascade or historical live smoke scripts. Do not combine the Transformers 4.57 and 5.5 environments.
