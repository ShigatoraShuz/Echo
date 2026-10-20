# Cloud database backup verification — 19 October 2026

**Database restore VERIFIED; subsequent Storage/key/withdrawal checks passed. Owner approval is still required.** Target identity was verified through the Management API before backup connections: `lruciislmmqvcwweqjop`, ECHO UPDATED THESIS2, `ap-south-1`.

## Backup evidence

Private destination, outside Git:

`C:\Users\My PC\EchoBackups\lruciislmmqvcwweqjop_2026-10-18T15-49-21-953Z`

The directory has restricted Windows ACLs for the current user and SYSTEM. Backup connection material is separately protected with Windows CurrentUser DPAPI; it is not a portable recovery secret. Never copy database contents or that credential file into the repository.

| File | Bytes | Written (UTC) | SHA-256 |
| --- | ---: | --- | --- |
| `database.dump` | 1,444,178 | 2026-10-18 15:54:40 | `87fb62d7b14722ab470f464dc0ac53bc1b78e28775ff01002c4252a3e7c8ee94` |
| `roles.sql` | 8,998 | 2026-10-18 15:54:46 | `75019ba3718c78cbeb5fb6ec351c5cab48b45e45d28ef8a338e1f53196d53945` |
| `source-metadata.json` | 94,130 | 2026-10-18 15:57:14 | `7f99e874adcb4140a2b25df3d5d87f36579d6dc9579b547a23d1bca8958638c7` |

The same directory contains the readable archive catalog, project verification record and `verification.json` with file sizes, timestamps, hashes and restore results. PostgreSQL 17.6 tools produced a custom-format dump of the entire database, including Auth, Storage metadata, migration history and application schemas/data. No schema/table filters or RLS-filtered export were used. Global roles/memberships were exported separately with `--no-role-passwords`; database owner, encoding, locale and ACLs were captured as metadata.

The backup API reported WAL-G enabled, PITR disabled and no downloadable backup entries. A direct logical backup was used; no backup-plan upgrade, restore API or project configuration change was requested. Connections used TLS `verify-full` and the Supabase CA. Explicit read-only transactions were used for source checks; pg_dump uses its own read-only transaction. Supavisor did not honor startup `PGOPTIONS`, so that setting was not treated as protection.

## Actual isolated restore

`backend/scripts/professional-cloud-backup.mts --restore-only` restored the saved archive without making any remote connection. Final verification: **2026-10-18 16:03:53 UTC**.

- New disposable PostgreSQL 17.6 container: `echo_cloud_restore_f6a7487e`; network `none`, no published ports, backup mount read-only. It was stopped after validation and retained for inspection.
- Restored role attributes/memberships, database metadata, schemas, objects, data, grants and policies. Existing image role creation statements were skipped, while their archived attributes and grants were retained.
- Managed schema owners lack some database CREATE permissions. The harness bootstraps archived schemas and their exact ACLs first, restores ordinary objects as the local superuser with archived ownership, then restores event triggers under their original owners. No extra application grants or relaxed RLS were introduced. A plain one-command restore was insufficient.
- Matched **111 tables and RLS flags, 168 complete policy definitions, 111 exact table row counts, and all 72 migration ledger names/versions**. Policy deparsing used the same search path to avoid false differences from schema qualification.
- Existing Echo local fixtures remained **7 Auth accounts, 2 organizations, 5 memberships, 4 credentials**. No local Echo reset, migration replay or fixture deletion.
- Targeted ESLint and standalone script TypeScript checks passed; migration-manifest/audit regressions: **3 tests passed**. Earlier schema-order rehearsal evidence remains in the [release report](professional-cloud-release.md); it was not repeated because migration SQL did not change.

To repeat the isolated verification on this machine, retain the ignored path pointer `backend/tmp/professional-release/backup-location.txt` and run from the repository root:

```powershell
node --import tsx backend/scripts/professional-cloud-backup.mts --restore-only
```

Each run creates a fresh network-isolated container and stops only that container. It never restores into the existing Echo database. The default mode connects to the verified cloud pooler using separately provisioned temporary backup credentials; do not invoke it as a deployment command.

## Recovery prerequisites and limitations

**19 October completion:** see [final blocker verification](professional-cloud-final-blockers.md). Storage objects and current application key recovery are now verified, and the additive withdrawal correction passes both PostgreSQL release paths. The original database backup timestamps/hashes above remain unchanged.

- **Storage object bytes are not in pg_dump.** The separate secured `storage/` export now contains all 20 objects in 3 buckets (439,795 bytes), full metadata and checksum/path manifest. All 20 ETag checks and separate private filesystem restores passed. Live Supabase re-upload was not performed; no remote object was mutated.
- Retain the current and historical application AES-256-GCM key versions through existing secret management (`backend/src/infrastructure/encryption/encryption.service.ts`). Ciphertext restoration does not prove decryption without those keys. Current key availability and in-memory decryption of all 35 detected payloads are now verified; no keys/plaintexts were exported. Independent off-device key escrow was not verified. Preserve any required managed Vault/platform encryption recovery material separately; the database dump cannot prove recovery of external keys.
- Role login passwords are intentionally absent. Restore operators must re-establish service credentials and preserve/reconfigure Auth signing/encryption material, OAuth/provider settings, redirect URLs, exposed schemas and service configuration through an owner-approved recovery process. None were changed or exported into Git. Restoring the database alone does not start the complete Supabase application stack or prove old sessions remain valid.
- This is a verified database backup at the recorded timestamp, not PITR coverage or a tested full application failover. Refresh/reverify the backup and ledger before an approved deployment if cloud data/history changes.
- The additive `20261019090000_professional_withdrawal_compatibility.sql` fixes the reproduced User Side withdrawal regression without rewriting history. The [ordered manifest](professional-cloud-manifest.json) now contains 18 pending migrations and passes both 90-migration PostgreSQL replays. Credential migration membership demotion and owner-controlled configuration/maintenance approval still apply.

No remote migrations, history repairs, resets, application/schema writes, Auth/settings changes or deployment occurred. The only remote write was **strictly necessary temporary CLI backup-login metadata**, explicitly allowed by this task: a read-only login proved insufficient for a complete migration-history backup, so a temporary owner backup login was used only for read-only backup operations. No remote application permissions, RLS or MFA were weakened. No commits, pushes, branch changes or Scrum updates; User Side and Echo theme are unchanged.
