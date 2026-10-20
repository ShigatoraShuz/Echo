# Final cloud deployment blocker verification — 19 October 2026

**Prepared for owner approval, not deployed.** Verified target: `lruciislmmqvcwweqjop` / ECHO UPDATED THESIS2 / `ap-south-1`. The three identified blockers passed the scoped checks below. The [exact release manifest](professional-cloud-manifest.json) has **72 unchanged cloud baseline versions and 18 ordered pending migrations, 90 unique versions**. Read-only reinspection matched every baseline name/version and recorded-statement digest.

## Request withdrawal: FIXED

Reproduced the original `INVALID_CASE_TRANSITION` on actual isolated PostgreSQL 17.6, both cloud-baseline-plus-rollout and fresh chronological replay. Existing `withdraw_request()` legitimately changes submitted/assigned/scheduled requests to `withdrawn`, but the pending `enforce_request_transition()` definitions in `20261014110000_professional_claim_lifecycle.sql` and `20261015130000_professional_case_handover.sql` rejected it.

New additive migration **`20261019090000_professional_withdrawal_compatibility.sql`** preserves the existing function's guards and adds only the active-to-withdrawn transition with sharing revoked. Organization, owner, assignment, transfer-receipt, scheduling and terminal-state rules remain. Existing service-only RPC permissions and actor checks are unchanged. Withdrawal still cancels proposed/confirmed appointments, revokes shared records and emits the existing audit/case events. No applied migration was rewritten.

Both final PostgreSQL replays applied all **90 migrations**, passed before/after owner withdrawal, and passed the rolled-back fictional regression fixture. It covers submitted/assigned/scheduled withdrawal; wrong-owner and clinician impersonation denial; revocation required; invalid scheduling, cross-organization movement, assignment tampering, terminal reopening and repeat terminal withdrawal denied; professional status RPC cannot withdraw; browser RPC/table writes denied; appointment cancellation and sharing/audit effects verified. The backend's separate submitted-only `withdraw_own_request()` retains its closed state and retry behavior.

RLS/browser privilege preflight still passes. Existing local fixture counts remained 7 accounts / 2 organizations / 5 memberships / 4 credentials. Final rehearsal container `echo_release_validation_10dd1c9c` is stopped, network disabled and no ports; private evidence remains ignored under `backend/tmp/professional-release/`.

## Storage backup: VERIFIED

Reused the secured external directory recorded in [database backup evidence](professional-cloud-backup.md). Under its `storage/` directory: full bucket/object metadata, object bytes keyed by ID, path mapping/checksum manifest and `verification.json`. **20 objects across 3 buckets; 439,795 bytes.** All 20 response ETag MD5 checks and all 20 saved/restored SHA-256 checks passed. Inventory was reread after download and remained identical.

Restored into a new private filesystem tree within that secured external directory, reconstructing original bucket/object paths, detecting unsafe/colliding paths and rereading every restored file. This proves object-byte/path recovery; it is **not** a live Supabase upload/browser acceptance test. Remote requests were authenticated GETs only. No signed URLs or object contents entered Git/output. Original database archive/role/metadata/catalog SHA-256 values remain unchanged; its earlier isolated database restore remains verified.

## Encryption-key recovery: VERIFIED for existing records

The authorized recovery source is the existing ignored private `backend/.env`; no key was printed, copied, rotated or written elsewhere. Current AES-256-GCM key version **1** is available and is the only version detected as required. One synthetic encrypt/decrypt probe passed. Read-only inventory of application text envelopes, bytea ciphertext/IV/tag/version groups and nested JSON envelopes produced **35 payloads; all 35 decrypted in memory**, with zero missing versions, failed payloads or unsupported encrypted-field formats. No plaintext was logged or persisted.

There are no existing journal idempotency records requiring historical HMAC versions and no Vault secret rows. The one existing TOTP factor is directly recoverable from the database backup: seed fingerprints matched the isolated restored database in memory. No actual seed was displayed/exported separately or used to generate/challenge an OTP. No MFA configuration or enrollment changed.

Retain `JOURNAL_ENCRYPTION_KEY_BASE64`, its version and any future `ENCRYPTION_PREVIOUS_KEYS_JSON` versions. Preserve configured idempotency HMAC keys and registration draft signing secret/fallback, plus existing Auth signing/provider/service configuration for application recovery. Passwords are intentionally excluded from the roles export. **Independent off-device key escrow and a full Auth/provider/Storage application-stack failover were not verified.** This is evidence of current authorized key availability and data recovery, not a claim of complete disaster recovery after losing this machine.

## Validation and remaining owner prerequisites

- **36 tests passed across 6 files:** manifest/audit, existing owner actions, handover/closure, combined release security and encryption. Handover tests now exercise the corrected trigger. The release test accounts explicitly for authentic recovered account-erasure history, which the full PostgreSQL runner executes separately from its synthetic fixture.
- Both real PostgreSQL 90-migration replays and the withdrawal denial/side-effect probes passed. Backend TypeScript, standalone script TypeScript, targeted ESLint and tracked/new-file whitespace checks passed.
- No remote migrations, SQL writes, role provisioning, Storage mutations, settings changes or deployment in this pass. No existing database resets, fixture deletion, environment edits, commits, pushes, merges, branch changes, Scrum updates, frontend/theme/User Side source changes.
- Owner must approve the exact manifest/application release and maintenance window; acknowledge clinical membership demotion/reapproval from the credential migration; retain the verified backup and private key environment; arrange independent secure/off-device retention; preserve/confirm Auth/MFA and PostgREST service-schema configuration; and recheck the ledger/refresh backups at cutover if source data/configuration changes. Live post-deployment acceptance remains required. **No blanket push is approved.**

## Exact files changed in this pass

- `supabase/migrations/20261019090000_professional_withdrawal_compatibility.sql`
- `backend/scripts/lib/professional-cloud-readonly.mts`
- `backend/scripts/professional-storage-backup.mts`
- `backend/scripts/professional-key-recovery.mts`
- `backend/scripts/professional-release-check.mts`
- `backend/tests/fixtures/professional-withdrawal-regression.sql`
- `backend/tests/fixtures/professional-migrations.ts`
- `backend/tests/security/professional-release-manifest.test.ts`
- `backend/src/features/professionals/__tests__/professional-handover.database.test.ts`
- `backend/src/features/professionals/__tests__/professional-release.database.test.ts`
- `docs/releases/professional-cloud-manifest.json`
- `docs/releases/professional-cloud-final-blockers.md`
- `docs/releases/professional-cloud-backup.md`
- `docs/releases/professional-cloud-release.md`
- `docs/architecture/professional-backend-release.md`
- `docs/progress/professional-backend-handoff.md`

The external Storage/restore artifacts and key-verification aggregates are private backup artifacts, not repository files. Existing uncommitted work is preserved.
