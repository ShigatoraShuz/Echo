# Six reliability fixes — November 10, 2026

Scope: the six findings in the November 10 app audit. Existing UI, animations, journal edit/reset transaction, model weights, consent and account verification remain in place.

| Finding | Implemented behavior | Verification |
| --- | --- | --- |
| Unsaved saved-entry edits lost on navigation | Themed Keep editing / Discard and leave dialog; browser unload warning; revision-scoped in-memory SPA recovery, cleared with sensitive account state. No journal text in browser storage. | Automated guard/detail tests; actual localhost Keep editing preserved writing; Tailscale Discard and leave navigated without saving temporary text. |
| Expired model leases / failed preparation stuck | Shared single-flight ownership loop, missing-lease reacquisition, bounded network backoff, focus/manual retry; denied access stops automatic retries. Server preparation has bounded retry/cooldown. | Expired-lease, denied-access, retry-budget, late-unmount and server-preparation regression tests. Restarted live server with pages open; Tailscale Buddy Retry advanced from failed to preparing without reloading the page. |
| Capacity contention consumes permanent failures | Separate CAPACITY_WAIT callback; retrying preserves progress, refunds failure attempt, increments a capacity-wait counter. Fresh recovery receipts prevent repeated waits sticking. | AI busy fault injection and isolated SQL four-cycle regression, including stale-lease rejection. Migration applied to connected Echo database. |
| Short heartbeat interruption closes session | Inferred network absence has a bounded 30-minute reconnect grace. Explicit last-tab release keeps 30 seconds; explicit logout remains immediate and final. | Session-store interruption/reconnect, expiry and logout tests. |
| Progress arrives after inference | Actual stage callbacks occur during category/PHQ processing and before Buddy generation. Labels describe journal category, not validated distress severity. | Staged runtime tests and actual synthetic edited-journal analysis observed at Preparing Buddy suggestions before generation finished. |
| Literal Markdown recommendations | React-rendered paragraphs, ordered actions, bold and italic emphasis; HTML stays escaped. | Rendering/XSS regression tests; saved model recommendations displayed as numbered actions with emphasis. |

## Validation evidence

- Frontend full suite: **1,373 passed** with two workers. After final italic/progress-copy refinements, the targeted journal result/status/detail suites passed **25 tests**.
- Backend full suite: **1,215 passed, 5 skipped**.
- AI targeted integration/regression suites: **68 passed**.
- Isolated SQL validation: **27 files passed**, including the new capacity-wait regression.
- Type checks, full frontend lint (zero errors), and backend lint passed. Final optimized frontend build passed. A pre-existing unescaped dashboard apostrophe was converted to an HTML entity; displayed text is identical.
- Actual labeled synthetic journal: `eac4983a-e22d-4866-900a-3238ec7ac7b8`, title **TEST ONLY — Edited Buddy recommendations — Nov 10**. Edited through localhost UI; fresh analysis completed with Buddy recommendations; same saved report loaded through private Tailscale HTTPS.
- Both localhost and private Tailscale readiness endpoints verified after restart. See final working-tree verification for any later changes.

## Practical limits

These results address the six reported defects; they are not a guarantee that every possible device/network condition is error-free. Repeated capacity contention and time-based session boundaries were tested with controlled faults/clocks, not by disrupting another user's real work. Native browser close/refresh warning has automated coverage; SPA navigation was exercised live. Physical webcam/microphone and a separate school-network laptop were not retested in this fix pass. Existing Supabase security-advisor baseline remained unchanged by the migration.

## Database change

`20261110121055_recover_temporary_model_capacity_waits.sql` adds the capacity-wait counter and updates existing worker callback/recovery transactions. It preserves service-role and lease checks; it does not expose a new public callback route or bypass account access checks.
