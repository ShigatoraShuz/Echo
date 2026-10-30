# Local JSON validation - 2026-10-30

No hosted migrations, registration submissions or test records were performed. The disposable integration uses a synthetic token verifier; live Supabase authentication and a full browser journey were not exercised. Tests use synthetic inputs only. Existing source models and calibrations were not changed. No packages were installed or upgraded for this change.

| Check | Status | Evidence |
| --- | --- | --- |
| Backend types and build | Passed | TypeScript checks and backend build |
| Frontend types | Passed | TypeScript check |
| Frontend regression suite | Passed | 540 tests across 119 files; editor targeted tests also rerun after final consent-display adjustment |
| Backend regression suite | Passed | 388 tests; optional GPU test skipped in normal run |
| Python suite | Passed | 13 tests; existing Starlette/httpx deprecation warning |
| SQL migrations and isolation suites | Passed | All 21 suites in disposable PostgreSQL/WASM |
| JSON persistence, ownership, duplicate saves, corruption, exclusive writer | Passed | local-json.test.ts |
| Support pause, unavailable provider, revoked consent, cancellation, retry bound | Passed | local-json-stages.test.ts |
| Journal and Buddy routes with ordinary encrypted journal saves | Passed | local-json-flow.test.ts and isolated SQL adapter |
| Actual copied models through Express and JSON | Passed | local-json-gpu.test.ts, separately enabled; 113.69 seconds total |
| English, Filipino and Taglish synthetic journals | Passed | Three completed jobs, retrieved through journal analyses HTTP route |
| Buddy generation and reopening | Passed | Actual selected CBT generation, JSON reopen |
| No database analysis/Buddy writes | Passed | Disposable DB analysis_requests, analysis_results and buddy_messages counts remained zero |
| Restart/reopen of completed results | Passed | Three native v2 records reopened from disk |
| Authentication and invalid empty model input | Passed | Model service returned 401 and 422 respectively |
| GPU residency and memory | Passed | One resident model; measured peak 6,283,582,464 bytes (about 5.85 GiB) |
| Full browser interaction with real authentication and camera | Unverified | API integration and component tests do not establish this |
| Forced disk-full/power-loss recovery | Unverified | Atomic replacement and fsync implemented; destructive fault injection not performed |
| Completed cloud account erasure reconciliation | Unverified | Confirmed user-not-found reconciliation implemented; no real account was deleted |
| Local-analysis-linked contact review request | Unavailable | Explicit error; no context copied into cloud safety tables; support resources remain available |

The GPU smoke measurement recorded about 6.03 seconds for journal inference and 27.36 seconds for Buddy generation, separate from model startup. Last observed load times: XLM-R 2.99 seconds, E4 1.19 seconds, CBT 9.38 seconds. These are synthetic smoke measurements, not accuracy or clinical validation. Raw smoke metrics are in CODEX/integration-backup/core-http-result.json. Synthetic JSON integration records remain under CODEX/runtime-cache/local-json-flow, separate from application history.

Startup and storage details: [local-json-storage.md](local-json-storage.md).
