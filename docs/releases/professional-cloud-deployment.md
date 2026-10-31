# Approved cloud migration execution — 19 October 2026

**CLOUD MIGRATION: BLOCKED before dry run. No migrations applied.** Owner approval covers the 18 reviewed SQL migrations only, not credential renewal, Auth/configuration changes or application deployment. Existing approval remains valid; it does not need to be requested again for those same SQL files.

## Confirmed preparation

- Project identity reconfirmed through the Management API: `lruciislmmqvcwweqjop`, ECHO UPDATED THESIS2, `ap-south-1`. Linked project reference and backend project configuration match. Branch remains `feat/professional-portal-sprint-0`.
- Live history still contains exactly the **72 approved baseline versions**; names and recorded-statement digests match. Exactly **18 approved versions remain pending**. All 90 source migration file hashes match the [approved manifest](professional-cloud-manifest.json).
- Secured external database/role/metadata/catalog backup hashes remain unchanged. All 20 saved Storage object hashes and reconstructed restore-file hashes match. Current Storage metadata and all 111 backed-up source table row counts still match the cloud source.
- Key availability reconfirmed at **2026-10-19 05:47:19 UTC**: synthetic version-1 probe passes, all 35 application payloads decrypt in memory, restored TOTP secret fingerprints match, and no required key versions are missing. No keys, plaintexts or TOTP seeds were printed/exported. Prior isolated database restore evidence remains available. Independent off-device escrow/full application failover remain unverified as previously documented.
- Existing read-only SQL preflight passes current RLS/browser-privilege, finite/overlapping appointment and assignment checks. There are zero active or pending clinical memberships in the current source. Proposed RPCs/index constraints remain absent as expected before deployment; these are not post-deployment results.
- Reconciled release workdir prepared at ignored `backend/tmp/professional-release/approved-release-20261019`, containing exactly 90 hash-matching SQL files: 72 authentic baseline plus 18 approved pending. Includes uniquely versioned audit `20261018150000` and final withdrawal correction `20261019090000`. Seeds disabled; no seed or role deployment files.
- Official Supabase CLI **2.121.0** downloaded to ignored local tooling and verified against its official release asset SHA-256 (`2606459be86e12e03fb6f6b9aa12a02aa00cfe21374857ec837a09c70b837eca`). Only `--version` and `db push --help` were executed; **no CLI database connection was initiated**.

## Exact blocker and resume boundary

The saved temporary database backup login is **expired**. No valid existing database password was found in configured project environment files, standard inherited/persistent database environment variables or the checked Supabase database credential targets. Management API and Storage credentials still work for read-only checks; they are not the existing PostgreSQL password needed for this credential-preserving CLI execution path.

Automatic temporary CLI database-login provisioning/renewal would change credentials, outside this task's explicit approval. It was not attempted. No password reset, role renewal, migration repair, history write or alternative SQL deployment was performed. **Dry-run result is NOT RUN, not MATCH or MISMATCH.** The expected 18-version plan is known from the live ledger comparison, but it is not a substitute for the required CLI dry run.

Resume once the **existing** project database password is available privately through an appropriate local environment/credential mechanism. Do not paste it in chat or documentation. Reconfirm current project/history/file hashes/recovery availability, then use the prepared workdir and supported CLI procedure:

```powershell
# Supply the existing database password privately, never as a literal argument.
# Run from the repository root with the verified CLI and release workdir.
& backend/tmp/professional-release/tooling/supabase.exe db push --linked --include-all --skip-vault --dry-run --workdir backend/tmp/professional-release/approved-release-20261019
```

Compare the actual dry-run migration filenames/versions exactly with the 18 `applyInOrder` entries. Stop on any drift, unexpected history replay, Vault/role/seed action or connection problem. `--include-all` is needed for approved versions older than the newest recorded baseline; it is not permission to force/repair history. `--skip-vault` is necessary because this CLI version otherwise synchronizes configured Vault secrets before migrations. No `--include-roles` or `--include-seed` is permitted. See [Supabase's CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push).

Only after an exact successful dry-run match, recheck the gates and apply the identical plan with `--dry-run` removed and explicit confirmation (`--yes`), retaining all other scope restrictions. Capture execution without exposing secrets; stop on the first failure, inspect the read-only ledger and never automatically retry a partially applied release. Do not use the expired backup login or initialize a replacement as a workaround under this approval.

## Results and outstanding verification

- Migrations applied: **0**; cloud ledger remains at 72 versions, with all 18 approved migrations pending.
- Post-deployment schema/RPC/index/grant/credential checks: **not run**, because deployment did not occur.
- Existing User Side: no remote application/data/schema changes were made. The withdrawal compatibility correction remains pending; its prior isolated PostgreSQL tests passed, but no cloud withdrawal mutation was executed.
- Actual frontend/backend cloud application integration: **NOT YET VERIFIED**. No service deployment or application cutover occurred.
- This pass: **2 focused manifest tests passed**, all 90 copied SQL hashes verified, retained backup/Storage hashes verified, 111 source table counts matched and key recovery reverified. Tracked/scoped documentation whitespace checks passed.
- Private non-secret execution receipts are ignored under `backend/tmp/professional-release/`: `deployment-preflight.json`, `deployment-workdir.json`, `deployment-health-before.json`, `deployment-execution.json`. Backup contents and recovery credentials remain outside Git.

Only this deployment report and checkpoint links in the release guide, cloud release report and handoff were edited as repository deliverables. Existing application source, migration SQL, approved manifest, environment files, fixtures, theme and User Side are unchanged. No commits, Git pushes, merges, branch changes, resets, remote credential/configuration changes or Scrum updates.
