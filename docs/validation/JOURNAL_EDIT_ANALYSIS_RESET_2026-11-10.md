# Journal editing and analysis reset — 2026-11-10

Saved journal details now offer inline title/body editing with Save and Cancel. Existing delete confirmation and photo attachment features remain available. Failed saves retain the user's edited text; a stale revision is rejected instead of silently overwriting another tab.

Encrypted edits use journal_service.edit_journal in one transaction. The transaction locks the owned journal and its jobs, compares the expected timestamp, saves encrypted text, retires prior requests and leases, clears prior progress and face results, refreshes affected aggregates, and inserts a fresh analysis request when current consent and access permit. Existing quota and access checks remain active; failed admission rolls back both text and invalidation. Original immutable analysis audit records are retained but excluded from current results.

A database trigger also invalidates results for direct content updates. New hosted face saves use an atomic journal revision fence so an older capture cannot attach to edited writing. Compatibility with an installation that lacks both new RPCs retains the previous face workflow; it never falls back after an access/revision error or when the edit RPC exists.

After successful saving the detail view clears prior analysis, reloads authoritative entry/progress data, remounts the report for the new revision, retains photos, and broadcasts the existing journal-changed event so dashboard/list/Insights reads are invalidated. Unchanged content is not requeued. The independent user-completed PHQ-8 check-in is unchanged.

Verification:

- 1,361 frontend tests passed; includes inline editing/cancel, retained input on failure, reset analysis, and new-job progress after save.
- 1,205 backend tests passed; 5 existing skips.
- 26 isolated database test files passed; edit tests include owner isolation, timestamp conflict, old worker/face rejection, and rollback on quota rejection.
- Production frontend build and frontend/backend type checks passed. Changed frontend files have no lint errors; backend has no lint errors and one existing console warning.
- Supabase migration journal_edit_analysis_reset was approved and applied to the existing Echo project.
- Deployed edit/reset was checked in a rolled-back transaction on the previously labeled synthetic test journal. Fresh request admission and old result/progress removal passed; no permanent change was made to that journal.
- Supabase REST resolves the new RPC and rejects a nonexistent/foreign journal as expected.
- Updated private production UI was rebuilt/restarted. Tailscale readiness returned HTTP 200.
- Interactive browser verification was unavailable because local browser use is disabled in Work settings. No claim is made of a live UI edit or a newly completed model inference from an edited journal; the live database transaction and automated suites validate the save/reset/queue behavior.
