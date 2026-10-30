# Local JSON analysis and Buddy

From `E:\Python Project\CODEX\Echo`, run `.\scripts\start-local-core.ps1` without `-EnableWorker`. Stop existing development instances first if their ports are occupied. The launcher uses Thesis2_VENV and CODEX/models. No additional dependencies or models are needed.

Supabase still provides authentication, encrypted journals, consent and account eligibility. This is not an offline application. New analysis jobs, native results, progress, review decisions and saved Buddy conversations use readable JSON under `E:\Python Project\CODEX\local-data\Echo`. Files survive restarts and logout; anyone with filesystem access can read them. Git and static file serving exclude them. Cloud history is not imported.

In Settings / Privacy, enable Journal analysis consent. Every new final Save then starts local analysis. Draft autosaves do not run models. Existing journals are not backfilled. Verification, current policy and trusted-contact requirements remain. Concerning language can pause analysis for authorized review. Missing analysis is never a low score.

XLM-R runs classification, E4 returns native emotions, and Buddy uses the selected CBT adapter/base. Model loading remains offline with one resident GPU model. No clinical severity, screening estimates or facial emotions are invented.

Settings / Privacy provides local JSON download and delete buttons. The cloud account export excludes local records. Editing a journal body invalidates its local result; deleting the journal removes its local job. Pending jobs recover after restart, subject to current consent and ownership. Failed jobs allow three retries. Corrupt files fail visibly rather than being silently discarded. A writer lock prevents sharing one directory between simultaneous backends; stale locks are reclaimed only after their owner exits.

Authenticated endpoints relative to `/api/v1`:

- GET /local-data: download this account's local records.
- DELETE /local-data: delete local analysis and Buddy history, keeping cloud journals.
- POST /local-data/analysis/:journalId/retry: retry failed analysis.
- DELETE /local-data/analysis/:journalId: remove/cancel local analysis.

Manual backend configuration uses `AI_ANALYSIS_MODE=local_json`, `LOCAL_DATA_DIR` (prefer absolute), and the existing loopback AI service URL/token. The core launcher supplies these automatically. `-EnableWorker` remains restricted to disposable Supabase and is a different mode. No hosted migration is needed.

The backend reconciles deleted accounts while running: a confirmed identity-not-found response clears local history. Offline installations cannot observe account deletion until they reconnect. No local outputs are uploaded for reconciliation.

`/health` checks liveness; `/ready` checks database access, writable/valid JSON storage and model readiness separately. Configured local inference failures do not fall back to cloud or scripted successful analysis.

Tests use `vitest.local.config.ts` to avoid reading environment files. Set TEMP/TMP to a writable workspace cache. Standard suites skip the GPU integration test; `ECHO_VERIFY_LOCAL_JSON=true` enables the actual-model synthetic Express/disposable SQL/JSON test. It never connects to hosted Supabase.

Contact-review requests linked to local analysis are unavailable in this temporary mode; the API returns an explicit unavailable response rather than copying context into cloud safety tables. Support resources and the authorized local analysis review endpoint remain available.
