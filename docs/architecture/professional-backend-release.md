# Professional backend release preparation

Prepared 17 October 2026 for BE-030. **Local proposals and test evidence only; not deployment approval.** See [task status and evidence](../progress/professional-backend-handoff.md) and [API/workflow contracts](professional-request-workflows.md). Existing frontend design, shared User Side and authentication providers are preserved.

## Deployment boundary

**19 October owner-approved execution update:** approval received for exactly the 18 reviewed SQL migrations. [Execution preparation](../releases/professional-cloud-deployment.md) confirms unchanged 72+18 history and recovery evidence, but execution is **BLOCKED before CLI dry run**: the saved database login expired and no existing PostgreSQL password is available. No migrations or credential renewals occurred. The existing SQL approval persists; application/configuration rollout is not approved.

**19 October final-blocker update:** [scoped verification](../releases/professional-cloud-final-blockers.md) passes withdrawal compatibility/denial checks, separate Storage byte restore and current key recovery. The exact manifest has 18 pending migrations / 90 total; it is ready for owner review, not automatically deployed. The 18 October blocker below is historical and superseded by the additive correction.

**18 October history-preparation update:** authentic cloud history has been recovered, the audit version collision has been resolved locally, and the exact rollout is recorded in [the cloud release manifest and evidence](../releases/professional-cloud-release.md). Deployment remains **BLOCKED**: the existing User Side withdrawal RPC passes on the cloud baseline and fails after the pending professional migrations with `INVALID_CASE_TRANSITION`. The historical notes below do not supersede that new gate. No cloud deployment was performed.

Do not run a blanket database push from this working tree. It contains substantial unrelated, uncommitted work. The project owner must approve an exact reviewed migration/application manifest, target environment, backup/restore plan and maintenance window before any remote operation. No remote migration, settings change or deployment has been performed.

The 17 October tooling limitation is historical: Docker/local Supabase and isolated PostgreSQL 17.6 validation are now available and were used for the linked release evidence. PGlite remains a single-connection regression tool; neither it nor a schema replay alone proves live cloud PostgREST/Auth acceptance, independent connection races or production performance.

## Migration order and prerequisites

Use the existing Echo schema/security migration history first. Required dependencies are `auth.users`, `auth.role()`, current `user_service.profiles`, the active verification-admin registry, `user_service.notification_preferences`, and `notification_service.notifications`. Do not create replacement production tables from test fixtures. Preserve current Auth/session, application eligibility and MFA configuration. Verify the deployed migration ledger rather than assuming any file below has been applied.

All files are under `supabase/migrations/`, in this order:

| Order | File | Effect |
| --- | --- | --- |
| 1 | `20261010090000_professional_support_portal.sql` | Original isolated professional schema, service-only grants, RLS and workflow primitives |
| 2 | `20261012160000_professional_credential_reviews.sql` | Encrypted credential references and independent reviews; active clinical memberships become pending |
| 3 | `20261014100000_professional_owner_request_actions.sql` | Owner edit/withdrawal RPCs |
| 4 | `20261014110000_professional_claim_lifecycle.sql` | Current clinical eligibility, claim retry and transition invariants |
| 5 | `20261014120000_professional_dashboard.sql` | Audited scoped counts and bounded agenda |
| 6 | `20261015100000_professional_case_snapshot.sql` | Authorized/audited detail and limited timeline |
| 7 | `20261015110000_professional_consent.sql` | Immutable selected journal grant and irreversible revocation |
| 8 | `20261015120000_professional_notes.sql` | Draft/final lifecycle, revisions and submission IDs |
| 9 | `20261015130000_professional_case_handover.sql` | Encrypted handover/closure records, same-organization transfer |
| 10 | `20261016100000_professional_appointment_lifecycle.sql` | Current eligibility, owner response and atomic replacement |
| 11 | `20261016110000_professional_scheduling_constraints.sql` | `btree_gist`, finite appointment windows and overlap exclusion |
| 12 | `20261016120000_professional_follow_ups.sql` | Encrypted follow-ups and transfer of pending responsibility |
| 13 | `20261016130000_professional_referral_lifecycle.sql` | Internal status/history and RPC-only referral writes |
| 14 | `20261016140000_professional_notifications.sql` | Existing inbox integration with private professional context |
| 15 | `20261016150000_professional_events.sql` | Durable events, due reminders and retry processing |
| 16 | `20261016160000_professional_query_indexes.sql` | Additive indexes for measured query shapes |
| 17 | `20261017100000_professional_event_health.sql` | Service-only aggregate backlog health |
| 18 | `20261018150000_security_professional_http_audit.sql` | Existing HTTP audit event compatibility, uniquely versioned |
| 19 | `20261019090000_professional_withdrawal_compatibility.sql` | Preserve existing owner withdrawal without loosening other transitions |

The ordered test fixture and release test check this list against the actual professional migration filenames. Apply each pending migration once through the reviewed migration mechanism. Never rerun the credential migration to “repair” state: it intentionally demotes active clinical memberships. New RPCs must exist before the matching backend is exposed. Drain/disable professional writes during the coordinated migration/backend switch; do not expose the intermediate synchronous-notification state between migrations 14 and 15.

## Preflight and backup

Latest evidence: [cloud database backup and isolated restore verification](../releases/professional-cloud-backup.md). Database restoration passed; subsequent [Storage/key and withdrawal verification](../releases/professional-cloud-final-blockers.md) also passed. Owner approval and operational retention/configuration prerequisites remain.

Before an approved rollout, take a restorable database backup and verify restoration in isolation. Retain approved encryption key versions through the existing secret-management process; never copy keys into this repository or test logs. Back up encrypted records, consent/audit history, membership and credential review evidence, transfer/closure receipts, notification links and event delivery keys. A database snapshot without the appropriate encryption keys is insufficient for recovery.

`backend/scripts/professional-preflight.sql` is read-only and reports aggregates, not patient identifiers. It requires the original professional schema. It works before or after the later proposals; absent capabilities are reported as false. Run it first on disposable staging, then on a remote target only with explicit approval. Review:

- Nonfinite/overlapping appointments and invalid assignment states must be zero before constraints are added. Resolve legacy conflicts through owner-approved corrections; do not automatically cancel appointments or loosen the constraint.
- Review the count of active clinical memberships and missing credential links before BE-005. Tell affected professionals that reapproval is required. A valid independently reviewed credential and explicit membership activation must follow; no automatic reactivation from copied expiry fields.
- After migration, every professional table must have RLS, and browser schema/table/function privileges must remain absent. Check effective grants, actual backend role, schema exposure and security-definer ownership/search paths on the deployed instance; the isolated fixture does not replace this check.
- Confirm `btree_gist` is available/installed and the exclusion constraint is validated. Check database timezone expectations for date-only credential expiry.
- Review table sizes, index build lock duration, storage and maintenance window. These files use ordinary index creation; a production-specific concurrent build plan needs separate review. No production latency target is inferred from PGlite planner costs.

## Compatibility and rollback

Existing request states and owner appointment response remain unchanged. Notes preserve ciphertext and become final with their original creation time. Legacy referral rows remain internally recorded without fabricated historical events. Consent is never widened. New professional APIs fail closed when their migration is absent; no fallback bypass is allowed.

Rollback should first stop the professional event scheduler and restrict affected professional routes through existing operational controls. Prefer a reviewed forward correction. Do not blindly restore old backend code: old referral inserts lack the new RPC permission, and old clients may misinterpret draft notes or new capability metadata. Maintain a compatible backend or leave affected routes unavailable until repaired.

Never rollback by restoring revoked consent, old assignments, active memberships, mutable final notes, duplicate event delivery, or direct table writes. Do not drop new record/history/outbox tables to hide failures. Retain pending and failed events for later recovery. The six BE-028 performance indexes alone may be removed after review; the appointment exclusion/uniqueness constraints and authorization triggers are security/integrity controls, not disposable tuning indexes. Restoring a whole database backup requires explicit downtime/data-loss approval and reconciliation of intervening writes and notification delivery.

## Event operations

`ProfessionalEventService.runBatch()` enqueues due follow-ups, processes at most 100 ready events, then reads service-only `event_health()`. It returns fixed counts plus the oldest pending timestamp. The helper `backend/scripts/professional-events.mts` refuses nonlocal Supabase hosts and was not run against a live database. On an approved disposable local instance it can be invoked with `npx tsx --env-file=.env scripts/professional-events.mts` from `backend`; `--retry-failed` is an explicit recovery action after fixing the cause.

Production scheduling is **not enabled**. The owner must approve a scheduler, cadence, responsible operator and backlog alerting. Monitor failed count, delivery failures, backlog growth and oldest pending age. Alert on any terminal failed event; investigate sustained ready backlog without logging identifiers or content. Reprocessing uses stable event keys and current eligibility checks. Opt-out, reassignment and stale reminders are intentionally suppressed, not failed. There is no external email/SMS/referral transport, exact delivery-time guarantee or emergency monitoring service.

## Acceptance gates and known gaps

- **BE-010/021/029:** run independent PostgreSQL connections against disposable fixtures. Race two different actors claiming one request; overlapping appointments across cases/organizations; claim versus withdrawal; transfer/closure versus notes/follow-ups; consent revocation versus snapshot; membership suspension versus reads/writes; and two event workers plus a canceled/failed worker transaction. Assert one owner/active booking, atomic audit/receipts, no stale authorization grant and no duplicate delivery. Single-connection queued tests are not substitutes.
- **BE-016:** approve and implement a versioned, owner-selected PHQ-8 sharing contract before exposing assessments. Current journal consent is insufficient. Do not infer consent from case membership or journal analysis.
- **BE-026:** organization-approved escalation protocol, trained human responsibility and any external service integration are missing. Only reviewed resources are supported; escalation remains disabled.
- **Deployment/UI:** unapplied credential migration, secure binary evidence upload infrastructure, transfer/draft/referral/follow-up/notification controls, production scheduler and live authenticated browser acceptance remain explicit integration work where not already wired. Existing frontend adapters and compatible dashboard/case improvements remain available; synthetic preview is not live integration evidence.
- Test the actual deployed Auth/MFA/session revocation, reviewer independence, credentials, tenant isolation, consent, error mapping, cookie/origin boundaries and RLS with synthetic accounts. Preserve User Side notification/privacy behavior and verify generic professional inbox messages contain no protected context.
- Obtain owner acceptance at mobile/desktop widths and verify production/nonlocal preview rejection. No final visual QA, deployment or Scrum completion is claimed here.

## Local validation evidence

Final runs on 17 October passed **495 backend tests across 41 files** and **21 focused frontend tests across 2 files** (516 total). Both typechecks and targeted ESLint passed; the existing professional-service console warning remains. Tracked diff and 63 scoped new-file whitespace checks passed. BE-028's seven tests execute EXPLAIN ANALYZE/BUFFERS on fictional data; six query shapes use the new indexes with lower estimated costs. BE-029's three integrated journeys execute the real router, services, encryption and all proposed migrations through a test SQL transport and synthetic Auth/journal source. BE-030 validates the combined migration order, read-only preflight, RLS/grants and aggregate event health. No live browser, remote database or independent-connection test ran. These tests do not establish production readiness.
