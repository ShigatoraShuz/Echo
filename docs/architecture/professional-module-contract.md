# Echo Professional Module — Implementation Contract

**Scrum:** Sprint 0 / BE-003 — Define professional module contracts (P0)

**Verified:** 12 October 2026, current working tree on `feat/professional-portal-sprint-0`, including existing uncommitted service changes.

**Status:** Repository-aligned documentation, ready for project-owner review; not release approval or completion of Sprint 1–5. Source/test inspection does not establish the state of a deployed database.

## 1. Ownership and security boundaries

Professional Support is part of Echo's modular monolith and owns `professional_service`: organizations, memberships, requests, consent/sharing metadata, journal snapshots, appointments, notes, referrals, and professional audit events.

**BE-005 supplement:** [Professional credential verification](professional-credential-verification.md) defines the implemented encrypted-reference/review workflow, additional endpoints and proposed local migration. It adds credential reviews and requires evidence-backed clinical membership approval. The migration has not been deployed and requires owner-approved rollout, including re-review of legacy active clinical memberships.

**Backend continuation supplement (14 October 2026):** [Professional request workflow additions](professional-request-workflows.md) defines additive owner update/withdrawal contracts and their local migration. These supplement the original endpoint/lifecycle inventory below; owner withdrawal is now locally implemented for submitted, unassigned requests. [Backend handoff](../progress/professional-backend-handoff.md) records current validation and remaining tasks. No deployment is implied.

| Boundary | Current owner and responsibility |
| --- | --- |
| HTTP | [professional.routes.ts](../../backend/src/features/professionals/professional.routes.ts): UUID/body validation, authenticated actor, route assurance gates, rate limits, and administrator checks. |
| Business access and projection | [professional.service.ts](../../backend/src/features/professionals/professional.service.ts): membership/organization, practitioner credentials, assignment, consent filtering, encryption, response mapping, and read auditing. |
| Persistence | [professional migration](../../supabase/migrations/20261010090000_professional_support_portal.sql): constraints, RLS/grants, transactional RPCs, assignment/author triggers, and mutation auditing. |
| Identity and application access | [token verifier](../../backend/src/infrastructure/supabase/supabase-admin.client.ts), [auth middleware](../../backend/src/shared/middleware/auth.middleware.ts), and [access guard](../../backend/src/features/access/access.routes.ts) / [AccessService](../../backend/src/features/access/access.service.ts). |
| Administrator authority | [VerificationService.isAdmin/assertAdmin](../../backend/src/features/verification/verification.service.ts): active entry in `verification_service.verification_admins`; professional `org_admin` membership is insufficient. |
| Journals and encryption | [JournalService.get](../../backend/src/features/journals/journals.service.ts) checks owner and excludes deleted originals. Professional Support stores separately encrypted title/body snapshots using [EncryptionService](../../backend/src/infrastructure/encryption/encryption.service.ts); it shares neither original-journal access, images, nor analysis results. |
| Frontend | [professional-api.ts](../../frontend/src/services/professionals/professional-api.ts) consumes HTTP contracts; presentation/mock membership state confers no authorization. |

[server.ts](../../backend/src/server.ts) constructs `ProfessionalService` with the backend service-role client, encryption, and journal service. [v1.routes.ts](../../backend/src/routes/v1.routes.ts) mounts the router; [app.ts](../../backend/src/app.ts) supplies `/api/v1`.

The effective actor is the verified bearer-token user (`request.auth.id`), never a client-selected actor ID. Admin provisioning can identify a **target** staff user, not replace the actor. Service-role credentials remain backend-only. RPC `p_actor`/`p_user_id` values are trusted backend arguments; RPCs do not independently authenticate an end-user JWT or establish administrator authority.

## 2. Authentication, roles, and eligibility

All endpoints require a verified bearer token. In the configured server, the preceding global access guard also requires verified email, active profile, verified adult eligibility, acceptance of all three active policy versions, and completed onboarding. Professional routes are not guard exemptions. The focused route tests omit this global access service and therefore do not prove the full configured pipeline.

The verifier validates the exact token through Supabase Auth and checks `user_service.security_session_active` before using `aal` and supported `amr` timestamps. [requireMfa](../../backend/src/shared/middleware/assurance.middleware.ts) requires `aal2`. `requireRecentAuthentication` requires a supported authentication timestamp within 600 seconds (at most 30 seconds future clock tolerance), not merely a refreshed token issuance time.

| Actor | Professional module permissions |
| --- | --- |
| `counselor`, `psychologist`, `social_worker` | Active membership in active organization; reviewed credential label/expiry at approval. Current credentials required for queue/clinical operations. Claiming requires same-organization membership; confidential case access/writes additionally require exact assignment. |
| `coordinator`, `org_admin` | Active same-organization queue access; no clinical claim, confidential case read/write, close, or practitioner cancellation permission merely from these roles. |
| Request owner | Create/read own requests, revoke own sharing, respond to own offers, cancel own proposed/confirmed appointments. No route MFA gate. |
| Application administrator | Active verification-admin entry, MFA, and recent authentication for provisioning/audit endpoints; no implicit patient case-read permission. |

Organization and membership statuses are each `pending`, `active`, `suspended`. SQL requires `verified_at` for active organizations and `approved_at` for active memberships; clinical active memberships also require non-null credential label/expiry. Staff approval checks active/adult/onboarded profile and clinical credentials. An expiry equal to today is valid; service comparisons use the UTC date, SQL uses `current_date`. Organization suspension suspends active memberships; organization reapproval does not automatically reactivate them.

`GET /professional/me` returns all memberships, an organization object or `null`, and `accessState`. Precedence: organization suspended → organization pending/missing → membership suspended → membership pending → clinical credential missing/expired → active. Values: `suspended_organization`, `pending_organization`, `suspended_membership`, `pending_membership`, `credential_expired`, `active`. `mfaRequired` describes session assurance, not approval.

**Role-sensitive cancellation assurance (BE-004):** `/professional/appointments/:appointmentId/cancel` resolves ownership from stored appointment/request metadata. Owners retain cancellation without MFA. Nonowners must be the assigned, active, credential-current clinical member and have verified `aal2`; missing/`aal1` assurance returns `MFA_REQUIRED` before mutation. The route supplies assurance from `request.auth`, never the body, query, or custom headers. The existing RPC still rechecks ownership, membership, organization and appointment state transactionally.

## 3. HTTP API contracts

Paths are relative to `/api/v1`. [Routes](../../backend/src/features/professionals/professional.routes.ts) define 28 endpoints: the 23 below plus five credential endpoints in the [BE-005 supplement](professional-credential-verification.md). Malformed UUID path parameters return 400. Defined bodies are strict Zod objects; unknown properties are rejected. Actions with no defined body do not parse/validate an action body. No queue pagination/filter query contract exists.

Limits: 45 professional-router calls per authenticated actor per 60 seconds, plus 8 request-creation calls per actor per 60 seconds. The app applies 120 calls per 60 seconds before authentication, normally keyed by IP. See [security-policy.ts](../../backend/src/shared/middleware/security-policy.ts) and [app.ts](../../backend/src/app.ts); app responses have `Cache-Control: no-store`.

### Authenticated discovery and owner operations

These require baseline authentication/application access. Owner operations do not require MFA; practitioner cancellation has the service-level assurance gate described above.

| Method and endpoint | Authorization and validated input | `data` payload (HTTP 200 unless marked) |
| --- | --- | --- |
| `GET /professional/organizations` | Authenticated discovery. | `{ organizations: Organization[] }`, active only, name ascending. |
| `GET /professional/me` | Effective actor's memberships. | `{ userId, memberships: Membership[], mfaRequired }`. |
| `GET /professional/my-requests` | Effective owner. | `{ requests: RequestSummary[] }`, newest 50. |
| `POST /professional/my-requests` | Active organization, eligible owner; strict `{ organizationId: UUID, summary: trimmed 20..4000, preferredTime?: trimmed <=240 = "", journalIds?: UUID[] <=3 = [], consent: true }`. | **201** `{ request: RequestSummary }`. |
| `GET /professional/my-requests/:requestId` | Exact owner; unrelated owner gets 404. | `CaseDetail`, `viewer: "user"`, `notes: []`. |
| `POST /professional/my-requests/:requestId/revoke` | Exact owner; no body. | `{ request: RequestSummary }`. |
| `POST /professional/appointments/:appointmentId/respond` | Owner; strict `{ accept: boolean }`; SQL rechecks case/practitioner availability. | `{ appointmentId, status }`. |
| `POST /professional/appointments/:appointmentId/cancel` | Owner **or** eligible assigned clinical practitioner with verified `aal2`; no body. | `{ appointmentId, status: "canceled" }`. |

Creation rejects duplicate journal IDs with `DUPLICATE_JOURNAL`; selected journals must belong to the owner. SQL rechecks active organization and active/adult/onboarded owner profile. The route requires `consent: true`; server consent version is `professional-request-v1`.

### Professional workspace operations

Every endpoint in this table additionally requires `aal2`.

| Method and endpoint | Authorization and validated input | `data` payload |
| --- | --- | --- |
| `GET /professional/organizations/:organizationId/queue` | Active same-organization member; clinical credentials current. | `{ requests: QueueItem[] }`, newest 100, all states, metadata only. |
| `GET /professional/cases/:requestId` | Exact assigned, active, credential-current clinical practitioner. | `CaseDetail`, `viewer: "professional"`, sharing filtered as in section 5. |
| `POST /professional/cases/:requestId/claim` | Eligible clinical member; submitted/unassigned request; no body. | `{ request: RequestSummary }`. |
| `POST /professional/cases/:requestId/appointments` | Assigned practitioner; strict `{ startsAt: ISO offset datetime, endsAt: ISO offset datetime, mode: "in_person" \| "online" \| "phone", locationHint?: trimmed <=240 = "" }`; SQL timing/state rules in section 4. | **201** `{ appointmentId }`. |
| `POST /professional/cases/:requestId/notes` | Assigned practitioner; assigned/scheduled case; strict `{ body: trimmed 2..4000 }`. | **201** `{ noteId }`. |
| `POST /professional/cases/:requestId/referrals` | Assigned practitioner; assigned/scheduled case; strict `{ resourceName: trimmed 2..160, resourceUrl: HTTPS URL or null }`; both keys required. | **201** `{ referralId }`. |
| `POST /professional/cases/:requestId/close` | Assigned practitioner; assigned/scheduled case; no proposed/confirmed appointment; no reason/body contract. | `{ request: RequestSummary }`. |

### Privileged provisioning and audit

Every endpoint requires baseline access, `aal2`, recent authentication, and `VerificationService.assertAdmin`. Endpoint existence does not establish completed credential-review tooling or new Admin UI scope.

| Method and endpoint | Input/operation | `data` payload |
| --- | --- | --- |
| `GET /professional/admin/organizations` | All statuses, newest first. | `{ organizations: Organization[] }`. |
| `GET /professional/admin/organizations/:organizationId/memberships` | Same-organization list, newest first. | `{ memberships: AdminMembership[] }`. |
| `GET /professional/admin/organizations/:organizationId/audit` | Same-organization newest 100 events. | `{ events: AuditEvent[] }`. |
| `POST /professional/admin/organizations` | Strict `{ slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ <=80, name: trimmed 3..120, description?: trimmed <=600 = "", serviceHours?: trimmed <=240 = "" }`; creates pending organization. | **201** `{ organization: Organization }`. |
| `POST /professional/admin/organizations/:organizationId/approve` | Pending/suspended → active; verifier/time recorded; no body. | `{ organization: Organization }`. |
| `POST /professional/admin/organizations/:organizationId/suspend` | Active → suspended; suspends active staff; no body. | `{ organization: Organization }`. |
| `POST /professional/admin/memberships` | Strict `{ organizationId: UUID, userId: UUID, role: one of five membership roles, displayName: trimmed 2..120, credentialLabel: trimmed 2..160 or null, credentialExpiresAt: ISO date or null, credentialChecked: true, credentialId?: UUID }`. `credentialId` is required for clinical roles and must identify an approved, unexpired review matching organization, subject, role, label and expiry. Self-provisioning is denied. Other keys remain required. | **201** `{ membershipId }`. |
| `POST /professional/admin/memberships/:membershipId/suspend` | Active → suspended; no body. | `{ membershipId, status: "suspended" }`. |

`credentialChecked: true` remains a route assertion and is no longer sufficient for clinical approval. BE-005 stores evidence/review history separately and links membership through `approved_credential_id`; membership still stores label, expiry, `approved_at`, and `approved_by`. Credential review approval does not itself activate membership.

### Response types and errors

[Success helper](../../backend/src/shared/utils/response.ts): `{ success: true, data, meta: { requestId } }`. [Error middleware](../../backend/src/shared/middleware/error.middleware.ts): `{ success: false, error: { code, message, details? }, meta: { requestId } }`; details are redacted and omitted for 5xx.

| Type | Returned fields |
| --- | --- |
| `Organization` | `id, slug, name, description, serviceHours, status`. |
| `Membership` | `id, organizationId, organization: Organization or null, role, status, displayName, credentialLabel: string or null, credentialExpiresAt: date or null, accessState`. |
| `AdminMembership` | `id, userId, role, status, displayName, credentialLabel: string or null, credentialExpiresAt: date or null`. |
| `QueueItem` | `id, organizationId, status, assignedTo: UUID or null, createdAt, updatedAt`; no owner ID, message, preferred time, journals, or sharing metadata. |
| `RequestSummary` | Queue fields plus `preferredTime: "", sharingActive: boolean, sharedJournalCount: number`; no summary/owner ID. Sharing count remains snapshot count after expiry/revocation. |
| `CaseDetail` | `{ request, sharedJournals, appointments, referrals, notes, viewer }`. Request extends summary with `summary: string or null` and conditional preferred time. Journals: `{ journalId, title, body }`. Appointments: `{ id, startsAt, endsAt, mode, locationHint, status }`. Referrals: `{ id, resourceName, resourceUrl: string or null, createdAt }`. Notes: `{ id, body, createdAt }`. |
| `AuditEvent` | `id, action, actorUserId, subjectUserId: UUID or null, createdAt`; this admin projection omits request ID although the database stores it. |

Appointments/referrals/notes are newest first; snapshot order is unspecified. Professional detail returns notes for the entire assigned request, not an author-only subset. Owner detail never queries notes. Child author/practitioner IDs are omitted.

[App errors](../../backend/src/shared/errors/app-error.ts): validation 400; authentication 401; membership/assignment/admin denial 403 (`RESOURCE_FORBIDDEN`); assurance 403 (`MFA_REQUIRED` / `REAUTHENTICATION_REQUIRED`); not found 404; rate limiting 429; database failure 503 (`DATABASE_UNAVAILABLE`); unexpected error 500. Explicit 409 mappings: `DUPLICATE_JOURNAL`, `REQUEST_ALREADY_ASSIGNED`, `APPOINTMENT_CONFLICT`, `APPOINTMENT_ACTIVE`, `APPOINTMENT_UNAVAILABLE`, `CASE_CLOSED`, `ORGANIZATION_EXISTS`, `ORGANIZATION_UNAVAILABLE` for admin state changes, `MEMBERSHIP_UNAVAILABLE`. Organization unavailable at request creation is 404 instead. Unmapped RPC failures, including invalid appointment timing, fall through to 503; SQL exception names are not automatically HTTP codes.

## 4. Case and appointment lifecycle

[SQL RPCs](../../supabase/migrations/20261010090000_professional_support_portal.sql) enforce transactional transitions. Request states are exactly `submitted`, `assigned`, `scheduled`, `closed`, `declined`.

| Transition | Current operation and enforcement |
| --- | --- |
| Create → `submitted` | Eligible owner creates consented request in active organization. |
| `submitted` → `assigned` | Clinical member claims unassigned request; request row lock and in-transaction membership check prevent duplicate claim. |
| `assigned` → `scheduled` | Owner accepts proposed appointment; SQL rechecks assignee and active/credential-current practitioner organization membership. |
| `scheduled` → `assigned` | Owner or eligible assignee cancels active appointment. Proposed-offer cancellation leaves an assigned request assigned. |
| `assigned`/`scheduled` → `closed` | Assigned qualified practitioner; blocked by any proposed/confirmed appointment. Public API exposes close only. |
| `assigned`/`scheduled` → `declined` | `set_request_status` supports this with the same checks; **no HTTP decline endpoint exists**. |

Appointment states: `proposed`, `confirmed`, `canceled`. Proposal requires assigned case, future start, positive duration ≤2 hours, valid mode, and encrypted location hint. A partial unique index permits one proposed/confirmed appointment per request. Practitioner advisory locking and `[start,end)` overlap checks reject conflicting active appointments across that practitioner's cases; adjacent slots are allowed.

Owner response maps `proposed` → `confirmed` on acceptance or → `canceled` on rejection. Rejection leaves request assigned; audit action is `appointment.declined`, not an appointment status named declined. Cancellation accepts proposed/confirmed only. Response/cancellation lock appointment and request rows. Response does not independently reject a now-past proposed start.

Closing/declining clears neither assignment nor sharing. Terminal-case reads still follow membership/assignment/consent rules; notes/referrals and new offers require permitted nonterminal states. Revocation changes sharing, not lifecycle. Request deletion/cancellation, reopening, transfers, separate active/follow-up states, and dedicated rescheduling are **not implemented** here.

## 5. Consent, isolation, and sensitive records

- **Tenant/assignment:** queue queries restrict `organization_id`. Confidential reads require active same-organization clinical membership and exact `assigned_to`, with current credentials. Owner reads/revocation require exact `user_id`. A guessed valid case ID grants no access.
- **Creation scope:** explicit `consent: true`, version `professional-request-v1`, server timestamp, message/preferred time, and 0–3 owner-selected title/body snapshots. SQL defaults expiry to creation + 30 days. No per-recipient selector, free-text purpose, configurable expiry, renewal, or PHQ-8 scope exists.
- **Professional view:** `sharingActive` means unrevoked and expiry strictly later than service clock. Inactive sharing yields `summary: null`, `preferredTime: ""`, `sharedJournals: []`; snapshots are not queried/decrypted. Case metadata, appointment hints, notes, and referrals remain available to an otherwise-authorized assignee.
- **Owner view:** owners still read their submitted content/snapshots after expiry/revocation; `sharingActive` is false and notes remain empty. Revocation deletes neither snapshots nor case records. Repeat revocation preserves the first timestamp but updates the request and inserts another audit event.
- **Read-time limit:** consent/assignment decisions occur at request load, without atomic recheck at delivery. Revocation cannot retract already delivered or in-flight authorized payloads. Do not promise instantaneous erasure or closure-triggered revocation.
- **Storage:** message, preferred time, snapshot title/body, appointment hints, and note bodies are encrypted. Referral names/URLs, organization/member metadata, IDs, statuses, and audit metadata are not field-encrypted by this module. HTTPS referral validation is at HTTP, not a database URL constraint.
- **Auditing:** SQL transactions/triggers record creation/claim/closure/decline, revocation, appointment actions, note/referral inserts, and organization/member changes. Service inserts `queue.viewed` and professional `case.opened` before returning data and fails the read on audit error. Events contain IDs/actions/timestamps, not submitted text. Owner detail and admin list reads have no dedicated professional read-audit insert.
- **Database boundary:** the original eight tables enable RLS without browser-role allow policies. BE-005 proposes a ninth RLS-protected credential table. Schema/table/function permissions are revoked from `PUBLIC`, `anon`, `authenticated`; business RPC execution is granted to `service_role`. RPCs check service-role execution and their actor/state rules. `require_assigned_author` restricts note/referral inserts. Original administrator RPCs rely on the backend admin gate; new credential review/read RPCs additionally check the SQL verification-admin registry.

## 6. Evidence, future-sprint gaps, and review decisions

### Evidence and BE-004 verification

BE-004 adds server-side practitioner-cancellation assurance without changing the schema, database permissions, authentication system, or owner workflow. The professional test files below were run locally after this change. This verifies repository behavior, not production deployment or completion of later sprints.

- [professional.routes.test.ts](../../backend/src/features/professionals/__tests__/professional.routes.test.ts): membership/MFA reporting, authenticated explicit consent, case-read MFA, recent-MFA/admin provisioning/audit gates.
- [professional.service.test.ts](../../backend/src/features/professionals/__tests__/professional.service.test.ts): wrong-assignee denial before sensitive queries, revoked sharing projection, active-sharing decryption, access-state reporting. **No dedicated expiry or audit-failure test exists in this file.**
- [professional-authorization.test.ts](../../backend/src/features/professionals/__tests__/professional-authorization.test.ts): real service/router with filter-aware database doubles; absent/pending/suspended/expired membership, inactive organization, foreign organization/user, clinical-role restrictions, assignment, all admin route gates, application-access integration, forged actor/assurance values, and owner/practitioner cancellation. Allowed clinical and queue-only roles are exercised separately.
- [professional-database-authorization.test.ts](../../backend/src/features/professionals/__tests__/professional-database-authorization.test.ts): existing migration executed in isolated in-memory PostgreSQL (PGlite), with minimal synthetic identity/profile dependencies. Exercises browser-role denial, RLS flags, review constraints, cross-organization/role/status claim denial, author triggers, mutation-time suspension checks, successful clinical workflows and audit events. No Supabase connection or migration deployment; this does not simulate deployed Auth/PostgREST or concurrent transactions.
- [security-professional-isolation.sql](../../supabase/tests/database/security-professional-isolation.sql): selected authenticated-role privilege checks, ineligible creation, nonmember claim, note author, scheduling/close guard, unrelated cancellation, revocation, suspension. This fixture does not establish deployment, full two-tenant coverage, or concurrent race testing.

### Future-sprint gaps (not complete)

Task ranges below are provisional planning references retained from the initial draft. Exact IDs/acceptance criteria require project-owner confirmation against the Scrum backlog; existing capabilities do not close those tasks.

| Proposed future Scrum group | Remaining work |
| --- | --- |
| Sprint 1 — BE-006..BE-008 | Remaining organization/MFA/session workflows and staff reapproval policy after organization reactivation. BE-004 authorization and BE-005 evidence-reference review are implemented and locally tested; BE-005 deployment remains subject to owner approval. Later task acceptance criteria remain separate. |
| Sprint 2 — BE-009..BE-013 | Server queue filters/pagination/aggregation, request cancellation/idempotency policy, agreed complete lifecycle. New state names require compatibility/migration decisions; they are not current API states. |
| Sprint 3 — BE-014..BE-019 | Timeline, granular consent scope/purpose/recipient/expiry, PHQ-8 integration, transfer/closure reasons, richer notes/audit, revocation/retention semantics. |
| Sprint 4 — BE-020..BE-025 | Rescheduling/availability, follow-up tasks, referral status history, notifications, event/outbox integration. Absent from the inspected professional API/schema. |
| Sprint 5 — BE-026..BE-030 | Professional crisis workflow, full tenant/IDOR/CSRF and concurrency tests, expiry/authorization races, logging redaction, performance, migrations/rollback, release gates. |

### Security and consistency concerns for later implementation

1. **Deployment verification:** BE-004 tests validate the checked-in SQL and backend protections locally. Confirm deployed schema/grants match the migration through the approved release process; no remote database inspection or change was performed.
2. **Credential rollout and retention:** BE-005 removes raw professional database diagnostics and protects evidence references. Its migration deliberately moves legacy active clinical memberships to pending review; release coordination and evidence retention/deletion policy require owner decisions. No remote migration has been applied.
3. **Consent/read and test limits:** expiry/revocation is read-time filtering, not deletion/delivery synchronization. BE-004 covers tenant/role denial paths, but sharing expiry, audit failure, full-system tenant coverage, and concurrent revocation/assignment races remain future consent/security work, not passed release guarantees.
4. **Error consistency:** invalid SQL appointment timing and other unmapped policy exceptions surface as 503 database failures. Future API work must define intentional client-facing mappings rather than assume all invalid workflow inputs return 400/409.

BE-003 documentation remains repository-aligned with the BE-004 and BE-005 implementation supplements and is ready for owner review. The owner must confirm backlog mappings and remaining consent/session/release decisions. This update does not mark BE-006 through BE-008 or later sprints complete; no remote Supabase operations or Scrum-status changes were performed.
