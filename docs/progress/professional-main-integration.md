# Professional / User Side integration — 20 October 2026

Destination: `feat/professional-portal-sprint-0` at `eea5549aac0fa72930560268ccd135d6d133676f`; source: `origin/main` at `2915b980e6e03c96f59f687c9ad4de8583a21067`. This is a merge into the feature branch, not a deployment or a merge to main.

## Integration decisions

- Twelve historical migration conflicts have identical non-empty lines. Retained the exact Professional-branch Git blobs, without rewriting SQL behavior or replaying history. Main adds no other migration dependency missing from the reconciled baseline.
- Combined ten code/config conflicts. Kept the guarded Professional shell, dashboard, case notes, queue, role-aware Calendar and mobile navigation; integrated User Side discovery, v2 request/PHQ-8 sharing, case messages and scheduling endpoints.
- Legacy journal-only requests retain explicit v1 consent. The strict v2 contract requires a submission ID for assessment sharing. Original assessment records remain owner-scoped; Professional responses contain only user-selected snapshots. Owner detail reads never query clinical notes.
- Added `20261020103920_professional_shared_case_snapshot.sql` as an **unapplied integration proposal**, after the existing workspace, snapshot, note and lifecycle migrations. The existing audited transaction retains assignment, clinical-role, credential, organization, profile and service-role checks. It projects unexpired/unrevoked grants and appointment change requests, prevents a revoked modern journal from reappearing through legacy storage, and leaves browser grants denied. The backend rechecks grant identity and current assignment before decryption.
- Coordinator/admin assignment uses same-organization directory metadata and the existing assignment endpoint. It does not grant clinical reads. Already-assigned requests must use the established authorized transfer workflow; initial assignment cannot be used to bypass it. The additive SQL repeats that restriction under the request lock and requires an available, currently approved clinician.
- Messages remain participant-scoped, with MFA on Professional routes, permission rechecks and idempotent submission validation. Professional UI clears messages with its protected case on access loss or context changes.
- Preserved Lloyd's mobile and guarded staging QA alongside Professional mocked browser journeys. Default Playwright discovery includes both local suites; each is also separately runnable. Updated dependencies/lockfile without running package lifecycle scripts or changing authentication settings.
- Fixed dialog focus-trap attachment after the shared dialog's deferred mount. Visual design, theme tokens and fonts were not changed by this fix.

## Release boundary

The prior 18-version cloud release manifest and its historical evidence remain unchanged. The new integration SQL is not approved for remote application by this merge task and was not applied to local Supabase or any remote database. Isolated PGlite tests execute it against fictional records. Live deployed integration, actual-device acceptance and guarded staging journeys remain separate acceptance steps.

Local uncommitted files were safeguarded in a local stash and byte-preserved under ignored `tmp/main-integration-safeguard/`. Credentials, environment files, recovery material, backups and generated results must remain outside the merge commit.

## Validation

- Backend: **826 tests / 106 files passed** (`vitest run --maxWorkers=4 --testTimeout=15000`). Includes four combined v2/clinical SQL integration tests, late per-record revocation, client note isolation, role/MFA denials, message idempotency and initial-assignment guards. Tests use isolated fictional PGlite databases, not remote Supabase or independent PostgreSQL sessions.
- Frontend: **957 tests / 148 files passed** (`vitest run --maxWorkers=1 --testTimeout=15000`). Initial concurrent runs hit local scheduling timeouts; the complete serial run passed without removing assertions. Focused case/coordination regressions were rerun after final interaction-copy changes.
- Professional browser harness: **41 passed**, including combined consent/message clearing, coordinator assignment, all existing workflows, role-aware Calendar and mobile navigation.
- Actual Next.js public/mobile QA: **92 passed / 4 phone-only tablet skips** across mobile Chrome, mobile WebKit, 320px phones and tablets. These are public frontend journeys, not live authenticated clinical integration.
- Default Playwright discovery includes both local suites (137 cases); staging stays explicitly guarded/opt-in and was not executed without an isolated declared staging deployment.
- Backend/frontend typechecks passed. Targeted frontend lint passed; backend lint has four existing console warnings and no errors. Source secret scan and explicit schema-boundary scan passed with zero findings. Staged whitespace checks passed.
- Public-repository staged-content review found no configured private material, private keys or credential tokens. Flagged examples are synthetic test inputs; public brand assets and environment templates match main. No private environment, fixture state, backup, trace or temporary output is staged.
- Combined dependency versions match main. Installation reported the existing main dependency advisories (8 high, 2 moderate); no audit fix or unrelated dependency upgrade was performed.

Test transports and browser fixtures are fictional; none of these results claims live authenticated cloud or full staging acceptance. No remote database operations, migration application, deployment, merge to main or force push occurred.
