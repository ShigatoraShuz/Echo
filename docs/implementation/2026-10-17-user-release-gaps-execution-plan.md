# ECHO user release gaps: implementation and acceptance plan

**Created:** 2026-10-17

**Owner:** User-facing ECHO web application

**Companion tracker:** [2026-10-15 mobile and release readiness plan](./2026-10-15-mobile-and-release-readiness-plan.md)

**R2/R3 acceptance detail:** [2026-10-18 authentication and mobile acceptance plan](./2026-10-18-authentication-mobile-acceptance-plan.md)
**Status key:** `done locally` = code plus focused checks; `accepted` = complete journey, relevant failure states, and device or hosted checks passed. Neither means ISO certification.

## Outcome and scope

A user should be able to sign up, navigate and use every advertised user feature on a phone, understand which results and notifications are available, and recover from failed requests without losing work. The release decision must be based on observed behavior, not a successful save response or an emulator screenshot alone.

This plan covers the public and ordinary-user web experience plus the backend contracts required by those controls. Preserve the current visual identity, routes, privacy boundaries, and the checkout's uncommitted work. Do not deploy, change the linked Supabase project or OAuth/SMTP configuration, create real practitioner accounts, or delete production data as a side effect of local implementation. A separate provider/model owner supplies real AI analysis; this plan only covers truthful UI and validated integration boundaries.

## Evidence and working rules

- The existing tracker reports locally implemented mobile landing, login recovery, app shell, Settings navigation, Journal flow, and partial Buddy, Grounding, Insights, professional support, and notifications. Its local browser checks do not establish physical-device or hosted acceptance.
- `frontend/src/features/settings/view/settings-views.tsx` explicitly says scheduled reminders, push, and email delivery are unavailable; the Settings API stores the related booleans and reminder time. `backend/src/features/notifications/notifications.service.ts` supports listing and read state, but no scheduled delivery is present in that service.
- Journal text drafts autosave. The private draft-photo migration is applied to the linked project; authenticated browser acceptance remains. Internal links, page unload and browser Back guard unsaved photos.
- Auth uses the Supabase Auth SDK. The local `supabase/config.toml` and Express registration limiter do not prove effective hosted Supabase limits or email deliverability.
- The checkout has substantial existing uncommitted frontend work. Review a file's diff before editing it; never reset or overwrite it.

## Skills and test tools

| Tool or skill | When to use | Output expected |
| --- | --- | --- |
| **Ponytail** (`C:/Users/ADMIN/.codex/plugins/cache/ponytail/ponytail/5.3.0/skills/ponytail/SKILL.md`) | Every coding slice | Smallest complete change, callers checked, targeted regression test. |
| **Impeccable** (`C:/Users/ADMIN/.agents/skills/impeccable/SKILL.md`) | Mobile UI, interaction, motion, accessibility, and failure-state work | Existing ECHO style retained, bounded desktop/phone review, reduced-motion and focus checks; run its detector after UI edits. |
| **Webapp Testing** (`C:/Users/ADMIN/.codex/skills/webapp-testing/SKILL.md`) and installed `@playwright/test`/`@axe-core/playwright` | Local browser journeys | Chromium and WebKit interaction, screenshot, console/network, viewport overflow and critical axe evidence. |
| **API and Interface Design** (`C:/Users/ADMIN/.codex/skills/api-and-interface-design/SKILL.md`) | New notification or attachment endpoint/contract | Explicit ownership, validation, idempotency, error shape and migration contract before code. |
| **Security Best Practices** (`C:/Users/ADMIN/.codex/skills/security-best-practices/SKILL.md`) | Auth, notification delivery, sensitive journal attachments | Review the existing Next.js/Express/TypeScript guidance; protect data at each trust boundary. |

The skills are local agent workflows, not production npm dependencies. Use the project's existing components and libraries unless a measured need justifies an addition.

## Delivery order and task tracker

| ID | Priority | Task | State | Acceptance evidence |
| --- | --- | --- | --- | --- |
| R0 | P0 | Baseline and regression harness | Done for current slice | Dirty checkout recorded; focused frontend/backend tests and typechecks; no pre-existing work overwritten. Repeat for each later slice. |
| R1 | P0 | Notification Settings must match actual delivery and masking | Code and linked schema implemented; real external delivery pending | The linked project passed reminder and fake-provider channel checks. A hosted worker, verified email credentials, VAPID keys, public flags, real inbox and physical-device checks are still required. |
| R2 | P0 | Hosted authentication and signup acceptance | Local failure recovery implemented; external verification pending | Registration draft recovery and clear network/429/5xx messages pass focused tests. Effective hosted limits/CAPTCHA, real email/password/Google/recovery and physical phone journeys remain. |
| R3 | P0 | Mobile navigation, Settings, accessibility, and motion acceptance | Partial: public emulation and focused signed-in flows passed | 92 public mobile checks pass with 4 tablet-only skips; 200% text-size and login/signup axe checks pass. Focused linked-project iPhone emulation passed Settings and Journal draft/photo flow. Full route sweep hit the shared limiter during synthetic rapid navigation; physical phones and screen readers remain. |
| R4 | P1 | Journal photo and draft loss prevention | Code, linked migration and focused live browser QA done; broader acceptance pending | Private draft photo upload, reload, retry, transfer on publication, deletion cleanup and export are implemented. Focused iPhone WebKit disposable-account browser check passed Back/draft/photo/save/reload/overview. Failure retry and physical-device QA remain. |
| R5 | P1 | Buddy, Grounding, Find Help, Crisis, notifications journeys | Partial: Buddy linked-project journey passed with a disposable synthetic gate fixture | iPhone WebKit reopened and continued an older Buddy chat after reload; owner isolation, history-off behavior, search and pinning passed API checks. Real identity review, physical-device and other R5 journeys remain. |
| R6 | P1 | Dashboard, Calendar, Insights and facial status clarity | Partial: Calendar analysis error fixed | Saved versus simulated versus pending/unavailable data are distinguishable; camera states and calendar dates/links verified. |
| R7 | P1 | Professional support communication and appointments | Linked technical journey passed with a synthetic practitioner fixture; credential-review acceptance pending | Two disposable accounts passed real Supabase MFA, request, claim, two-way messages, proposal, acceptance, owner Calendar, closed case history, notification destination and outsider denial. A genuinely reviewed practitioner account and physical-device check remain before production acceptance. |
| R8 | Release gate | Production build, performance, device and accessibility record | Pending | Production-mode route measurements, iPhone Safari, Android Chrome, slow/failing network, 200% zoom, reduced motion, and a dated route-by-route QA record. |
| R9 | Separate owner | Real AI analysis provider and model | Integration UI prepared; model not implemented here | Provider output passes shared contracts and evaluation; UI distinguishes pending, unavailable, simulated, and validated completed results. |

### R0 — Protect the baseline

1. Save `git status --short`; inspect changed-file diffs before each edit. Read `frontend/AGENTS.md` and relevant Next.js 16 docs from `node_modules/next/dist/docs/` before changing frontend routes.
2. Run the nearest existing tests and typechecks before and after each slice. Classify failures as baseline or introduced; do not hide unrelated failures.
3. Maintain the table above after a slice. Include the test command and dated result; use `partial` when a physical, provider, or two-account check is missing.

### R1 — Settings delivery and privacy contract

**Likely files:** `frontend/src/features/settings/view/settings-views.tsx`, `frontend/src/features/onboarding/*`, `backend/src/features/settings/settings.service.ts`, `backend/src/features/notifications/*`, shared settings contracts, `supabase/migrations/*` only if a new persisted delivery queue/subscription is required.

1. Inventory each notification setting: email, push, daily Journal check-in, grounding invitation, insights, quiet hours, target timezone, and lock-screen masking. Record where it is stored, who reads it, whether any event is emitted, and which client surface observes it. Do not treat storing a boolean as delivery.
2. Keep currently unavailable channels explicitly labeled in Settings and onboarding. If delivery is implemented, define a user-scoped event and deduplicated schedule, opt-in policy, timezone and daylight-saving behavior, retry limit, and content-free audit. Device payloads default to generic wording; masking is enforced where payloads are built, not only in the form.
3. Integrate email only after a verified sending domain/provider exists; integrate web push only with a permission and subscription lifecycle. Avoid hard-coded credentials and service-worker prompts on first visit. Until then, retain the truthful unavailable state.
4. Test preference save/reload, disabled delivery, quiet hours, timezone boundaries, duplicate jobs, and unauthorized users. Verify the Privacy Notice matches actual payload and retention behavior.

**Dependency:** SMTP/domain and push-provider decisions require owner configuration; no deployment or provider change is authorized here.

| Setting or channel | Current effect verified in source | Remaining implementation |
| --- | --- | --- |
| Analysis-ready update in app | The Journal completion trigger requires both `in_app_enabled` and `insight_notifications_enabled`; onboarding and Settings now expose the combined choice. | Hosted completion event and inbox deep link still need a real approved analysis job to verify end to end. |
| Account and professional support updates in app | Verification and professional services insert generic notices; the inbox lists owned notices and marks them read. | Two-account practitioner journey and all destination/error cases remain to be checked. These transactional updates may appear even if analysis-ready updates are off. |
| Daily Journal and grounding reminders | A service-only database function and separate worker create one generic in-app notice per user, kind and local day. The linked migration is applied; a disposable account verified delivery, duplicate prevention, quiet-hour suppression and resume, then was deleted. Local worker heartbeat is healthy. | Deploy and monitor a durable hosted worker, enable the frontend flag only after that, verify real-time delivery at the user's local time and on physical devices. |
| Push and email | Service-only delivery queue, retries, encrypted push subscriptions, Resend/SMTP adapters, browser opt-in, and generic payloads are implemented. A linked disposable-account test passed with fake senders. UI labels channels unavailable until deployment flags are set. | Supply verified sender credentials and stable VAPID keys, run a durable hosted worker, then verify actual email receipt and push delivery on real devices before enabling public flags. |
| Lock-screen masking | The server payload builder uses a generic title when privacy is on and a category-only title when off; neither path contains private message content. A linked fake-sender test checked the default masked path. | Verify both choices on a physical device after VAPID/provider setup. |

### R2 — Hosted authentication and signup

**Likely files:** `frontend/src/features/authentication/{view,view-model}/*`, `frontend/src/services/authentication/*`, `frontend/e2e/public-mobile.spec.ts`, `backend/src/features/registration/*`, and provider runbook/config documentation.

1. Confirm the hosted Supabase Auth project's effective sign-up, password, OTP-send, and OTP-verify limits and CAPTCHA policy. The repo's local config alone is insufficient. Use a safe staging/provider inspection, never brute-force the live project.
2. Verify signup and resend with a disposable account, including email quota/SMTP failure, expiry, incorrect code, retry delay, and clean error text. Verify password and Google sign-in on actual phones; record the exact OAuth origin if Google fails.
3. Keep password values opaque; use SDK fields, not SQL interpolation or character stripping. Preserve form input after network failure and prevent duplicate submissions. Confirm the 30-minute inactivity sign-out remains server/client consistent.

**Dependency:** Hosted provider settings, a working mail sender, and physical devices. These are acceptance tasks, not reasons to claim code is broken without evidence.

### R3 — Mobile shell, Settings and accessible operation

**Likely files:** `frontend/src/shared/components/{layout,navigation}/*`, `frontend/src/features/settings/{components,view}/*`, `frontend/src/config/navigation.config.ts`, app motion styles, and `frontend/e2e/*`.

1. Traverse every ordinary-user destination from Dashboard, Journal, Buddy, Insights and Settings with the phone drawer; preserve Crisis as an immediate action. Check notification badge and inbox with empty, loading, 401/503 and retry responses.
2. Audit each Settings control against API request and visible result: profile, verification, Privacy, notifications, trusted contacts, Security, export and deletion. Failed saves retain edits. Confirm destructive-action language and account deletion state.
3. Test 320/390/768 px, 200% zoom, landscape, keyboard focus and Escape return, long text, screen reader names, safe-area and soft-keyboard overlap. Honor system Reduced Motion and the user's Full Motion override; do not animate urgent support entry.

### R4 — Journal drafts and photos

**Likely files:** `frontend/src/features/journal/view/journal-editor-view.tsx`, `view-model/use-journal-editor-view-model.ts`, draft/detail/list views, journal service, and focused tests.

1. Reproduce browser Back/Forward with selected photos. A Back action must not silently discard attachments or writing. Prefer an explicit confirmation before leaving, save text draft, and keep Crisis links immediate. If browser interception is unreliable, implement an encrypted server attachment-draft contract before promising photo recovery; never persist sensitive photos unencrypted in browser storage.
2. Exercise partial upload success followed by failure and retry. Do not duplicate successful uploads; keep text available. Confirm five-photo, type/size, Polaroid crop, and URL cleanup behavior.
3. Verify create → leave → reopen draft → finish → saved full page → reload → overview, including signed-in ownership errors and offline/failure copy.

### R5 — Buddy, Grounding, public support and notifications

**Likely files:** `frontend/src/features/{buddy,grounding}/*`, `frontend/src/app/support/find-help/*`, Crisis views, `frontend/src/shared/components/navigation/notification-bell.tsx`, focused tests.

1. Buddy: new session, reopen older session, continue in same history, history-off temporary session, failed send retaining draft, 320 px keyboard/composer behavior.
2. Grounding: start, pause/resume, background/return timer, save uncertain response, history retry. Find Help: verified resource labels and directory failure. Crisis: immediate call actions with optional API offline and Reduced Motion.
3. For each in-app notification type, map to an existing owned destination or a safe no-link state; verify read/unread, failure/retry and focus return. A notification must not imply email or push was delivered.

### R6 — Dashboard, Calendar, Insights and facial state

**Likely files:** `frontend/src/features/{dashboard,insights}/*`, Calendar views and services, shared charts, `@echo/contracts` only if the existing response contract truly lacks a necessary field.

1. Audit every result label for source: self-reported mood/check-in, saved validated analysis, simulation fixture, pending provider, failed or unavailable. Never derive a clinical-looking score from a risk-band index or show an unavailable result as low risk.
2. Verify chart text alternatives, 320 px reflow, error/empty states, entry links, and local-date boundaries for Calendar and appointments.
3. Verify opt-in camera permission, denied/no-device states, capture progress, mesh-only privacy text, and explicit unavailable inference. Keep model and worker implementation separate.

### R7 — Professional support and appointments

**Likely files:** `frontend/src/features/professionals/*` user pages, `frontend/src/services/professionals/professional-api.ts`, `backend/src/features/professionals/*`, Calendar views/services, notification routing and tests.

1. Build a safe reviewed-practitioner test fixture or get an already reviewed test account. Do not bypass verification/MFA in production or use a real patient's data.
2. Complete user request → practitioner acceptance → message exchange → proposed/accepted appointment → user Calendar local date → notification destination → support history. Verify ownership from a second user and failed/retried API calls.
3. Empty directory and no assigned practitioner states must clearly explain availability. Keep professional-only portal changes outside this user-side plan unless a failing contract requires a narrow fix.

### R8 — Release evidence

1. Run focused tests after the final edits, typecheck/lint and the production build with real staging configuration. Do not use fake environment values to label a build production-ready.
2. Measure cold and warm navigation in the production build, especially login → Dashboard → Journal → Settings → Buddy → Grounding. Diagnose development compilation separately; only optimize a measured bottleneck.
3. Complete route-by-route iPhone Safari and Android Chrome QA: portrait/landscape, touch targets, soft keyboard, 200% zoom, Reduced Motion, offline/slow connection, 401/429/503 errors, keyboard and screen reader. Record date/device/browser, result, screenshot or log, and outstanding issue.
4. Mark a row `accepted` only with the required journey evidence. Keep provider, model, practitioner-fixture, and physical-device dependencies visible when unavailable.

### R9 — AI integration handoff (separate model owner)

**Likely files when a validated provider is supplied:** `packages/contracts/*` analysis schemas, backend analysis-worker adapter and tests, Journal/Dashboard/Insights status adapters and UI. Do not train, select, or simulate a production model in this plan.

1. Preserve the current optional submission and consent flow. The model owner supplies versioned outputs, a measured evaluation report, latency/failure targets, and a privacy review.
2. Validate provider output at the backend boundary before writing a completed result. Keep queued, failed, captured-pending-provider, unavailable, demo, and completed states distinct in the UI.
3. Run fixture contract tests, a provider sandbox test, and an authenticated UI journey. Do not call an analysis result clinical or available merely because saved Journal data renders.

## Immediate implementation slice

Start with a locally reproducible user-loss or misleading-flow defect, then update this file with the actual files and checks. Do not turn provider-dependent tasks into simulated success. The recommended first code slice is Journal browser Back with selected photos, followed by notification destination/failure coverage and the Settings preference-to-effect inventory. Keep each slice small enough to regress with focused tests.

### Progress record — 2026-10-17

- **R4:** `journal-editor-view.tsx` guards browser Back while photos are unsaved. Cancel keeps the editor; confirm saves the text draft before moving back. Draft photos now upload to private `journal-images` storage and are tracked by `journal_service.journal_draft_images`. Reopening a draft loads signed photo previews. Failed uploads retain the selected photo for retry with the same image ID; publication transfers uploaded photos to the finished journal in one database transaction. Removing/deleting a draft queues storage cleanup; account export and erasure include draft photos. Migration `20261018140000_journal_draft_images.sql` passed PGlite ownership, five-photo and transfer checks and was applied to the linked project on 2026-10-18. A route test caught and fixed an existing image route intercepting draft-photo uploads. Full frontend (117 files, 537 tests) and backend (70 files, 362 tests) suites, typechecks and backend build passed. The linked table and service-only RPC check passed; anonymous access was denied. The earlier disposable-account browser smoke covered Back decisions and published photos; the new draft-photo path still needs an authenticated browser journey before acceptance.
- **R5/R7 local QA:** Buddy routes require authentication plus verified AI access, and the tests cover history-off temporary chats, owner-scoped history, older-chat continuation and failed-send draft retention. Professional tests cover MFA and membership gates, case isolation, user appointment actions and Calendar’s local-day display of proposed appointments. These are local contracts, **not** a two-account live journey. No reviewed practitioner fixture exists yet; request, practitioner message, appointment and Calendar synchronization still require that test.

**Linked migration record, 2026-10-18:** `supabase db push --linked --include-all` applied `20261014090000_account_erasure_lifecycle.sql`, `20261014091000_professional_account_erasure.sql`, `20261014092000_category_retention_controls.sql`, and `20261018140000_journal_draft_images.sql`. A subsequent dry run reported no pending migrations. Service-role reads confirmed the new draft-photo and erasure-job tables; the category-retention dry run succeeded, but the policy approval row is intentionally **unapproved**, so destructive category retention remains disabled. The draft-photo reservation RPC returned the expected missing-draft error for a nonexistent owner, and anonymous table/RPC access was denied. No account deletion or retention worker was run as part of migration verification.

#### Journal and professional acceptance checks still to run

| Journey | Current evidence | Required live check |
| --- | --- | --- |
| Draft with selected photos | UI retry/reopen test, HTTP adapter test, authenticated route test, upload failure service test, PGlite migration test | With the Journal migration applied, select photos, leave, reopen, refresh, publish and confirm detail plus overview show the same images. Interrupt an upload and retry with the same selection before leaving; a failed upload remains local only and must show the leave warning. Verify no duplicate image. |
| Buddy access and continuation | Linked-project disposable fixture passed gate, history-off, owner-scoped search, pinning, browser older-chat continuation and reload on iPhone WebKit | Repeat with a genuinely reviewed account and physical phone; verify failed-network draft retention in the browser. |
| Practitioner to Calendar | Linked-project disposable fixture passed real MFA, outsider denial, two-way messages, proposal/acceptance, owner Calendar and closed history on iPhone WebKit | Repeat with a genuinely credential-reviewed practitioner and ordinary user in a private test organization, including failed-request retry and a physical phone. |

Do not label the second or third row accepted based on mocks or a single account. Remove only the disposable fixture after its IDs and related data have been reviewed.

### Buddy and professional linked QA — 2026-10-18

- Added the guarded `backend/tests/e2e/live-buddy-professional.mjs` acceptance runner (`npm.cmd run test:live:support --workspace @echo/backend` with `ECHO_LIVE_SUPPORT_QA=1` and `ECHO_LIVE_SUPPORT_QA_PROJECT=<linked project ref>`). It creates three disposable accounts and a clearly labeled synthetic practitioner organization. The practitioner uses actual Supabase TOTP MFA; the fixture uses synthetic gate approval and credential data, **not** real identity or professional review. All QA organization and account IDs are removed in `finally`; cleanup uses a guarded linked SQL query because service-role DELETE on professional tables is intentionally denied.
- Final linked-project pass: Buddy denies an unverified account, then an approved fixture with trusted contact opens two distinct conversations, searches and pins history, keeps history-off messages temporary, denies cross-account reads, and continues the older conversation exactly once after an iPhone WebKit reload. The ordinary user creates a support request, an MFA-gated practitioner claims it, both exchange messages, an appointment notice points to the case, the user accepts the proposal, and a third account cannot read/respond. The confirmed appointment appears on the user's mobile Calendar. The completed appointment and closed case appear in mobile Support History.
- QA exposed an early-completion bug: practitioners could mark a future appointment complete. `professional.service.ts` now checks case assignment before time and returns `409 APPOINTMENT_NOT_STARTED` until the scheduled start. The live test verifies that denial, then advances only its disposable appointment to the past before completing it. Focused backend tests (3 files, 27 tests), backend typecheck and the final linked browser journey passed. The linked database query after cleanup returned zero `echo-support-qa-*` users and zero `echo-qa-*` organizations. Mobile screenshots: `artifacts/qa/buddy-professional-calendar-mobile.png` and `artifacts/qa/professional-support-history-mobile.png`.
- **Production acceptance action:** provision a real reviewed practitioner test account through the Admin Professional Access review, enroll MFA, then repeat request → messages → appointment → Calendar → history on a physical phone with a separate ordinary test account. Verify a failed send/retry and remove the two test accounts afterward. The synthetic fixture validates engineering wiring but cannot validate human credential review or physical-device behavior.

The frontend production build was attempted on 2026-10-18 and stopped in `next.config.ts` because this local `.env.local` is configured for mock mode. Frontend typecheck, lint and all tests passed; a production build still needs the real public API and Supabase configuration in a staging build environment.
- **R5/U6:** Verification decision notifications now carry `identity_verification` and the reviewed application ID so the existing inbox link opens Verification settings. Backend notification insertion and frontend destination tests passed. Previously stored notifications without a resource type remain readable but have no destination.
- **R1:** Onboarding's notification choice now controls the existing in-app analysis-ready trigger flags, without silently opting users into unavailable push delivery. Settings exposes the same working choice and still labels scheduled, push and email preferences as future-only. Backend mapping and frontend save tests passed. Existing users whose analysis-ready flags differ can correct both with the Settings control.
- **R6:** Calendar analysis fetch rejection now displays its failure state instead of leaving “Checking for completed analysis…” indefinitely. The saved reflection remains accessible; a focused UI regression test passed.
- **R1/R9:** The final onboarding step now sends optional camera consent to the existing backend privacy setting and labels Buddy/analysis availability accurately. The backend preserves identity choices when setup only updates camera or notification preferences. Focused UI, HTTP-adapter and backend tests cover the path.

### Progress record — continued implementation, 2026-10-17

- **R1:** Added `20261017120000_in_app_reminder_delivery.sql`, a separate `worker:in-app-reminders`, and a deployment sequence. The service-only function reads opted-in preferences, uses each user's configured timezone, writes generic journal/grounding notices, and uses a unique index to prevent duplicate notices on retries and DST fall-back. Invalid timezone values are rejected by the Settings API. The worker and SQL function passed local tests; the linked project was not changed, so the frontend delivery wording remains disabled by default.
- **R1/R3:** Settings now keeps the user's saved timezone even when it is outside the quick-pick list; reminder time controls are disabled until a reminder is selected, and the in-app master flag stays enabled when any chosen in-app update requires it. Push and email remain labeled unavailable. The notification inbox ignores stale filter responses, removes read items from the unread view, refreshes when visible, and routes a grounding notice to `/tools/grounding`.
- **R3/R5:** Mobile menu buttons wait for hydration before accepting taps. This resolved intermittent dropped first taps during parallel development compilation. The full public browser suite passed on simulated mobile Chrome, mobile Safari, 320 px Chrome, and a 768 px touch viewport: **68 passed, 4 intentionally skipped**. This is emulator coverage, not physical-device acceptance.
- **Checks:** Frontend **115 files/526 tests** and backend **62 files/338 tests** passed after these edits. Both TypeScript checks and lint passed with zero errors; existing warnings remain. The Impeccable detector returned `[]` for the Settings surface. SQL migration behavior was exercised with a local PGlite database, including denial for a non-service caller and safely skipping invalid legacy timezones. The hosted migration and worker are not applied or running. The production build and real delivery timing remain unverified.
- **R8 build gate:** `npm.cmd run build --workspace frontend` stopped at `next.config.ts` before compilation because the local `.env.local` contains only a Google client ID. The production guard correctly requires public HTTPS Supabase/API values and the HTTP adapter. No substitute production values were invented; repeat the build with the real staging configuration and then measure route timing. `npm.cmd run build --workspace backend` passed after the worker shutdown change.
- **R3 inbox accuracy:** `GET /notifications` now returns an exact, owner-scoped unread count alongside the paginated items. The bell uses that count, so older unread notices do not disappear from its badge when the first 20 items are read. Mark-one and mark-all actions update the visible count; the client accepts an older response without `unreadCount` during rollout. Focused backend and frontend tests passed.
- **Checks after inbox change:** Frontend **115 files/527 tests** and backend **63 files/339 tests** passed; both workspace typechecks and lint passed with zero errors (existing warnings remain). The PGlite migration test needs a 20-second test-specific timeout under concurrent workspace checks; rerunning the backend suite alone passed in about eight seconds. No hosted configuration or data changed.
- **R5 Grounding return:** A running exercise recalculates from its wall-clock deadline as soon as its browser tab becomes visible, so a completed session does not wait on a background-throttled timer. A focused test jumps past the deadline without firing an interval, resumes visibility, and confirms one save.
- **Checks after Grounding change:** Frontend **115 files/528 tests** passed; frontend typecheck, backend build, and `git diff --check` passed. Lint remains at zero errors. The SQL reminder worker and new inbox count still need hosted activation or live account checks before acceptance.

### Progress record — 2026-10-18

- **R5 Grounding save recovery:** Each completed practice now sends a stable UUID. The backend accepts older clients without it, treats an owned duplicate with matching exercise details as the original completion, and rejects another user's or mismatched duplicate. The session view offers **Retry saving** after an uncertain response and reuses the same request identity. Controller, service, HTTP adapter, view model, and UI tests passed locally; live network retry behavior remains unverified.
- **Checks:** Backend **63 files/342 tests** and frontend **116 files/531 tests** passed after the Grounding change, including a mock-adapter retry check. Both typechecks, lint (zero errors, existing warnings), and backend build passed. The frontend production build still needs the real staging public Supabase/API configuration.
- **R1 quiet hours:** The pending reminder migration now stores an optional start/end pair, rejects conflicting reminder times in the database, and suppresses reminders within the user's local quiet window, including windows crossing midnight. Settings exposes the controls only after the schema is available, validates the pair and target time, and keeps old `/settings` reads working before migration. Account and support notices remain unaffected. This is locally implemented; the linked database and delivery worker were not changed.
- **Checks after quiet hours:** Backend **63 files/345 tests** and frontend **116 files/532 tests** passed. Both workspace typechecks, lint (zero errors with existing warnings), backend build, and `git diff --check` passed. The PGlite migration test covers the overnight boundary and database constraint. Hosted timing, a physical phone, and the frontend production build remain pending.
- **R1 linked-project check, 2026-10-18:** Applied the reminder migration and a follow-up quiet-hours column grant (`20261017120000`, `20261018120000`). The follow-up fixed a live 503: authenticated Settings updates lacked `UPDATE` privilege on the two new columns. A disposable account completed onboarding and current policy review, saved notification preferences through the API, received two notices in its inbox, saw zero duplicates, zero during quiet hours, and two on resumption. The account and notices were removed. The local worker (PID 18704) showed a healthy heartbeat. Three earlier account-erasure/retention migrations remain pending. No hosted worker was deployed, so the frontend reminder flag remains off. Push, email and lock-screen masking remain unavailable pending delivery infrastructure and verified provider configuration.
- **R1 channel delivery, 2026-10-18:** Applied `20261018130000_notification_channel_delivery.sql` and `20261018131000_push_endpoint_single_owner.sql` to the linked project. The latter prevents a shared browser subscription from remaining attached to two users. Implemented the email/push worker, retry and opt-out handling, generic email/device payloads, encrypted subscription storage, per-device browser permission, and local subscription removal on session clear. A disposable account passed authenticated Settings and push registration, channel queue and fake-provider dispatch, masked push payload, and account-deletion cleanup. No actual email or device push was sent; verified sender credentials, VAPID keys, durable hosted worker, and physical-device checks are still required before turning on frontend availability flags.
- **R1 verification, 2026-10-18:** Added an installable ECHO manifest and mobile app icons for Home Screen push support. Rebuilt the backend and frontend, passed backend 67 files/355 tests and frontend 117 files/534 tests, passed both typechecks and lint with warnings only, then repeated the linked disposable-account QA through the authenticated push API. The disposable account, notices, encrypted subscription, and delivery records were removed. The local worker was restarted and showed a successful heartbeat. Its process is local to this development machine; hosted uptime and actual email/device delivery are unverified.
- **R1 email provider decision:** Supabase Custom SMTP with a verified domain was selected. The existing SMTP adapter and backend environment validation support it. The worker still has `EMAIL_PROVIDER=disabled` because its SMTP connection details have not been placed in the backend environment; real inbox delivery remains unverified and the frontend email availability flag stays off.

### Final local verification for this slice — 2026-10-17

- Before the final onboarding correction, frontend: **113 test files, 517 tests passed** when run alone. An earlier concurrent run timed out on three unrelated tests; those three passed in isolation and the entire frontend suite then passed. Backend: **59 test files, 330 tests passed**. After the onboarding correction, its new UI and HTTP-adapter tests (2/2) and backend tests (3/3) passed.
- Frontend and backend TypeScript checks passed. Both workspace lint commands finished with warnings and **zero errors**. The Impeccable detector returned `[]` on the changed UI targets.
- The disposable-account browser smoke passed at 320 px Chromium and iPhone WebKit after the final Journal change. It opened Dashboard, Calendar, Insights, Grounding, Find Help and Professional Support, all seven Settings sections, and the Journal draft/photo flow without horizontal route overflow; it also verified browser Back cancellation and acceptance. The temporary user and test data were removed.
- Not covered locally: physical phones, 200% zoom and complete assistive-technology review, hosted Auth/CAPTCHA and email/Google delivery, real push/email/reminder services, approved Buddy access, and a reviewed practitioner two-account flow. Production-build performance was not measured while the active development servers occupy ports 3000/4200.
