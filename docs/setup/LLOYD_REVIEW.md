# Model integration review

This branch connects native text inference and final v4 face evaluation to Echo, adds encrypted journal-linked facial results and displays saved model outputs in dashboard/insights. Buddy inference queues overlapping requests; memory-budgeted model reuse avoids reloading the writer between journal and Buddy calls. The camera UI shows the landmark mesh and status indicators; the raw video remains hidden.

## Latest review update (2026-11-03)

- Includes Lloyd's main changes through `25fde34`, with the journal/dashboard/insights and model integration work preserved. The message drawer opens reliably on its first click.
- Custom tab-change WAVs rotate without consecutive repeats; dialogs use the dedicated popup clip. Enable Interface sounds in Settings > Profile > Appearance. The app fetches one versioned JSON bundle instead of media download links, avoiding the direct WAV requests intercepted by IDM. To replace clips, update `frontend/assets/interface-sounds/` and run `node scripts/build-interface-sounds.mjs`.
- Find help uses verified session-aware navigation: signed-in users retain the app menu, and visitors retain public directory access. Search, filters, narrow layouts and both directory/guidance scrolling were browser-checked.
- See [TAB_NAVIGATION_PERFORMANCE.md](TAB_NAVIGATION_PERFORMANCE.md) for all nine before/after navigation timings, cache scope/invalidation, live eligibility checks and validation limits. Most repeat screen transitions measured 44–91 ms locally; Buddy and Insights retain fresh backend checks and measured about 1.3 s.
- Latest validation: 1,255 frontend tests, 61 affected backend checks, focused follow-up tests, type checks, lint and production build passed. Browser regressions covered custom audio without WAV download events, Find help, data refresh after AI completion, and denied-access protection for cached views. No models or inference settings were changed by this performance update.

## Setup

1. Install Node 24+ and run `npm ci`.
2. Supply the existing backend `.env` for your intended Supabase project. Preserve its encryption/idempotency keys. Never generate replacement encryption keys for an existing database.
3. Obtain the existing approved text bundle from the team's model handover and install its manifest/files under the sibling `../models` folder. The immutable vendor bytes must match the bundle manifest. Use Python 3.12 and the isolated environments described in `ai-service/README.md` and `requirements-core-windows.lock`.
4. Obtain the COMPLETE final v4 `model-final/model` export from the team (six files including `package_checksums.json`). Run `python scripts/install-final-face.py "PATH_TO_MODEL_FINAL/model"`. Create `ai-service/.venv-face` and install `ai-service/requirements-face-windows.lock` there. Do not mix v3 and v4 runtime files.
5. Apply repository migrations to a fresh database, or apply the native-worker and final-face migrations plus `20261101220000_remove_manual_journal_mood.sql` to a matching existing database. They are already applied to the owner's hosted test project. Do not replay existing migrations blindly against an existing project.
6. Configure the ignored account/project scope as explained in [INTEGRATED_MODELS.md](INTEGRATED_MODELS.md). Use your intended development account IDs and a stable activation time. No credentials, weights or account-specific scope are included in Git.
7. Run `npm run dev` once. The launcher starts native models, backend and frontend; hosted Supabase does not require Docker Desktop. First inference still loads model weights. Stop the old development terminal before starting another instance.

## Review flow

Sign in with an approved adult test account, complete the normal verification/trusted-contact/policy gates, and enable journal/facial analysis in Privacy settings. In Settings > Privacy, turn Automatic facial analysis On and save Privacy. Open Journal > New and start writing: the live landmark mesh and corner status appear automatically; the raw webcam image remains hidden. More options and manual mood choices have been removed. The left card is the journal; the right card contains capture, model progress and the saved tabbed report. Save a reflection while one usable face is detected; its separate face result must appear on the journal after reload, and in dashboard/insights saved facial signals. Leave the page or turn the setting Off to release capture. Denying camera access must not prevent text-only journaling.

Face frames are transient local inference inputs. Only the validated expression output is stored encrypted. Expression scores are uncalibrated, separate from text emotion and not evidence of a person's actual emotional state or a diagnosis. No neutral class exists in this model. PHQ-8 experimental estimates use conservative adapter/base agreement; missing or disagreeing criteria stay null, partial coverage is an unscaled subtotal, and only eight numeric criteria produce a total. The model outputs are not questionnaire responses or a diagnosis. Voice and realtime Talk are not enabled by this profile.

## Validation performed

Actual physical camera -> browser capture with hidden raw video -> final v4 -> encrypted hosted journal result -> journal reload -> dashboard and insights was verified. No simulated camera was used for that completed run. SQL ownership/consent/browser-access checks passed in 24 disposable database suites; frontend/backend type checks and affected journal/dashboard/insights checks passed. The wider frontend suite previously passed 1,179 tests; it predates the final face persistence addition. Model reuse was compared with four identical before/after outputs; warm timings are workload observations, not universal latency guarantees.

The local app is verified; production deployment and independent face-model accuracy were not evaluated. Local credentials, model files, original camera-test records, screenshots and private test artifacts are intentionally excluded from this review branch.


## Latest UI and performance review (2026-11-02)

- Dashboard and Insights use saved real outputs. Open Details, full reports, history and PHQ-8 criteria; try period filters, keyboard navigation and mobile layouts.
- PHQ-8 SEA LLM was tested through a new journal UI submission, actual inference, persisted result reload, dashboard and insights. A fictional fully specified example produced 8/8 criteria and 24/24; a partial example retained 1/8 and a subtotal of 1 with no invented total. The PHQ tab distinguishes successful inference with missing evidence from unavailable results.
- Three local-development measurements per page gave median readiness: dashboard 7,982 → 2,571 ms; insights 8,076 → 2,495 ms; editor 3,275 → 2,265 ms; saved journal report 4,029 → 3,519 ms. These are observations on the owner's running stack, not production or cross-machine guarantees.
- Optimizations remove duplicate pending reads, batch account-scoped face-history checks, parallelize independent reads, defer secondary reports, coalesce hover updates per animation frame and reuse projected mesh coordinates. Layouts, animation timing, model weights and inference settings are preserved.
- Latest checks: 171 frontend tests, 11 backend tests, frontend/backend type checks and production frontend build passed. Actual browser dashboard/insights dialogs, filters, responsive layout and focus checks passed.
- The latest physical-camera performance check passed startup, worker readiness, Off/On, track cleanup and saved face-result propagation. No face was detected during that run, so fresh live-face inference was not revalidated; the earlier actual-camera inference/save verification remains separate.

Repeat browser checks with `ECHO_TEST_EMAIL` and `ECHO_TEST_PASSWORD` set for your development account:

```powershell
node frontend/scripts/check-dashboard-premium.cjs
node frontend/scripts/check-insights-premium.cjs
```

For camera checks with a person in view use `check-face-studio-physical.cjs` followed by `check-face-studio-lifecycle.cjs`. The physical check can create an explicitly fictional journal when there is no existing draft; review its saved evidence locally. For loading measurements set `ECHO_TEST_JOURNAL_ID` to an existing analyzed test journal and run `node frontend/scripts/measure-polished-pages.cjs`. These scripts require the already configured local app; credentials and model bundles are supplied separately.

## Local support-flow update

See [JOURNAL_SUPPORT_FLOW.md](JOURNAL_SUPPORT_FLOW.md) for the new priority support card, optional three-submission check-in, return-to-journal flow, and exact verification limits. This follow-up is included on the current review branch.
