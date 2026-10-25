# User Side notification panel redesign

Implemented in the current local working tree on 2026-10-25. Existing Professional notification delivery work, sound preferences and uncommitted changes were preserved. No shared-cloud requests/writes, migrations, commits, pushes or deployments were performed.

## Result

- The centered modal/dropdown is replaced by a 440px maximum-width panel anchored to the actual bell rectangle. Small screens use a compact bottom/right panel with safe-area spacing and internal scrolling.
- Header, visible All / Inbox / General / Appointments tabs, cards and actions follow the Professional notification pattern using existing semantic tokens. No palette/theme-token changes or Professional UI changes.
- Tabs have proper tablist/tab/tabpanel semantics, roving keyboard focus, Arrow/Home/End interaction and visible active styling. Escape, close, backdrop dismissal, bell toggle, navigation and focus restoration are preserved.
- Mark-one, mark-all, server unread counts, owner routing, event/focus/visible polling refresh, stale-request fencing, account/logout cleanup and sound observation remain connected. Category browsing and older pages are not sound discovery.
- Light-theme card contrast was corrected locally within the new panel styles. All four desktop/mobile theme scans have zero WCAG A/AA axe violations within the panel.

## Pagination and exact event semantics

The old API had only a bounded newest-items list, so filtering its first 20 rows could falsely hide appointments. No migration was needed: GET /api/v1/notifications now accepts optional category and before parameters while preserving status=all|unread and limit. Category filtering runs before the limit with the same authenticated user_id predicate and existing request-user client/RLS. nextCursor is additive metadata; timestamps plus UUID IDs make older-page ordering stable even when timestamps tie. Unread count remains the full account unread count, independent of category/page.

Actual emitted appointment types are shared in packages/contracts/src/notification.ts:

- professional_appointment_proposed: proposal and replacement proposal.
- professional_appointment_update: owner delivery for appointment status transitions, including responses/cancellation.
- professional_appointment_completed: direct completion notice.

Titles are not classification inputs. Support messages and other non-appointment types remain General. Existing notification resource routing is preserved. Restart/use the current local Express backend for the category query support; an older backend does not implement this additive filtering.

## Files changed in this task

Application:

- frontend/src/shared/components/navigation/notification-bell.tsx
- frontend/src/shared/components/navigation/notification-panel.css (new)
- frontend/src/shared/components/navigation/notification-panel.model.ts (new)
- frontend/src/services/notifications/notifications.service.ts
- packages/contracts/src/notification.ts
- backend/src/features/notifications/notifications.routes.ts
- backend/src/features/notifications/notifications.service.ts

Tests/tooling:

- frontend/src/shared/components/navigation/notification-bell.test.tsx
- frontend/src/shared/components/navigation/notification-panel.model.test.ts (new)
- backend/src/features/notifications/notifications.routes.test.ts
- backend/src/features/notifications/notifications.pagination.test.ts (new)
- frontend/e2e/harness/main.tsx
- frontend/e2e/harness/services.ts
- frontend/e2e/harness/next.tsx
- frontend/e2e/user-notifications.spec.ts (new)
- frontend/playwright.notifications.config.ts (new)
- frontend/eslint.config.mjs (ignore generated frontend/tmp files)

The existing notification-sound implementation and Professional notification components were not edited by this task. Temporary authoring backups are under repo tmp; screenshots and this report are under artifacts/user-notifications.

## Successful verification

- Frontend typecheck: PASS.
- Backend typecheck: PASS.
- Shared contracts build: PASS.
- Frontend notification/model/sound/Professional-center/Professional-bell/shell/calendar tests: 67 passed across 7 files.
- Backend notification service/routes/pagination tests: 10 passed across 3 files.
- User notification Playwright journeys: 5 passed, covering 390px and 1440px in light/dark, pagination, exact category selection, mark-all, count changes, empty state, retry, keyboard focus, navigation and outside dismissal.
- Existing Professional notification discovery/explicit-sound Playwright journey: 1 passed.
- Frontend full lint: PASS with 0 errors and 28 existing source warnings. The first run scanned old generated code in frontend/tmp and failed; excluding that generated directory restored source-only lint. Complete final log: frontend-lint.txt.
- Tracked implementation whitespace check: PASS.

These are isolated fixture browser journeys and local unit/query tests, not authenticated shared-Supabase E2E. The browser harness has no credentials and rejects non-loopback requests. Screenshots show fictional data.

## Screenshots

- panel-390-light.png
- panel-390-dark.png
- panel-1440-light.png
- panel-1440-dark.png

No shared database/schema change or manual permission step is needed for the redesigned local UI.
