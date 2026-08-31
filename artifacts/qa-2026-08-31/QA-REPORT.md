# ECHO backend and frontend QA — 31 August 2026

## Verdict: conditional / not ready for full end-to-end sign-off

Automated tests, builds, and supplemental database transaction tests pass. The updated
components were exercised in a real browser, but authenticated end-to-end testing is
blocked by runtime configuration and the lack of a signed-in test account. Three UI
defects and incomplete privacy/type-generation follow-up were identified. This QA pass
does not implement fixes or change remote application data.

## Evidence levels

- **Live app:** the unmodified Next frontend on port 3000 redirects an unauthenticated
  dashboard visit to login. Screenshot 01 records this actual application state.
- **Browser component QA:** screenshots 02–31 use the actual implementation components
  and repository CSS, with in-memory fixture dependencies. The visible QA banner
  identifies the isolation. Next navigation/image shims and font fallbacks are used;
  these are component previews, not authenticated full-stack screenshots or pixel-exact
  deployment captures. No real journal content is included.
- **Backend:** existing Express/service/security tests and full migration-chain SQL
  tests ran locally. Read-only PostgREST checks used the linked remote project.
  Screenshot 32 is the rendered backend evidence report, not an application screen.
- **Not verified:** live authenticated journal submission, actual worker inference,
  real Realtime event delivery across two users, real model output, or completion-driven
  dashboard refresh through the full frontend→Express→Supabase path.

## Findings

### P1 — Backend cannot start with the current local configuration

`backend/.env` lacks `IDEMPOTENCY_HMAC_KEYS_JSON`. Calling the compiled configuration
loader with that environment reports: `The active idempotency HMAC key version is not
configured.` The fail-closed behavior is correct, but this blocks normal API startup.
The configured processor mode is `disabled`, so even after configuring the secret,
analysis should wait for a provider rather than claim real inference is available.

Reference: `backend/src/config/environment.ts:67`. Configure a dedicated secret and
matching active version through the normal configuration workflow; do not reuse a
database credential or weaken validation. No secret was generated or modified by QA.
The frontend environment file also does not configure the Supabase public URL/key;
authentication wiring must be checked before a signed-in end-to-end run.

### P1 — Analysis modal becomes unreadable in dark mode

Reproduction: open the implemented modal in a dark ThemeProvider, using `safety_checking`.
The dialog keeps a light fixed gradient while the heading resolves to
`rgb(242, 238, 227)`. The pale text is nearly invisible on the pale surface. The modal's
hardcoded background is shared by waiting, completion, failure, and safety states.

Reference: `frontend/src/features/journal/components/analysis-status-experience.tsx:231`.
Evidence: screenshot **28-dark-mode-contrast-issue.png**. Use a theme-aware surface/text
pair and check every state in both themes; no source fix was made during QA.

### P2 — Minimizing the modal loses keyboard focus

Reproduction: activate “Show state,” then “Minimize analysis progress.” The browser's
active element becomes `BODY`, rather than the opener or the minimized control.
The source captures `document.activeElement` only *after* focusing the dialog, so it
remembers the dialog itself rather than the original control.

Reference: `frontend/src/features/journal/components/analysis-status-experience.tsx:171`.
Capture the opener before moving focus, and explicitly focus a surviving control on
minimize/dismiss. The minimized visual state is in screenshot **11**.

### P2 — Analysis gate failure is mislabeled as draft-save failure

Reproduction: type a valid journal and request analysis; return a consent gate rejection.
The text and analysis checkbox remain intact and an appropriate gate message appears,
but the autosave badge changes to “Draft save failed.” Submission/gate failure and
draft persistence are separate outcomes, so this message is misleading.

Reference: `frontend/src/features/journal/view-model/use-journal-editor-view-model.ts:89`
and `:292`; `frontend/src/features/journal/components/journal-autosave-status.tsx`.
Evidence: screenshot **04**. Keep submission errors separate from autosave status.

### Privacy follow-up — Existing title coverage is incomplete

Read-only PostgREST counts found **2 of 2 canonical journals and 1 of 1 draft** with
titles different from `[encrypted]`. These are legacy-title rows awaiting backfill or
investigation. This check did not retrieve/decrypt content and does not establish
whether ciphertext matches those titles. It is not evidence of new plaintext writes.

The migration enforces future writes, but applying it did not perform the service-role
ciphertext backfill. Do not certify plaintext-title coverage until the existing
authenticated backfill and mismatch/unreadable checks are run through an approved
remote workflow. No rows were changed or deleted in this QA turn.

### Type/lint follow-up

- `backend/src/infrastructure/supabase/database.types.ts` still has no service-schema
  definitions. Successful TypeScript compilation does not mean the database contracts
  have been generated. Official server-side type generation remains outstanding.
- Frontend lint still fails at the pre-existing
  `frontend/src/features/buddy/view/__tests__/buddy-view.test.ts:32`
  (`@typescript-eslint/no-this-alias`). The file was not changed by this task.

## Automated verification

| Check | Result |
|---|---|
| Frontend tests | PASS — 271 tests in 65 files |
| Backend tests | PASS — 129 tests in 28 files |
| Frontend and backend type checking | PASS |
| Shared contract + frontend + backend production build | PASS |
| Supplemental PostgreSQL/WASM full migration chain | PASS |
| SQL security and transactional lifecycle suites | PASS — both new suites |
| Backend lint | PASS with 30 warnings, no errors |
| Frontend lint | FAIL — 1 pre-existing error, 66 warnings |
| Backend configured startup readiness | BLOCKED — missing HMAC key configuration |
| Native local Supabase / two-user Realtime delivery | NOT RUN — Docker virtualization unavailable |

The test suites cover journal idempotency/gates, callback receipts and leases,
transactional completion, retry/safety state transitions, encryption backfill rules,
retention, RLS, and owner isolation. Their passing status does not replace live E2E.

## Remote read-only checks

Project: **ECHO UPDATED THESIS2** (`lruciislmmqvcwweqjop`).

- Service-role queries reach `journal_service` and `ai_analysis` through PostgREST.
- `LocalWorkerService.protocolHealth()` returns protocol/storage available with
  `modelHealth: not_asserted`. This says nothing about real model readiness.
- `run_retention(p_dry_run: true)` succeeds; all eligible-purge counts are zero.
- Unauthenticated API reads are rejected. These HTTP results alone do not prove
  authenticated cross-user RLS; the catalog was checked separately.
- Projection RLS is enabled; its owner policy is `auth.uid() = user_id`.
- `anon` has no projection SELECT; `authenticated` has no projection writes or
  private `ai_analysis` schema usage.
- No tables from `ai_analysis`, `journal_service`, or `buddy_service` are published
  to the Realtime publication.

Structured results are in `backend-readonly-results.json`.

## Browser checks

| Behavior | Result / evidence |
|---|---|
| Private editor and explicit per-entry analysis | Rendered; screenshots 02–03 |
| Gate rejection preserves text and consent checkbox | PASS with fixture response; screenshot 04 |
| Same request reuses key; edited request generates new key | PASS: initial / same / new; screenshot 05 |
| Explicit analysis-off save | No analysis modal; fixture-only save; backend tests cover no-job transaction |
| Empty and simulated dashboard | Rendered without invented empty-state trend; screenshots 06–07 |
| Detailed non-diagnostic result | Rendered with simulation label; screenshot 08 |
| Global consent wording | Explicit new-entry-only wording; screenshot 09 |
| Waiting + minimized states | Rendered; screenshots 10–11; focus issue above |
| Every processing state | Rendered from fixed status inputs; screenshots 12–19 |
| Retry UI monotonicity | PASS: 70% retained after lower queued input; screenshot 20 |
| Completed and failed states | Rendered; screenshots 21–22 |
| Safety pause and support controls | Rendered, no ordinary-analysis resume control; screenshot 23 |
| Trusted-person explicit consent | Request button disabled until contact + permission; screenshot 24 |
| Review-only confirmation | States no one has been contacted; screenshot 25 |
| Buddy handoff | Approved activity, no journal content; screenshot 26 |
| Buddy activity selection | Fills unsent draft only; screenshot 27 |
| Dark mode | FAIL: poor modal contrast; screenshot 28 |
| Mobile editor/dashboard at 390×844 | No horizontal document overflow; screenshots 29–30 |
| Mobile safety panel | Scrollable; footer reachable; screenshot 31 |

No real support requests, guardian notifications, or Buddy messages were sent. A real
AI/result screenshot is intentionally not provided because there is no real model.

## Reproducing the isolated component previews

From repository root:

```text
node node_modules/vite/bin/vite.js --config artifacts/qa-2026-08-31/harness/vite.config.mjs --configLoader native
```

Open `http://127.0.0.1:4310/`. The harness imports actual components and mocks only their
data/navigation dependencies; all fixture operations stay in memory. It is not part
of the application build. `backend-readonly-qa.mjs` only performs read operations and a
retention dry run; it deliberately does not start `server.ts`, whose maintenance loop
can mutate remote records.

## Scope preserved

No fixes to application source, secrets, applied migrations, or user layout changes
were made. No remote writes, database resets, backfills, deployments, commits, or Git
pushes occurred during QA. Only local QA artifacts and normal generated build output
were created.
