# Resource-limited recovery validation — 2026-11-06

The user explicitly authorized testing after the earlier source-only checkpoint. Tests run sequentially beneath a Windows Job Object with an aggregate **28,000,000,000-byte committed-memory ceiling and 60% CPU hard cap**, assigned before the worker resumes. All test descendants inherit the outer job, including nested model workers. Windows page-aligns the enforced memory limit to 27,999,997,952 bytes. These limits apply to the test tree, not other applications or the whole machine. No packages/environments, model weights, database policies or account credentials were intentionally changed; no push or deployment occurred.

Logs and machine-readable results are local under `E:\Python Project\PROJECTS\Thesis2\TESTING VOICE\1_BUDDY_TALK\echo-validation*-20261106`. Model reports use a separate test-report directory, preserving previous files under `models`.

## Automated results

| Check | Latest result |
|---|---|
| Shared contracts | Passed |
| Frontend/backend type checks | Passed |
| Full backend suite | **1,191 passed, 5 skipped**, 156 passing files |
| Frontend full first pass | 1,319 passed, 1 failed; obsolete synchronous voice-endpoint expectation |
| Affected frontend rerun | **28 passed** across four files, including corrected voice-job behavior |
| Full frontend final rerun | Pending at report creation |
| Python full rerun | **512 passed, 3 failed, 6 skipped**, 40.31 seconds |
| Frontend/backend lint | Passed with existing warnings |
| Backend TypeScript build | Passed |
| Production frontend build | Blocked by required production Supabase/public API configuration; the security guard was preserved |
| Architecture audit | Passed |
| Authentication-password policy check | Passed |
| Launcher JavaScript and PowerShell syntax | Passed |

Three Python failures remain in `test_model_management.py`: `test_drop_import_activate_and_rollback_keep_originals`, `test_duplicate_identity_is_not_resolved_by_directory_order`, and `test_hash_mismatch_cannot_activate_and_selection_is_preserved`. The legacy auto-imported Qwen research manifests require Transformers `>=4.57.6,<4.58`; the existing core environment provides 5.5.0. Tests expecting engineering readiness/activation consequently encounter the runtime-version guard. The active Buddy SeaLLMs selection was not changed to Qwen. No package downgrade or relaxation of production framework checks was performed. Skipped tests are not passes.

## Repairs driven by the run

- Migrated asynchronous local-store fixtures to await initialization, mutations and shutdown; preserved ownership, replay-conflict and corruption assertions.
- Exposed Buddy-store close for orderly shared-repository teardown.
- Kept corrupt export parsing behind sanitized service errors before one-time consumption.
- Updated voice mocks to the asynchronous job protocol and valid 48 kHz stereo segments; speech retry still sends the approved answer without another CBT call.
- Fixed validated fast RoBERTa/XLM-R single-sequence window preparation for the installed Transformers 5 API, whose tokenizer no longer exposes `prepare_for_model`. Direct tiny-model forward/window regressions passed in the Python rerun.
- Updated negative resource-limiter testing to remove inherited job credentials. It must test the missing-job case even when the entire suite itself runs inside a valid job; it must never start conversion as a side effect.
- Kept Expressive native hexadecimal errors visible through sanitized speech messages; corrected test-only lint issues and cleanup paths that could mask an original write failure.

## Resource observations

The first broad run peaked at 2,853,539,840 bytes committed; the first retry peaked at 2,899,918,848; the final backend/lint/UI run peaked at 2,924,802,048. All stayed under the enforced aggregate limit. CPU enforcement was queried through the Windows job API; these are not claims that total system CPU/RAM stayed below the limits.

## Real-model and browser acceptance

Synthetic GPU residency passed in 194.69 seconds: shared SeaLLMs loaded in 33.12 seconds, XLM-R in 14.57, E4 in 11.74, Nano/codec warm-up in 26.05. XLM-R/E4 inference, PHQ adapted/base passes, approved CBT generation and Nano synthesis all completed with stable shared CBT/PHQ worker identity. PHQ coverage was zero for the ordinary synthetic school text. CBT generation took 21.78 seconds and short Nano synthesis 4.56 seconds. Minimum stage-sampled global GPU free memory was 5,487,050,752 bytes (5.11 GiB), above the reserve; this check does not measure every transient peak.

The combined Expressive startup check **failed**, after 292.77 seconds, with `BUDDY_CBT_WORKER_UNAVAILABLE` during shared CBT preparation, before native MOSS speech. Its intended concurrent heartbeat/speech assertions were not reached. The exact underlying worker-failure cause is not established. This differs from the separately passing direct-worker residency check and remains an open integration failure.

Maximum-context stress **passed** in 344.28 seconds. The 3,196-input/900-generated-token context check completed in 116.92 seconds; PHQ retained 1,700 tokens for its long-input policy; oversized latest input was rejected and the same shared process subsequently approved a normal CBT reply. Twenty Nano sentence segments completed in 45.68 seconds using `[1,1,3,3,3,3,3,3]`. E4 was released for full-context capacity and restored afterward. Minimum 100 ms-sampled global GPU free memory was 4,029,435,904 bytes (3.75 GiB), above the reserve. This is synthetic execution, not listening review.

The final frontend rerun remains in progress at this report update. An additional isolated native MOSS check is planned to distinguish engine behavior from combined startup. Passing unit tests alone do not establish real Talk readiness.

Authenticated multi-tab flows, physical webcam/microphone capture, actual echo, listening quality and voice consistency remain distinct acceptance gates. Synthetic Whisper consistency is not human listening review. Production configuration remains a separate prerequisite. Filipino/Taglish remain experimental.

## Review limitations

The first backend pass was 1,163 passed/28 failed, and the intermediate rerun exposed teardown/API mismatches subsequently corrected; neither supersedes the final full backend result above. Earlier reports apply to earlier source snapshots. The complete system is **not all green** while the three Python failures, production build configuration and remaining real/browser/hardware acceptance are unresolved.

Automatic approval rejected a delete-then-replace operation on the old JSON test file because it could remove coverage. The file was subsequently updated in place, preserving its regression cases. No test coverage was deleted to obtain passing results.
