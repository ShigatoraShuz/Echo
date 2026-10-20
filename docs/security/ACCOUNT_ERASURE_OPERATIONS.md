# Account erasure and retention operations

This describes the locally implemented lifecycle. Applying the migrations, starting workers, changing the Privacy Notice, and running destructive jobs against a linked project require a separate release decision. No production deletion should be claimed from a passing local test.

## Deploy in order

1. Review and apply `20261014090000_account_erasure_lifecycle.sql`, `20261014091000_professional_account_erasure.sql`, and `20261014092000_category_retention_controls.sql` to a disposable Supabase project first. The third migration creates an **unapproved** policy row; it does not activate proposed category purges.
2. Set a fresh, secret, 32-byte base64 `ACCOUNT_ERASURE_HMAC_KEY_BASE64` in the backend worker environment. Keep this key outside the database backup and retain it for restore checks. Losing it makes old tombstones impossible to match; rotating it requires an explicit rehash plan.
3. Run `npm.cmd run build -w backend`, then run `npm.cmd run worker:account-erasure -w backend` as a separate, supervised process. Keep one or more instances running; the database lease serializes claims. Alert when a due job remains `pending`/`retry`, a lease repeatedly expires, or `last_error_code` persists. The API web process alone does **not** run erasure.
4. Schedule a signed tombstone archive after each completion, and store it outside the database and its restore scope: `npm.cmd run erasure:restore -w backend -- archive <new-archive.json>`. The command refuses to overwrite an existing file. Secure the archive and monitor successful export; a local file on an ephemeral worker is insufficient.
5. Schedule the active one-year audit and existing analysis/journal cleanup (`npm.cmd run retention:active-policy -w backend -- --apply`) where it can access service credentials; run without `--apply` to preview counts. Proposed category retention stays in dry-run mode (`npm.cmd run retention:categories -w backend`). Only after policy approval and a versioned notice release should an operator record an approval reference and schedule `npm.cmd run retention:categories -w backend -- --apply`. Professional shared-record retention has its own separate approval gate.

## Account flow

Requesting deletion opens a 30-day cancellation window. The API and RLS restrict the account to the deletion center, export, and cancellation. Active analysis is stopped; professional appointments and patient cases are cancelled/withdrawn. Cancelling restores ordinary account access, but does not restore those appointments or cases.

After the deadline, the worker claims a durable job, disables the profile, revokes sessions, and checks for active practitioner assignments. An administrator must reassign active cases before a practitioner's identity can be erased. The worker inventories the three private Storage buckets and database paths, records a manifest, deletes files, removes child rows without cascade, hard-deletes Auth identity, verifies remaining UUID references and Storage, then writes a keyed, content-free tombstone. Storage, Auth, and database changes cannot be atomic together. Failures leave a retryable job with a machine-readable error code; never mark it completed manually to clear an alert.

The backend must retain service-role access to `user_service` and the private buckets. The worker's HMAC key must not be sent to the browser or logged. `account_erasure_jobs` and `account_erasure_objects` are service-only tables.

## Backup restore gate

Before serving traffic from a restored database:

1. Load the newest signed archive from the independent archive store. Block application traffic until this check and any replay complete.
2. Run `npm.cmd run erasure:restore -w backend -- check <archive.json>` against the restored project. Exit code 2 means the backup resurrected a previously deleted identity. A signature mismatch is a hard stop.
3. With the application still offline, run `npm.cmd run erasure:restore -w backend -- requeue <archive.json>` to schedule those identities for immediate erasure. Run the erasure worker until those jobs complete, then repeat `check` until it reports zero restored identities. A nonzero count after replay is a failed restore gate.
4. Confirm the archive contains every completion through the restore cutover. Keep provider backup-expiry and external processor deletion receipts with the release evidence. A signed archive stored only in the restored database cannot protect against point-in-time rollback.

## Release verification

- Run `npm.cmd run test:sql:isolated`, backend and frontend typechecks, focused worker/API/UI tests, and the full build.
- On a disposable provider-backed account, request deletion and confirm all normal API and direct PostgREST access is denied while export and cancellation work. Cancel once, then request again. Advance only that test request's deadline in the disposable project. Exercise a storage failure and Auth failure, confirm retry and no false completion, then complete the job and verify Auth, relational rows, and every private bucket.
- Repeat with patient-owned cases and a practitioner with active cases. Verify reassign-before-erasure and unaffected patients' support history.
- Perform a backup restore drill with a signed tombstone archive. Confirm requeue and final zero-match check before traffic resumes.
- Confirm the hosting provider's backup expiry, processor retention, and restricted audit retention against the versioned Privacy Notice. The current document specifies one year for sanitized audits and restricted safety records; the other category periods in `DATA_CLASSIFICATION_AND_RETENTION.md` remain proposed.

Until the external archive, worker supervision, provider-backed lifecycle test, and restore drill are in place, the code is ready for staging validation, not a production erasure guarantee.
