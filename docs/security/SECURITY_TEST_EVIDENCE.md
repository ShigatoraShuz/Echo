# Security test evidence

Latest review: 2026-09-21. Local worktree only; no remote migrations, deploy, legacy access or independent review. These are checkpoints, not final completion evidence.

| Historical command / checkpoint | Observed result | Scope / limitation |
| --- | --- | --- |
| npm test (2026-09-17, before latest MFA/settings refinements) | PASS: frontend 361 tests/79 files; backend 207 tests/39 files | Full regression snapshot; rerun required after later edits |
| npm run build (2026-09-17) | PASS: contracts, Next 16.3.5, backend | Before reviewer MFA UI; rerun required |
| npm run typecheck (after scoped settings/redaction) | PASS frontend/backend | Before reviewer MFA |
| npm run typecheck -w frontend (2026-09-18) | PASS | Includes reviewer MFA |
| npm run test:sql:isolated -- --catalog | PASS: 7 suites | journal-analysis-security, journal-analysis-transactions, security-baseline, security-notification-isolation, security-settings-isolation, wellness-draft-receipt, wellness-security-and-lifecycle |
| npm run check:auth-policy | PASS | Static password-policy alignment |
| node scripts/security-scan.mjs --bundle | PASS: 1024 tracked/untracked paths; 0 findings | Pattern scan, not proof of no historical secrets; later additions require rerun |
| Reviewer admin-login-view tests | PASS: 7 | Existing sign-in and MFA invalid-code retry |
| reviewer-mfa.test.ts | PASS: 5 | SDK enrollment/assurance contracts mocked |
| redaction.test.ts + settings.service.password.test.ts | PASS: 4 | Metadata redaction and password/session changes |
| npm audit following Vitest 4.1.11 install | 0 vulnerabilities at that checkpoint | Lockfile updates; final audit rerun pending |
| npm run lint earlier checkpoint | PASS with 66 frontend / 27 backend warnings | Later changes require rerun; warnings not waived |
| git diff --check | Pending final run | Must pass before handoff |

Resolved validation failures: scanner originally attempted to open an intentionally deleted tracked file; it now skips ENOENT while failing other I/O errors. New settings fixture initially omitted the required contact channel; synthetic fixture corrected and all SQL suites passed. MFA UI test originally matched the label exactly despite its required-field marker; accessible regex matcher corrected, all 7 tests passed. These failures were not ignored.

Warnings observed: jsdom reports navigation to another Document is not implemented in the full frontend suite; Vite module configuration warning and existing lint warnings require final recording. npm dependency install reported deprecated node-domexception. No warnings were hidden by disabling tests or policy rules.

Unavailable/unperformed: deployed Auth MFA/session/cookie/CSP tests; live PostgREST/storage probes; scanner/KMS activation; DAST/penetration test; provider privacy contract review; durable monitoring/alerts; GitHub protections; real restore/tabletop/key-rotation drills. Production release is blocked.

## 2026-09-20 validation checkpoint

| Command | Observed result | Limitations |
| --- | --- | --- |
| npm run typecheck | PASS frontend/backend | Includes account export integration |
| npm test | PASS frontend 369 tests/80 files; backend 260 tests/46 files | Synthetic/mocked integration; jsdom navigation warning remains |
| npm run lint | PASS, 66 frontend / 29 backend warnings, zero errors | Existing warning debt and structured console warnings retained |
| npm run build | PASS contracts, frontend Next 16.3.5, backend | No deployment; original next-env.d.ts dev-type imports restored after build |
| npm run test:sql:isolated -- --catalog | PASS 14 suites; catalog written | Synthetic PGlite; not live Supabase |
| npm run check:auth-policy | PASS | Static policy alignment |
| node --test scripts/security-project-target.test.mjs | PASS 1 test | Exact target URL guard, no remote connection |
| node scripts/security-query-boundaries.mjs | 131 queries, zero findings | Source AST boundary check |
| npm audit --audit-level=high | Zero vulnerabilities | Dependency registry checkpoint, no independent code review |

Export targeted evidence: 6 service tests plus settings delivery tests verify encryption, owner/request binding, bytea decoding, tamper rejection, private paths, storage failures, fresh authentication and no-store attachment response. SQL verifies owner snapshot, atomic completion/audit, plaintext artifact rejection, foreign-ID denial, single use and expiry. Image validation uses real sharp decoders for supported formats, malformed/truncated inputs, MIME mismatch, EXIF stripping, pixel/frame limits and upload-before-storage rejection. All 10 image/avatar tests passed.

Resolved failures at this checkpoint: synthetic animation initially collapsed identical frames; fixture now uses distinct frame colors. Contact SQL test delimiter was corrected. Grounding and consent fixtures now supply required duration/timestamp. Export replay first showed missing historical-table permissions; the snapshot is now a fixed-schema, service-only definer, with no reopening of legacy table grants. Export concurrency testing then detected timezone conversion in legacy timestamp defaults; new requests explicitly use timestamptz now(). Every corrected suite was rerun successfully.

Late hardening adds a shared two-operation cap to generation/download and index support for expiry/admission; affected checks are recorded after their rerun. No actual user data was exported or deleted, and no production/legacy project was contacted.

## 2026-09-21 validation checkpoint

| Command | Observed result | Scope / limitations |
| --- | --- | --- |
| npm run typecheck | PASS frontend/backend | Includes encrypted PHQ-8, migration helper, private session boundary and atomic deletion-request integration |
| npm test | PASS frontend 376 tests/81 files; backend 276 tests/48 files | Synthetic/mocked regressions; jsdom emits navigation-to-another-Document warnings |
| npm run lint | PASS, zero errors; 66 frontend and 30 backend warnings | Warnings retained, not waived or suppressed |
| npm run build | PASS contracts, frontend Next 16.3.5, backend | User's original next-env.d.ts dev-type import restored after build; no deployment |
| npm run test:sql:isolated -- --catalog | PASS 18 SQL suites | 87 application tables, 62 functions, 207 application policies; synthetic Auth/Storage scaffolding only |
| npm run check:auth-policy | PASS | Static password-policy alignment |
| node --test scripts/security-project-target.test.mjs | PASS 1 test | Exact authorized HTTPS origin; no remote connection |
| node scripts/security-query-boundaries.mjs | PASS 128 queries / 0 findings | Explicit schema AST check |
| npm audit --audit-level=high | PASS, 0 vulnerabilities | Current dependency registry result, not independent code review |
| node scripts/security-scan.mjs --bundle | PASS 1080 tracked/untracked paths / 0 findings | Source and built bundle pattern checks; not proof of no historical secret |
| git diff --check | PASS | Git reports LF-to-CRLF conversion warnings; no whitespace errors |

Targeted checks: 16 PHQ-8 encryption/migration tests passed (7 save/read-integrity and 9 historical migration/rotation). Eight browser sensitive-state/boundary tests passed. SQL verifies active-session/account restrictions on direct data paths, actual service-role PHQ-8 saves, stale/wrong-owner migration rejection, plaintext removal, and deletion-request/audit rollback. Test suites do not delete a real account.

Resolved failures: AI daily admission exposed a legacy timestamp-without-timezone default that shifted rows across UTC days; the fix uses now() and server-owned admission times, tested under opposite session timezones and caller backdating. The first added SQL test had a dollar-quoting typo, corrected before the suite passed. A runtime-role migration test exposed an obsolete plaintext phq8_severity constraint permission; the encrypted schema now drops that constraint and the test covers service-role saves and compare-and-swap updates. No failing check was skipped to produce these results.

The prior automatic approval-review usage-limit block was cleared on this continuation; the same checks were retried normally. All checks above ran successfully. No backfill CLI, remote migration, real account export/deletion, live provider request, key rotation, commit, push or deployment ran. Full implementation and production release remain blocked by the engineering gaps and external actions in SECURITY_IMPLEMENTATION_STATUS.md and SECURITY_IMPLEMENTATION_HANDOFF.md.
