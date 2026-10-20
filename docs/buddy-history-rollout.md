# Buddy history rollout

Buddy history uses `20261012091000_buddy_conversation_pins.sql`,
`20261013010000_buddy_history_controls.sql`, and
`20261013011000_buddy_search_legacy_owners.sql`, and
`20261013012000_buddy_privacy_setting_grant.sql`. Apply them before deploying the
backend and frontend changes together. Do not expose the new history UI against
an older database schema.

Before applying them, encrypt any legacy plaintext Buddy messages. The older
Buddy ciphertext migration allowed existing rows to remain until a reviewed
backfill, while new rows were required to be encrypted. The live operator is a
read-only dry run by default, prints counts only, and uses a compare-and-swap
RPC when explicitly applied. Run it during a Buddy write maintenance window:

```powershell
npm.cmd run backfill:buddy-ciphertext:live -w backend
npm.cmd run backfill:buddy-ciphertext:live -w backend -- --apply --confirm-project=<linked-project-ref>
npm.cmd run backfill:buddy-ciphertext:live -w backend
```

The last dry run must report `needsMigration: 0` and `unreadable: 0`. Never
place message text, database keys, or access tokens in command output.

Then inspect exactly which linked migrations are pending before changing the
database:

```powershell
supabase.cmd migration list --linked
supabase.cmd db push --linked --dry-run --skip-vault
```

The legacy-owner migration removes a redundant search-table user foreign key so
retained conversations from deleted legacy accounts can be indexed without
deleting them. Search rows still have a composite foreign key to their exact
conversation and owner. If the dry run includes unrelated migrations, review those separately before
running `supabase.cmd db push --linked --skip-vault`. A push applies every
pending migration in timestamp order. Confirm the Buddy columns, search table,
and functions exist after the push.

The new `buddy_history_enabled` preference defaults to `true` for existing
accounts. The first migration retains the legacy `title` column so existing
export snapshots remain valid. New and renamed titles put only the neutral
text `Buddy conversation` in that column; the actual title is encrypted in
`title_ciphertext`. Existing rows need a backfill before their plaintext title
is protected. Run this during a Buddy write maintenance window:

```powershell
npm.cmd run backfill:buddy-history -w backend
npm.cmd run backfill:buddy-history -w backend -- --apply
npm.cmd run verify:buddy-history -w backend
```

The script verifies every rewritten title and fails if any plaintext title or
missing ciphertext remains. It also fills encrypted previews and keyed search
tokens for historical messages. Run the dry-run and apply command again after
rotating the active encryption key so the search index uses the new key.
Existing Buddy message ciphertext must already pass the live Buddy ciphertext
backfill above before this script runs.

After backfill, check a test account's older titles, previews, whole-word
search, pin ordering, deletion, and export. The compatibility `title` column
can be removed in a separate migration only after the export snapshot function
is updated to read `title_ciphertext` and the live database check confirms no
unprotected legacy titles. Until then, it contains a neutral placeholder
after the backfill.

The isolated SQL test covers function execution, owner isolation, disabled
history, search, and delete cascades. It does not prove the live Supabase or
browser flow; verify those against a staging database before rollout.
