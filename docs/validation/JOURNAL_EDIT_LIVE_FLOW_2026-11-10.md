# Live journal edit and regeneration validation — 2026-11-10

## Actual app test

Private Tailscale Echo, remembered approved test account, synthetic entry `eac4983a-e22d-4866-900a-3238ec7ac7b8`.

Edited through the visible Edit entry form and Save changes button. Changed the synthetic presentation-anxiety journal to a finished presentation, pride, teamwork, rest, and recording one lesson learned.

Found and fixed three integration defects:

1. Zod partial creation schema still applied creation defaults on PATCH. Omitted analysis consent became false; omitted tags/emotions/privacy could also be replaced. Update schema now removes defaults while retaining the original validators. Explicit true/false still works.
2. Atomic edit RPC did not advance updated_at. New migration `20261110033413_journal_edit_revision_timestamp.sql` updates the revision timestamp in the same transaction as the encrypted content, old-result invalidation, and new job admission. Applied successfully to the connected project. Backend-only function permissions retained.
3. getLatestAnalysis included archived requests. After editing this returned stale results or failed maybeSingle when multiple revisions existed. It now filters deleted_at IS NULL while retaining owner and journal predicates.

The initial failed test incorrectly turned analysis off. Restored only this synthetic test entry's known prior enabled analysis setting, then repeated editing through the actual UI. No other journal/account preferences were changed.

## Verified after all fixes

- Save changes persisted the edited body.
- The previous report and recommendations disappeared; visible live safety/emotion progress appeared without a manual refresh.
- New output was Joy / Others, replacing Fear / Anxious.
- Buddy generated fresh recommendations about celebrating the team and writing down a lesson learned, replacing the preparation/rehearsal advice.
- A second repeat edit produced another fresh result.
- Full reload preserved exactly the final new recommendations. Compared visible recommendation text before and after reload: identical; different from original and earlier edit.
- No face capture was requested in the edit test.

## Automated checks

- Journal routes/edit/availability regression suites: 24 passed.
- Full backend suite: 1210 passed, 5 skipped.
- Isolated PostgreSQL migration suite: all 26 files passed, including revision advance, stale timestamp rejection, old worker/face fencing, quota rollback, ownership, and restricted RPC execution.
- Backend typecheck passed; changed backend lint: zero errors, one existing console warning.
- No frontend code, model weights, or generation policy changed in these fixes.

Security advisor findings matched the pre-change baseline; the edit RPC remains unavailable to anon/authenticated roles. Existing findings are outside this journal fix: https://supabase.com/docs/guides/database/database-linter

Screenshot: local project workspace journal-edit-verified.jpg (synthetic test content only).
