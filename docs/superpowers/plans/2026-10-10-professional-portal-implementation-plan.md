# Professional Portal Implementation Plan

> **For implementation:** Use the Superpowers `executing-plans` workflow in this session, task by task. The checkboxes track work; this document does not authorize deployment, hosted migrations, or real-user data changes.

**Goal:** Turn the existing local multi-organization professional portal into a safe, testable pilot, then add dependable daily workflows in small releases.

**Architecture:** Keep Next.js as the presentation layer, Express as the authentication/authorization boundary, and Supabase `professional_service` as the restricted data store. Extend existing services and UI components; add versioned migrations and targeted negative tests for each access change. Keep operational decisions as explicit release gates.

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind, Express 5, Zod, Supabase/PostgreSQL, Vitest, existing ECHO encryption and notification services. No new dependency is planned.

**Spec:** [`docs/superpowers/specs/2026-10-10-professional-portal-feature-design.md`](../specs/2026-10-10-professional-portal-feature-design.md)

**Local progress, 2026-10-10:** S0.0a and S0.0b code is implemented. Targeted auth/professional tests, typechecks, lint, and local build pass. Signed-out routes and a 390px professional sign-in view were checked in the browser. A real approved-account MFA and multi-organization session remains to be exercised; local Google sign-in is currently blocked by the OAuth client origin allowlist for `http://127.0.0.1:3000`. S0.1 onward remains planned work, subject to the policy and pilot gates below.

## Global constraints

- Scope is adult accounts and multiple organizations from the start. No minor/guardian path in this plan.
- User and professional journeys share one ECHO/Supabase account and existing email code, password, and Google login methods. Separate entry pages do not create separate identity stores or roles.
- Professional approval is independent of ordinary ECHO verification. MFA, active membership, active organization, valid credential, and case assignment remain enforced server-side.
- `/professional/request` and `/professional/my-requests/*` are user routes; do not put professional membership or MFA checks on their entire URL prefix.
- `professional_service` stays inaccessible to browser roles; client code uses the Express API only.
- Never include journal text, notes, request text, meeting details, or AI results in notification bodies, logs, analytics, or URLs.
- Use ECHO forest/sage/cream tokens, Cormorant/Manrope typography, existing `EchoButton`/`EchoSkeleton`/`PageHeader`; every screen has mobile, loading, empty, error, and accessible status states.
- Do not claim emergency monitoring, diagnosis, or production AI. `Buddy`, facial data, and AI analysis are outside professional sharing.
- Preserve the existing dirty worktree. Add only files owned by each task; inspect `git diff` before each commit. Do not apply hosted migrations or deploy without a separate explicit request.

## Dependency and execution order

```text
Policy decisions + baseline review
  -> S0 user/professional auth journeys and access gateway
  -> S0 pilot readiness (retention, verified staff, response expectations, safety copy)
  -> local 5-account flow and rollout checklist
  -> S1 queue/assignment/caseload
  -> S1 notifications/calendar/timeline/closure
  -> S2 partner administration/referral/reporting
  -> S3 messaging, transfers, AI as three separately reviewed projects
```

Each task is reviewable on its own. Do not start S1 until the S0 release gates are satisfied for a pilot. S2 and S3 can be reprioritized from pilot feedback; their API contracts must be finalized at the start of their task.

## File ownership map

| Unit                       | Existing entry points to reuse                                                                                                                                               | Planned additions when its task starts                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Database and authorization | `supabase/migrations/20261010090000_professional_support_portal.sql`, `supabase/tests/database/security-professional-isolation.sql`                                          | New versioned migrations and focused SQL negative tests; do not edit the applied migration                                |
| Professional API           | `backend/src/features/professionals/professional.service.ts`, `.routes.ts`, `__tests__/*`                                                                                    | Small task-specific service/helper files if the existing service becomes difficult to read; route tests and service tests |
| Existing notifications     | `backend/src/features/notifications/notifications.service.ts`, `.routes.ts`                                                                                                  | Professional event insertion at committed transitions; no second notification system                                      |
| Existing encryption        | `backend/src/infrastructure/encryption/encryption.service.ts`                                                                                                                | Reuse; do not create another cipher or persist plaintext                                                                  |
| Client API                 | `frontend/src/services/professionals/professional-api.ts`                                                                                                                    | Typed methods/types matching validated Express responses                                                                  |
| Shared authentication      | `frontend/src/features/authentication/view/login-view.tsx`, `components/secure-google-login-button.tsx`, `frontend/src/proxy.ts`, `frontend/src/shared/lib/safe-redirect.ts` | Reuse sign-in methods; professional entry and access-state tests; no new password system                                  |
| Professional access UI     | `frontend/src/features/professionals/components/professional-shell.tsx`, `frontend/src/app/(protected)/professional/*`                                                       | `/professional/login` entry, `/professional/access` status/MFA page, shared workspace gate and skeleton                   |
| Professional UI            | `frontend/src/features/professionals/components/professional-shell.tsx`, `view/*`, `frontend/src/app/(protected)/professional/*`                                             | Route-specific views and tests; retain ECHO design tokens and shared skeletons                                            |
| Trust UI                   | `frontend/src/app/(protected)/admin/professionals/page.tsx`                                                                                                                  | Split review history and staff form into local components only if the page grows materially                               |
| Runbooks                   | `docs/professional-portal.md`                                                                                                                                                | Pilot checklist, retention schedule reference, incident and credential review procedure                                   |

## Scrum execution table

| Sprint/task                        | Feature IDs      | Deliverable and exact change area                                                                                                                                              | Verification and acceptance                                                                                | Gate                                      |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| S0.0a User auth journey            | F18              | Audit signup/login/Google/email-code redirects, onboarding gates, and user professional-request paths; fix only failed paths                                                   | Safe next URL; ordinary user reaches own request without professional role/MFA                             | Local auth tests                          |
| S0.0b Professional auth journey    | F19              | Reused login form at `/professional/login`, backend access state, `/professional/access` MFA/status gateway, workspace-only gate and sign-out                                  | Pending/expired/suspended/AAL1 states show no case; active multi-org switch works                          | S0.0a                                     |
| S0.1 Record policy and pilot rules | F01, F04, F05    | Document approved record classes, retention durations, legal holds, incident owner, partner hours, credential evidence source in `docs/professional-portal.md` and policy docs | Product/partner sign-off; no destructive cleanup command until schedule exists                             | Required before S0.4                      |
| S0.2 Response expectations         | F02              | New organization timezone/response target/intake state migration; Express validation; request form and organization card                                                       | Closed intake rejects server-side; hours/timezone and emergency link visible at 320px                      | Local test                                |
| S0.3 Credential review evidence    | F03              | Review metadata migration; ECHO admin review action and history; expiry block and admin warnings                                                                               | Unreviewed/expired/suspended clinician cannot open case; two-org negative tests                            | Local test                                |
| S0.4 Content retention             | F04              | Idempotent SQL cleanup RPC, local-only dry-run script, scheduled operation runbook, removed-content UI                                                                         | Dry-run changes nothing; apply removes only due content; rerun stable; audit and permitted metadata remain | Approved schedule                         |
| S0.5 Safety and UX pass            | F05              | User/professional urgency copy, case error/empty/retry, screen-reader status, responsive review                                                                                | No implied emergency monitoring; keyboard and zoom review; 403/404 shows no stale private text             | Local browser test                        |
| S0.6 Pilot integration             | F01-F05, F18-F19 | Disposable-project migration rehearsal, both sign-in journeys, hosted configuration checklist, five distinct test accounts, rollback procedure                                 | Full sign-in -> request -> claim -> appointment -> revoke and org A/B isolation; evidence recorded         | Hosted action only after explicit request |
| S1.1 Queue and assignment          | F06              | Paginated queue and atomic coordinator assignment/reassignment with reason/audit                                                                                               | Concurrent claim conflict; no coordinator private detail; no cross-org target                              | S0 pass                                   |
| S1.2 My cases                      | F07              | Assigned-case endpoint and route                                                                                                                                               | Suspended/expired staff loses list and detail immediately                                                  | S1.1                                      |
| S1.3 Notifications                 | F08              | Generic in-app request/appointment event notices using existing notification service                                                                                           | Recipient-only; no sensitive payload; duplicate retries do not spam                                        | S1.1                                      |
| S1.4 Agenda and reschedule         | F09              | Timezone-aware agenda, overlap checks, cancel/repropose flow                                                                                                                   | DST and concurrent slot tests; phone-width agenda                                                          | S1.1                                      |
| S1.5 Case history and closure      | F10, F11         | Append-only timeline, note addendum, decline/close reason and user status                                                                                                      | No silent note overwrite; terminal cases reject further actions                                            | S1.1                                      |
| S2.1 Tenant operations             | F12              | Organization-admin profile/intake/roster actions with ECHO final credential approval                                                                                           | Org admin cannot approve self or read case text                                                            | S1 pass                                   |
| S2.2 Referral follow-up            | F13              | Referral status and user acknowledgement                                                                                                                                       | URL validation; no claim of completed handoff until acknowledged                                           | S1 pass                                   |
| S2.3 Aggregate reporting           | F14              | Tenant-scoped counts, response age, appointment outcome                                                                                                                        | No free text/raw rows; org A cannot infer org B                                                            | S1 pass                                   |
| S3 separate designs                | F15, F16, F17    | Write a separate spec and plan for messaging, transfer, and AI individually                                                                                                    | Independent consent, staffing, safety, and model-readiness gates                                           | New product decision                      |

## Executable task cards for the pilot slice

### Task S0.0a: Verify the ordinary-user authentication path

**Files:** `frontend/src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `callback/route.ts`, `frontend/src/features/authentication/view/login-view.tsx`, `components/secure-google-login-button.tsx`, `frontend/src/proxy.ts`, their existing tests, and `frontend/src/shared/lib/safe-redirect.ts`. Read `frontend/AGENTS.md` and the installed Next.js 16 guide before changing route code.

**Flow:** Public sign-up or existing-account sign-in -> verified email -> active adult account -> current policies -> completed onboarding -> safe originally requested user page or `/dashboard`. `/professional/request` and `/professional/my-requests/*` require that account gate, not a professional membership or MFA.

- [ ] Add/focus tests for password, email-code, and Google return destinations; `safeRedirectPath` must reject external/protocol-relative URLs and preserve valid same-origin user deep links.
- [ ] Test signed-out `/professional/request` -> `/login?next=/professional/request`; after normal account setup, the user can submit without any professional membership.
- [ ] Fix only a failing redirect or state; retain the existing Supabase account/session and sign-in controls.
- [ ] Run `npm.cmd run test -w frontend -- login-view`, `npm.cmd run test -w frontend -- proxy`, `npm.cmd run typecheck -w frontend`.

**Acceptance:** A user reaches private ECHO and a user-initiated professional request with their ordinary account. No client-selected role, public sign-up field, or URL can grant professional access.

### Task S0.0b: Add a professional entry and access gateway

**Files:** create `frontend/src/app/(auth)/professional/login/page.tsx`, `frontend/src/app/(protected)/professional/access/page.tsx`, and a focused `frontend/src/features/professionals/components/professional-workspace-gate.tsx`; modify existing login view/Google button only to accept a safe default destination; extend `frontend/src/proxy.ts`, `frontend/src/services/professionals/professional-api.ts`, `backend/src/features/professionals/professional.routes.ts`/`.service.ts`, `frontend/src/services/authentication/reviewer-mfa.ts`, professional shell, and focused auth/professional tests.

**Access contract:** Extend `GET /api/v1/professional/me` without trusting any browser role flag:

```ts
type ProfessionalAccessState =
  | "active"
  | "pending_organization"
  | "pending_membership"
  | "suspended_organization"
  | "suspended_membership"
  | "credential_expired";
type ProfessionalAccessResponse = {
  userId: string;
  mfaRequired: boolean; // derived from the authenticated token assurance level
  memberships: Array<{
    organizationId: string;
    role: "counselor" | "psychologist" | "social_worker" | "coordinator" | "org_admin";
    accessState: ProfessionalAccessState;
  }>;
};
```

The backend derives one state per membership in this order: suspended organization, pending organization, suspended membership, pending membership, expired credential, active. An account with no memberships receives `memberships: []`. MFA is a separate session state: an active member with AAL1 sees the MFA step and cannot reach queue/case APIs.

| URL                                                    | Signed-out destination                 | Authenticated gate                                                           |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| `/professional/login`                                  | Public                                 | Redirect an already approved AAL2 member through `/professional/access`      |
| `/professional/access`                                 | `/professional/login`                  | Status and MFA only; no queue or case content                                |
| `/professional`, `/professional/cases/*`               | `/professional/login` with safe `next` | Active membership and AAL2; backend checks organization and assignment again |
| `/professional/request`, `/professional/my-requests/*` | Ordinary `/login` with safe `next`     | Adult ECHO account gate; no professional membership or MFA                   |

- [ ] Write backend tests for each access state and for AAL1/expired/suspended/unassigned case denial. A signed-in nonmember gets an empty membership list, not professional data.
- [ ] Write frontend tests for signed-out workspace URL -> `/professional/login`, ordinary user -> no-access guidance, pending staff -> approval guidance, active AAL1 -> authenticator setup/challenge, active AAL2 -> requested workspace, and two active organizations -> selectable workspace.
- [ ] Reuse `LoginView` and its email-code/password/Google controls at the dedicated professional entry. Give it a safe default destination of `/professional/access`; keep `/login` defaulting to `/dashboard`. `next` is accepted only for allowlisted professional workspace paths after `safeRedirectPath` validation.
- [ ] Reuse the existing TOTP machinery by generalizing the factor label from `ECHO reviewer` to the requested workspace; preserve verified factors and do not remove another flow's enrollment. The professional access page calls it only after an active membership is confirmed.
- [ ] Gate only workspace pages before mounting case/queue views. Exclude `/professional/request`, `/professional/my-requests/*`, `/professional/login`, and `/professional/access` from the workspace-role gate. Leave Express MFA/organization/assignment checks as the authoritative boundary.
- [ ] Put a visible global sign-out action and “My ECHO” workspace switch in the professional shell. On auth failure, clear prior case state and show a safe retry or sign-in action.
- [ ] Run targeted backend professional tests, frontend auth/proxy/professional tests, both typechecks, and the frontend build; manually exercise mobile and keyboard MFA/error/loading states.

**Acceptance:** Both entries use one session. Professional access requires active reviewed membership, active organization, valid credential, and AAL2; opening a direct case URL cannot bypass the gate or reveal stale content. A professional can switch among only their approved organizations and can still use ordinary ECHO privately.

### Task S0.1: Freeze policy inputs before destructive logic

**Files:** `docs/professional-portal.md`; `docs/policies/privacy-notice.md` only after review of existing wording; feature spec's decision table.

**Output contract:** A signed table with one row each for request text, selected snapshots, appointments, practitioner notes, referrals, and audit events: retention trigger, duration, deletion/anonymization action, exception/legal-hold owner, and user-facing explanation. Record partner support hours/first-response target and the named escalation owner. The 30-day sharing _access_ limit is already code; do not equate it with every record's retention period.

- [ ] Read current privacy notice and partner operating agreement, if any; list missing decisions without guessing legal durations.
- [ ] Get product/partner review of the exact table; record reviewer and date in the runbook.
- [ ] Check that request-page copy matches the approved retention and response policy.
- [ ] Keep S0.4 blocked until this table has actual approved values.

**Acceptance:** Every record type has a concrete action and owner; no “delete everything after 30 days” shortcut that would erase required professional records.

### Task S0.2: Make organization intake and response expectations real

**Files:** new `supabase/migrations/<timestamp>_professional_intake_policy.sql`; `backend/src/features/professionals/professional.routes.ts`, `.service.ts`, tests; `frontend/src/services/professionals/professional-api.ts`; `frontend/src/features/professionals/view/support-request-view.tsx`; admin professionals page.

**API shape to implement and validate:**

```ts
type IntakePolicy = {
  timezone: string; // IANA zone, validated against supported runtime time zones
  firstResponseHours: number; // integer, 1..168, elapsed hours; show service hours separately
  acceptingRequests: boolean;
};
// POST /api/v1/professional/admin/organizations/:organizationId/intake
// body: IntakePolicy; ECHO admin + MFA + recent auth only in S0.
```

- [ ] Write route tests: invalid timezone/hours reject; unauthorized admin rejects; closed intake rejects `POST /professional/my-requests` even if the UI is bypassed.
- [ ] Run `npm.cmd run test -w backend -- professional.routes.test.ts` and confirm the new tests fail for the missing behavior.
- [ ] Add migration columns and an atomic intake check in the request RPC; map and validate the fields in Express; render the response expectation in the organization choice and admin form.
- [ ] Run targeted backend tests, `npm.cmd run typecheck -w backend`, `npm.cmd run typecheck -w frontend`, and `npm.cmd run test:sql:isolated`.
- [ ] Review closed-intake, after-hours, and missing-hours states at 320px and keyboard only.

**Acceptance:** The submitted request is refused when intake is off; the user sees a truthful time window and urgent help. Timezone is explicit rather than inferred from the browser.

### Task S0.3: Record actual credential review evidence

**Files:** new `supabase/migrations/<timestamp>_professional_credential_reviews.sql`; existing professional service/routes/tests; `frontend/src/app/(protected)/admin/professionals/page.tsx`; client API; SQL isolation test.

**Data contract:** Append-only `credential_reviews(id, membership_id, reviewer_user_id, source_type, source_reference, role_scope, reviewed_at, expires_at, decision)`. `source_reference` is a non-secret verification reference, not a scan URL or credential number. The reviewer must be an ECHO verification admin. Role approval uses the latest approved, unexpired review; org admins may request staff changes but cannot approve themselves.

- [ ] Add failing service/route and SQL tests: no review, expired review, wrong scope, suspended org/staff, and org B reviewer attempts all deny access.
- [ ] Add migration constraints/indexes and server-only insertion; create or retain a pending membership, save its review, then activate it only after approval. Leave existing memberships readable during migration, but require a review before newly granting or renewing clinical access.
- [ ] Change admin form from bare `credentialChecked: true` to source/reference/role/expiry plus explicit reviewed action; show review history and expiry warning.
- [ ] Run backend professional tests, isolated SQL tests, both typechecks, and a manual admin/professional screen review.

**Acceptance:** A typed label alone cannot newly grant clinical case access. Existing approved memberships need a controlled re-review path before pilot invitation.

### Task S0.4: Add idempotent retention cleanup

**Files:** new `supabase/migrations/<timestamp>_professional_retention.sql`; `backend/scripts/professional-retention.mts`; `backend/package.json`; professional service and request-detail views; SQL isolation test; runbook.

**Cleanup contract:**

```text
run_professional_retention(p_dry_run boolean, p_as_of timestamptz)
  -> counts for expired/revoked shared snapshots, redacted request messages,
     policy-due appointments/notes/referrals, and skipped legal holds
```

- [ ] Write SQL test rows for active sharing, expired sharing, revoked sharing, multiple organizations, legal hold, and repeat execution. Assert dry-run leaves rows unchanged.
- [ ] Add a privileged, idempotent transaction that first removes due shared snapshots, clears their stored journal IDs, and redacts due request text; migrate encrypted message columns to nullable for a true removed state. Use the approved schedule from S0.1 for all other record classes. Keep permitted audit metadata without private content. Define a server-only legal-hold table keyed to the affected record so a hold is explicit and auditable.
- [ ] Update Express mapping and user/professional UI so null/redacted fields show “Content removed under the retention policy” rather than a decryption failure.
- [ ] Add a local-only dry-run script following `backend/scripts/analysis-retention.mts`; require a distinct `--apply` flag and record counts only.
- [ ] Run `npm.cmd run test:sql:isolated`, targeted professional tests, both typechecks; compare before/after counts in a disposable local database.

**Acceptance:** Access expiry and storage cleanup are both verified. The job never logs text or silently deletes notes whose schedule is undecided.

### Task S0.5: Complete the user and professional safety states

**Files:** `frontend/src/features/professionals/view/support-request-view.tsx`, `my-requests-view.tsx`, `professional-dashboard.tsx`, `professional-case-view.tsx`, `components/professional-shell.tsx`; focused frontend tests; `docs/professional-portal.md`.

- [ ] Write UI tests for “not emergency response,” visible `/crisis` action, revoked content, 403/404 private-data clearing, loading announcement, empty queue, and retry after network failure.
- [ ] Use `EchoSkeleton` with `role="status"`/`aria-busy` for loading; focus the result heading or announce action success without shifting keyboard focus unpredictably.
- [ ] Review 320px, 390px, 768px, and desktop layouts and 200% zoom; confirm all controls can be reached by keyboard and mobile navigation does not hide the active section.
- [ ] Run targeted frontend tests, `npm.cmd run typecheck -w frontend`, `npm.cmd run build -w frontend`.

**Acceptance:** No page flashes old case text after an authorization failure; every async section has a meaningful loading, empty, success, and error state.

### Task S0.6: Pilot rehearsal and release gate

**Files:** `docs/professional-portal.md`; no production code unless the rehearsal reveals a defect.

- [ ] On a disposable Supabase project, apply versioned migrations using the normal project migration workflow, expose `professional_service` to the service role, and confirm browser roles still lack table/RPC access.
- [ ] Use five distinct test accounts: ECHO user, org A practitioner, org B practitioner, coordinator, ECHO admin. Start from user sign-in and professional sign-in (including MFA), then exercise request, three selected journals, claim, note, appointment, cancellation, revocation, expiry, suspension, and credential expiry.
- [ ] Verify that an ordinary user can open `/professional/request` but not a case, a pending practitioner sees the access-status page, and a professional can switch back to private ECHO without exposing journal data to the organization.
- [ ] Record expected and actual HTTP status for org B, unassigned staff, coordinator, suspended staff, and unauthenticated access; confirm no private body in response or logs.
- [ ] Check the five release decisions in the feature spec and record owner/date/evidence. Keep real-user invitation blocked while any item is open.

**Acceptance:** The complete local/disposable-project journey is demonstrated. Hosted rollout remains a separate explicitly authorized action.

## Contracts to use for the next slices

These are implementation boundaries for S1/S2. Each task begins with a failing test, implements the server rule, updates the typed client and UI, then runs focused tests and a responsive review.

| Task | Server contract and invariant                                                                                                                                                                   | Client/UI contract                                                               | Minimum tests                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| S1.1 | `GET /professional/organizations/:id/queue?status=&cursor=&limit=` returns metadata and opaque next cursor; `POST /professional/cases/:id/assign` accepts `{assigneeUserId, reason}` atomically | Requests route: filter, age, assign/reassign dialog, clear success/error states  | Same-org active clinician succeeds; two concurrent assignments yield one winner; org B and coordinator detail deny |
| S1.2 | `GET /professional/organizations/:id/my-cases?cursor=&limit=` queries assigned rows only                                                                                                        | My cases route with next action and skeleton cards                               | Suspended/expired/unassigned caller receives no case content                                                       |
| S1.3 | Insert generic `professional_request`/`professional_appointment` notification after state transition, deduplicated by event ID                                                                  | Existing notification center links to owned request/case without private preview | Correct recipient only; retries do not duplicate; payload contains no free text                                    |
| S1.4 | `GET /professional/appointments?from=&to=&organizationId=` and atomic availability/overlap check for propose/reschedule                                                                         | Agenda route with explicit timezone and reschedule controls                      | Overlap, race, timezone/DST, cancel-repropose, 320px layout                                                        |
| S1.5 | Append-only `case_events` and `case_note_addenda`; validated close/decline transition with reason category                                                                                      | Case timeline; addendum form; user-visible status and next-step link             | Original note immutable; terminal state refuses mutation; audit and notification created once                      |
| S2.1 | Tenant-scoped org admin hours/intake/roster endpoints; central ECHO review stays required for clinical approval                                                                                 | Partner settings with staff request and review state                             | Org A admin cannot edit org B, self-approve, or read case details                                                  |
| S2.2 | Referral state transition from suggested -> shared -> acknowledged/closed                                                                                                                       | Referral card and user acknowledgement                                           | Ownership, URL validation, no false completion state                                                               |
| S2.3 | Aggregate-only organization report endpoints with fixed dimensions and cohort threshold                                                                                                         | Simple workload cards, no patient table export                                   | No text fields and no cross-org inference                                                                          |

## Verification commands and evidence

Run targeted tests after each task; run the broader gate at the end of each slice:

```powershell
npm.cmd run check:contracts
npm.cmd run typecheck
npm.cmd run test -w frontend -- login-view
npm.cmd run test -w frontend -- proxy
npm.cmd run test -w backend -- professional
npm.cmd run test -w frontend -- professional
npm.cmd run test:sql:isolated
npm.cmd run build
git diff --check
```

The exact frontend test filter can be narrowed to newly added filenames if Vitest does not match `professional`. For SQL, use a disposable local database; `test:sql:isolated` is the repository's existing harness. Browser evidence should include desktop and mobile screenshots, keyboard path, slow-network skeleton, empty queue, denied access, and success state. These checks do not substitute for a real multi-account hosted test.

## Completion and handoff

1. Review only task-owned diffs. Keep the pre-existing dirty checkout baseline separate.
2. Record each task's test command/result and unresolved operational gate in `docs/professional-portal.md`.
3. When S0 is complete, report precisely which setup was local, disposable-hosted, or production. Do not mark the portal “launched” from builds or isolated SQL tests alone.
4. Start S3 features only after separate consent, staffing, safety, and model-readiness designs are approved.
