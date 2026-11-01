# Model integration review

This branch connects native text inference and final v4 face evaluation to Echo, adds encrypted journal-linked facial results and displays saved model outputs in dashboard/insights. Buddy inference queues overlapping requests; memory-budgeted model reuse avoids reloading the writer between journal and Buddy calls. Face camera UI shows indicators only: video and mesh remain hidden.

## Setup

1. Install Node 24+ and run `npm ci`.
2. Supply the existing backend `.env` for your intended Supabase project. Preserve its encryption/idempotency keys. Never generate replacement encryption keys for an existing database.
3. Obtain the existing approved text bundle from the team's model handover and install its manifest/files under `backend/models`. The immutable vendor bytes must match the bundle manifest. Use Python 3.12 and the isolated environments described in `ai-service/README.md` and `requirements-core-windows.lock`.
4. Obtain the COMPLETE final v4 `model-final/model` export from the team (six files including `package_checksums.json`). Run `python scripts/install-final-face.py "PATH_TO_MODEL_FINAL/model"`. Create `ai-service/.venv-face` and install `ai-service/requirements-face-windows.lock` there. Do not mix v3 and v4 runtime files.
5. Apply repository migrations to a fresh database, or apply the two new 20261101 migrations to a matching existing database. They are already applied to the owner's hosted test project. Do not replay existing migrations blindly against an existing project.
6. Configure the ignored account/project scope as explained in [INTEGRATED_MODELS.md](INTEGRATED_MODELS.md). Use your intended development account IDs and a stable activation time. No credentials, weights or account-specific scope are included in Git.
7. Run `npm run dev` once. The launcher starts native models, backend and frontend; hosted Supabase does not require Docker Desktop. First inference still loads model weights. Stop the old development terminal before starting another instance.

## Review flow

Sign in with an approved adult test account, complete the normal verification/trusted-contact/policy gates, and enable journal/facial analysis in Privacy settings. Open Journal > New > More options > Start camera. Only the face-analysis status and controls should appear. Analyze expression evaluates a temporary frame using v4. Save a reflection while one usable face is detected; its separate face result must appear on the journal after reload, and in dashboard/insights saved facial signals. Stop camera or leave the page to release capture. Denying camera access must not prevent text-only journaling.

Face frames are transient local inference inputs. Only the validated expression output is stored encrypted. Expression scores are uncalibrated, separate from text emotion and not evidence of a person's actual emotional state or a diagnosis. No neutral class exists in this model. PHQ-8 model estimates remain unavailable/null pending artifact semantic validation. Voice and realtime Talk are not enabled by this profile.

## Validation performed

Actual physical camera -> browser indicator-only capture -> final v4 -> encrypted hosted journal result -> journal reload -> dashboard and insights was verified. No simulated camera was used for that completed run. SQL ownership/consent/browser-access checks passed in 24 disposable database suites; frontend/backend type checks and affected journal/dashboard/insights checks passed. The wider frontend suite previously passed 1,179 tests; it predates the final face persistence addition. Model reuse was compared with four identical before/after outputs; warm timings are workload observations, not universal latency guarantees.

The local app is verified; production deployment and independent face-model accuracy were not evaluated. Local credentials, model files, original camera-test records, screenshots and private test artifacts are intentionally excluded from this review branch.
