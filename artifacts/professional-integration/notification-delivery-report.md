# Professional notification delivery - local implementation

Date: 2026-10-25. Repository: C:\1Thesis\Echo. Branch: feat/professional-portal-sprint-0.

## Scope and safety

Implemented and tested in the current dirty working tree, preserving prior changes. No shared Supabase calls, migration application, event processing/suppression/replay, preference changes, account creation, commits, pushes or deployment were performed. Database regression tests execute real SQL in isolated in-memory PGlite with fictional fixtures; they are not authenticated shared-cloud E2E.

The project's six existing events and two generic chat notices are evidence supplied by the developer, not independently queried during this task.

## Root causes and fixes

1. ProfessionalEventService.runBatch existed but normal backend startup never invoked it. A server-owned lifecycle now invokes it immediately and serially every 30 seconds after completion when explicitly enabled. Each existing RPC batch is bounded to 100. Failures are retried on the next interval, without overlapping runs or automatically replaying terminal failed events. Existing SQL handles per-event backoff, transaction rollback, deduplication and current assignment/preference checks. Startup reports started/disabled; batches report fixed counters or a redacted failure event. Shutdown stops scheduling and awaits the current batch.
2. The counselor's in_app_enabled=false is a legitimate opt-out, not permission to override it. The existing queue policy suppresses ineligible/opted-out events when processed. Direct generic notifications previously skipped preferences; they now require an explicit true preference and fail closed on missing rows or query failures. No preference is silently created or enabled.
3. The Professional center only used notification_links. Existing professional_case_message inbox records lack those links. The new SQL proposal merges safe chat metadata with linked events using the authenticated recipient, active clinician authority, current case assignment and exact organization. Historical notification IDs need not equal message IDs. Generic titles/message bodies are never returned. Mark-read rechecks and locks the current case, preserves the first read timestamp, and denies cross-user/org/reassigned cases.
4. Unread counts were derived from at most 50 items. The proposal returns an exact unreadCount over the authorized source. The UI uses it, retains bounded-response qualification for older databases, and distinguishes a failed read from a zero count.
5. General was a placeholder filter. It now includes case/referral/follow-up events; a Messages filter includes chat notices. The open center and bell refresh on notification-change signals and visible focus/polling. Mark-read updates both experiences. Opt-out, empty, loading and error states are explicit. Existing palette/classes/tokens are preserved.
6. The bell's actual sound hook is tested end to end within the component test environment. Sound requires explicit per-device opt-in, an audio-unlocking gesture, visible document, allowed in-app policy and allowed quiet hours. Initial snapshots, duplicates, muted/hidden updates and historical items following an initially empty snapshot remain silent. Only the existing boolean preference is persisted; notification identities remain in memory.

## Worker operation

PROFESSIONAL_EVENTS_ENABLED defaults to false. ECHO_HTTP_ONLY_MODE also prevents startup even when the opt-in is true. Only set the opt-in in an operator-controlled backend environment after approving the exact database target and the processing/suppression of all ready events. This task did not change an actual .env file or start a backend worker.

There is no public HTTP processing route and no service-role credential is sent to the frontend. The pre-existing request-scoped retry worker is retained unchanged.

## Local migration proposal

Created with the pinned Supabase 2.121.0 CLI, without a database connection:

supabase/migrations/20261025065756_professional_notification_inbox.sql

SHA-256: 18d00e3d447579b0972f7c90544bc75c303ede40394c3cd16bd8a1c242d9225f

Replaces only professional_service.list_notifications(uuid,uuid,boolean) and professional_service.read_notification(uuid,uuid,uuid). Browser/PUBLIC execute remains revoked; service_role execution remains granted. No tables, RLS, roles, preferences, notification backfill or existing queue events are changed. Not applied to a persistent local database or shared Supabase. Older pending proposals were not edited or applied.

Until this proposal is approved/applied, the shared database still has the older notification-list contract: merged chat visibility and exact totals are not live-verified. The earlier appointment owner-delivery proposal remains a separate dependency for that enhanced delivery path if it is not already installed.

## Exact successful checks

- Backend: `npm run typecheck -w backend` - PASS.
- Frontend: `npm run typecheck -w frontend` - PASS.
- Backend: `npm run test -w backend -- --silent=true src/features/professionals src/config/__tests__/environment.test.ts src/config/__tests__/http-only-mode.test.ts` - 514 tests passed, 41 files; 25.70 seconds in the final run.
- Frontend: `npm run test -w frontend -- src/features/professionals/components/professional-notification-center.test.tsx src/features/professionals/components/professional-notification-bell.test.tsx src/services/notifications/notification-sound.test.ts src/shared/hooks/use-workspace-refresh.test.tsx src/services/professionals/professional-api.test.ts src/features/professionals/components/professional-shell.test.tsx src/features/calendar/view/calendar-view.test.tsx` - 54 tests passed, 7 files; 4.91 seconds.
- Targeted implementation ESLint - zero errors; nine backend console warnings and one frontend ref-cleanup warning.
- Tracked-file whitespace check - PASS; Git emitted line-ending notices only.

Coverage includes disabled/missing preferences, worker startup/disabled status, no overlapping batches, transient failures, terminal queue failures, reminders, referral/case events, appointment persistence/delivery, exact unread totals above the page limit, chat deduplication and legacy IDs, role/MFA restrictions, two organizations sharing a clinician, reassignment, read acknowledgement idempotency, no public processing endpoint, filtered presentation, logout/access loss, shell/calendar refresh and genuine sound playback without initial/duplicate playback.

## Files changed by this task

### Backend implementation/configuration

- backend/.env.example
- backend/src/config/environment.ts
- backend/src/server.ts
- backend/src/features/professionals/professional-event-processor.ts (new)
- backend/src/features/professionals/professional.service.ts
- supabase/migrations/20261025065756_professional_notification_inbox.sql (new, unapplied)

### Frontend implementation

- frontend/src/services/professionals/professional-api.ts
- frontend/src/features/professionals/components/professional-notification-bell.tsx
- frontend/src/features/professionals/components/professional-notification-center.tsx
- frontend/src/shared/hooks/use-workspace-refresh.ts
- frontend/src/services/notifications/notification-sound.ts

### Tests and synthetic fixtures

- backend/src/config/__tests__/environment.test.ts
- backend/src/features/professionals/__tests__/professional-event-processor.test.ts (new)
- backend/src/features/professionals/__tests__/professional-inbox-delivery.integration.test.ts (new)
- backend/src/features/professionals/__tests__/professional-main-integration.test.ts
- backend/src/features/professionals/__tests__/professional-notifications.test.ts
- backend/tests/fixtures/professional-migrations.ts
- backend/tests/fixtures/professional-sql-client.ts
- frontend/src/features/professionals/components/professional-notification-bell.test.tsx
- frontend/src/features/professionals/components/professional-notification-center.test.tsx
- frontend/src/shared/hooks/use-workspace-refresh.test.tsx
- frontend/src/services/notifications/notification-sound.test.ts
- artifacts/professional-integration/notification-delivery-report.md (this report)

## Minimal future shared-cloud verification plan - requires separate authorization

1. Read-only: re-confirm project lruciislmmqvcwweqjop, function definitions/grants, pending migration history and the proposal hash. Stop if the pinned CLI dry run includes any unapproved migration. Do not automatically apply the earlier owner-delivery proposal or any other pending SQL.
2. Obtain approval for the exact inbox proposal before applying through the established pinned CLI migration workflow with --skip-vault. Verify function privileges and ledger afterward. No preference or event backfill is part of this SQL.
3. Through the counselor's normal authenticated MFA UI, verify that the two previously persisted eligible chat notices appear under the correct organization even while delivery is off; their bodies must remain absent. Mark-read is a write and needs the authorized verification scope.
4. For new-delivery testing, the account owner must explicitly enable in-app notifications through Settings if desired; create only approved fictional case/chat/appointment/referral/follow-up events. Verify same IDs, organization isolation, exact counts, acknowledgement refresh and one enabled/visible chime. Keep sound off for baseline/mute/hidden tests.
5. Keep the global processor disabled while the six existing events must remain untouched. A separately authorized request-scoped test is possible only if its scoped processing function is installed. Enabling the global processor requires approval covering those six as well: with the current opt-out, processing suppresses rather than delivers them. Re-enabling notifications later does not automatically replay suppressed events. No such processing, suppression or replay is authorized or performed in this task.
