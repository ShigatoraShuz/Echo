# Professional cloud migration preparation ? 18 October 2026

**Latest execution checkpoint, 19 October:** the owner approved the exact 18 SQL migrations. [Deployment preparation](professional-cloud-deployment.md) verified the live baseline, pending versions, SQL hashes and recovery material. Deployment is **BLOCKED before dry run by missing valid database credentials**; zero migrations applied and no credentials renewed. Historical readiness evidence below remains valid, but does not mean the cloud release was executed.

**19 October: ready for owner approval after scoped blocker verification; no deployment performed.** See [current withdrawal/Storage/key evidence](professional-cloud-final-blockers.md). The historical failure evidence below was corrected by additive migration `20261019090000_professional_withdrawal_compatibility.sql`. Target: `lruciislmmqvcwweqjop` (ECHO UPDATED THESIS2). No remote migration, role initialization, history repair, account/configuration write or deployment was performed during the history-reconciliation pass. The subsequent [backup verification](professional-cloud-backup.md) used only the separately authorized temporary backup-login metadata exception; database restoration is now verified in isolation.

## Authentic history recovery

The project identity was verified with Management API GET and matched the linked reference and backend environment. The ledger was exported directly through Management API `database/query` with `read_only: true` and the fixed query:

`select version,name,statements from supabase_migrations.schema_migrations order by version`

All 13 absent versions had nonempty recorded statement arrays. The collided `journal_draft_images` version was also recovered, for **14 authentic files**. No branch contained these files; no placeholder SQL was invented. Files preserve recorded statements, with statement terminators and spacing reconstructed from the ledger array; original file formatting is not recoverable from that array. The JSON manifest records each original statement-array SHA-256, statement count, and recovered file SHA-256. No secrets are included. The complete export used by the local checker remains ignored at `backend/tmp/professional-release/remote-history.json`.

Recovered files under `supabase/migrations/`:

- `20261011100000_user_professional_support_workspace.sql`
- `20261012090000_calendar_items.sql`
- `20261012091000_buddy_conversation_pins.sql`
- `20261013010000_buddy_history_controls.sql`
- `20261013011000_buddy_search_legacy_owners.sql`
- `20261013012000_buddy_privacy_setting_grant.sql`
- `20261014090000_account_erasure_lifecycle.sql`
- `20261014091000_professional_account_erasure.sql`
- `20261014092000_category_retention_controls.sql`
- `20261017120000_in_app_reminder_delivery.sql`
- `20261018120000_notification_quiet_hours_grants.sql`
- `20261018130000_notification_channel_delivery.sql`
- `20261018131000_push_endpoint_single_owner.sql`
- `20261018140000_journal_draft_images.sql`

## Audit collision and existing local history

The audit SQL was moved unchanged in behavior from `20261018140000_security_professional_http_audit.sql` to `20261018150000_security_professional_http_audit.sql`. The new version is unique in this checkout and the captured cloud ledger. Remote version `20261018140000` remains the authentic `journal_draft_images`; it was not repaired or rewritten.

The original audit SQL had already executed in the existing local database. After verifying Docker named-pipe locality, container labels, database system identifier, exact ledger name/statement digest, absence of the new version, and the applied audit constraint, only that **local ledger version** was changed to `20261018150000`. Its name/statements and audit-row count stayed unchanged; no audit DDL was rerun. The old version is now available for authentic journal history. Do not undo or replay the audit merely to repair numbering.

The 14 recovered historical migrations were **not** automatically applied to the existing development database. Its seven accounts, two organizations, five memberships and four credentials remain intact. Its fixture migration guard can now report the newly restored historical dependencies as pending. Review and synchronize that local history only after the compatibility blocker is resolved; do not reset or fabricate ledger entries.

## Exact ordered cloud manifest

[professional-cloud-manifest.json](professional-cloud-manifest.json) contains the 72-entry applied baseline and the exact 18-entry pending rollout, with file hashes. Historical files are baseline evidence, not migrations to rerun remotely. Pending order:

| Order | File |
| --- | --- |
| 1 | `20261012160000_professional_credential_reviews.sql` |
| 2 | `20261014100000_professional_owner_request_actions.sql` |
| 3 | `20261014110000_professional_claim_lifecycle.sql` |
| 4 | `20261014120000_professional_dashboard.sql` |
| 5 | `20261015100000_professional_case_snapshot.sql` |
| 6 | `20261015110000_professional_consent.sql` |
| 7 | `20261015120000_professional_notes.sql` |
| 8 | `20261015130000_professional_case_handover.sql` |
| 9 | `20261016100000_professional_appointment_lifecycle.sql` |
| 10 | `20261016110000_professional_scheduling_constraints.sql` |
| 11 | `20261016120000_professional_follow_ups.sql` |
| 12 | `20261016130000_professional_referral_lifecycle.sql` |
| 13 | `20261016140000_professional_notifications.sql` |
| 14 | `20261016150000_professional_events.sql` |
| 15 | `20261016160000_professional_query_indexes.sql` |
| 16 | `20261017100000_professional_event_health.sql` |
| 17 | `20261018150000_security_professional_http_audit.sql` |
| 18 | `20261019090000_professional_withdrawal_compatibility.sql` |

The 16 pending professional migrations predate newer applied cloud history; a future approved release must account for that ordering explicitly. Never revert or mark the existing cloud entries applied/reverted to silence a CLI warning. Do not run an unreviewed push from this working tree.

## Local checks and confirmed release blocker

The local-only checker creates a **separate PostgreSQL 17.6 container**, with network disabled and no published ports. It copies platform schema definitions only (no account/session/user data), recreates application hooks/policies from authentic history, and exercises:

1. The exact 72 recorded cloud migrations, then the 17 pending release migrations: **89 SQL migrations applied successfully**.
2. All 89 repository migrations in timestamp order: **89 applied successfully**.
3. Post-rollout professional preflight: zero tables without RLS, zero anonymous/authenticated schema/table/function privileges, valid appointment exclusion, and expected snapshot/follow-up/event functions present.
4. Existing User Side `create_request_v2(..., professional-request-v2, ...)` followed by `withdraw_request`, using a fictional owner inside a rolled-back transaction: **PASS before rollout; FAIL after rollout with INVALID_CASE_TRANSITION**. Fresh chronological replay shows the same failure.

Cause: the authentic User Side RPC sets `status='withdrawn'`. The pending `enforce_request_transition()` definitions in `20261014110000_professional_claim_lifecycle.sql` and `20261015130000_professional_case_handover.sql` do not allow that transition. SQL dependency checks alone would miss this regression. The fixture/probe and blocked manifest preserve it as an acceptance gate; existing runtime sources and authentic historical SQL were not rewritten to conceal it. A separately reviewed compatibility correction must preserve owner withdrawal, consent revocation, appointment handling and authorization before deployment can be approved.

Run local checks from the repository root:

`node --import tsx backend/scripts/professional-release-check.mts`

The checker intentionally exits nonzero while the workflow gate fails. It requires the ignored verified history export, checks all manifest hashes first, leaves existing fixture data unchanged, and stops its own isolated container while retaining it for inspection. Evidence is in `backend/tmp/professional-release/validation.json`; final rehearsal container: `echo_release_validation_d122e3e4`. This is real local SQL testing, not live cloud workflow testing or cloud concurrency acceptance.

## Remaining approval gates

The [final blocker verification](professional-cloud-final-blockers.md) records passing withdrawal regression/denial checks, Storage byte recovery, current AES key recovery and an unchanged 72-entry cloud history. The manifest now has 18 pending migrations (90 total), with refreshed hashes. Obtain owner approval for the exact manifest, credential-demotion impact and maintenance window; retain backups/private keys, confirm service configuration, and refresh the backup/ledger at cutover if necessary. Full application failover and independent off-device key escrow were not tested. Prior local/browser success against the earlier local schema does not prove compatibility with these newly recovered User Side migrations. No deployment commands were executed by this task.

## Exact files changed by this preparation

- `supabase/migrations/20261011100000_user_professional_support_workspace.sql`
- `supabase/migrations/20261012090000_calendar_items.sql`
- `supabase/migrations/20261012091000_buddy_conversation_pins.sql`
- `supabase/migrations/20261013010000_buddy_history_controls.sql`
- `supabase/migrations/20261013011000_buddy_search_legacy_owners.sql`
- `supabase/migrations/20261013012000_buddy_privacy_setting_grant.sql`
- `supabase/migrations/20261014090000_account_erasure_lifecycle.sql`
- `supabase/migrations/20261014091000_professional_account_erasure.sql`
- `supabase/migrations/20261014092000_category_retention_controls.sql`
- `supabase/migrations/20261017120000_in_app_reminder_delivery.sql`
- `supabase/migrations/20261018120000_notification_quiet_hours_grants.sql`
- `supabase/migrations/20261018130000_notification_channel_delivery.sql`
- `supabase/migrations/20261018131000_push_endpoint_single_owner.sql`
- `supabase/migrations/20261018140000_journal_draft_images.sql`
- `supabase/migrations/20261018150000_security_professional_http_audit.sql`
- `backend/scripts/professional-release-check.mts`
- `backend/tests/fixtures/professional-cloud-owner-compatibility.sql`
- `backend/tests/security/professional-http-audit.database.test.ts`
- `backend/tests/security/professional-release-manifest.test.ts`
- `docs/releases/professional-cloud-manifest.json`
- `docs/releases/professional-cloud-release.md`
- `docs/architecture/professional-backend-release.md`
- `docs/progress/professional-backend-handoff.md`
- `docs/testing/professional-local-fixtures.md`

The audit file replaces the old `supabase/migrations/20261018140000_security_professional_http_audit.sql`; the authentic journal migration now owns that timestamp. Ignored local evidence files are `backend/tmp/professional-release/remote-history.json` and `backend/tmp/professional-release/validation.json`. No environment or application runtime files were changed.

Targeted audit/manifest regression checks passed **3 tests**. Standalone validator TypeScript and targeted ESLint passed. Tracked and all scoped new-file whitespace checks passed. That historical SQL workflow gate failed before correction. The final 19 October replay passes both 90-migration paths and withdrawal/denial probes; see the linked current evidence.
