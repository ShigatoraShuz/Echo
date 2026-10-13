# Buddy history rollout

Buddy history uses `20261012091000_buddy_conversation_pins.sql` and
`20261013010000_buddy_history_controls.sql`. Apply both before deploying the
backend and frontend changes together. Do not expose the new history UI against
an older database schema. The current development checkout has not applied
these migrations to the linked Supabase project.

The new `buddy_history_enabled` preference defaults to `true` for existing
accounts. The first migration retains the legacy `title` column so existing
export snapshots remain valid. New and renamed titles put only the neutral
text `Buddy conversation` in that column; the actual title is encrypted in
`title_ciphertext`. Existing rows need a backfill before their plaintext title
is protected. Run this during a Buddy write maintenance window:

```powershell
npm.cmd run backfill:buddy-history -w backend
npm.cmd run backfill:buddy-history -w backend -- --apply
```

The script verifies every rewritten title and fails if any plaintext title or
missing ciphertext remains. It also fills encrypted previews and keyed search
tokens for historical messages. Run the dry-run and apply command again after
rotating the active encryption key so the search index uses the new key.
Existing Buddy message ciphertext must already pass the earlier Buddy
ciphertext backfill before this script runs.

After backfill, check a test account's older titles, previews, whole-word
search, pin ordering, deletion, and export. The compatibility `title` column
can be removed in a separate migration only after the export snapshot function
is updated to read `title_ciphertext` and the live database check confirms no
unprotected legacy titles. Until then, it contains a neutral placeholder
after the backfill.

The isolated SQL test covers function execution, owner isolation, disabled
history, search, and delete cascades. It does not prove the live Supabase or
browser flow; verify those against a staging database before rollout.
