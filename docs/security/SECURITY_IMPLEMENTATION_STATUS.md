# Security implementation status

Review date: 2026-09-21. Authoritative baseline: `SECURITY_REQUIREMENTS.md`.

Production release is blocked. Historical reports are not evidence that the current application meets this baseline. No risk acceptance or independent review is recorded.

## Initial worktree

- Branch: `feat/wine-app-updates`.
- Existing user change: `frontend/next-env.d.ts` uses `.next/dev/types` instead of `.next/types`; preserve it.
- No commit, push, deployment, remote reset, credential rotation, or legacy-project contact is authorized or performed.
- Local root/backend/frontend URL configuration matches the new project recorded in the architecture status (`lruc…qjop`); no CLI link metadata exists. This proves local configuration only, not remote environment classification or deployed controls.

## Initial gate ledger (historical checkpoint; latest continuation below)

| Gate | Status | Evidence / remaining work |
| --- | --- | --- |
| S0 | Implemented | Local baseline: THREAT_MODEL.md, ENDPOINT_SECURITY_MATRIX.md (80 registrations), ENVIRONMENT_AND_PROVIDER_INVENTORY.md. Existing isolated SQL suite: 4 PASS. Human threat-model review and remote inventory remain blocked; no remote access. |
| S1 | Implemented | Project guard test PASS; 3 local URL configurations match; source scan 992 tracked paths / 0 findings. scripts/security-project-target*, security-scan.mjs, security-migrate.mjs. No remote operation. Full-history/bundle scans and deployed isolation unverified. |
| S2 | In Progress | Migration 20260917010000_security_privileges_and_integrity.sql and security-baseline.sql: isolated SQL 5 PASS. Private-schema browser denial preserved; audit update/delete revoked; owner FKs added NOT VALID. Remote validation, existing-row constraint validation, generated types and full catalog report pending. |
| S3 | In Progress | Configured issuer/audience/expiry, remote signature verification, session bridge migration 20260917011000, MFA/recent-auth middleware. 47 targeted tests PASS. Ordinary service-role isolation, deployed auth configuration and browser MFA enrollment pending. |
| S4 | In Progress | Backend typecheck PASS; 198 tests PASS. Exact-origin rejection, explicit proxy configuration, stable rate errors, sensitive-write/onboarding validation, log-path scrubbing and bounded fetch added. Full DTO/range/SSRF coverage and deployed proxy test remain pending. |
| S5 | In Progress | 34 targeted frontend tests PASS; frontend typecheck PASS. Removed unused plaintext draft manager, persistence-callback autosave, legacy cache cleanup and renderer CSP nonce propagation. Production browser/network and bundle evidence pending. |
| S6 | In Progress | Keyring/rotation and tamper tests; new Buddy encrypted envelopes; document MIME/quarantine/scanner evidence checks. Backend 205 tests PASS at this checkpoint. Legacy Buddy backfill, full analysis/read-model encryption, real scanner/KMS and deployed storage tests remain release blockers. |
| S7 | In Progress | Hot-reloaded emergency controls wired to uploads, analysis admission/execution and worker claims; failure-closed tests pass. Existing consent gates reviewed. Export/deletion execution, complete retention automation and provider privacy approval remain incomplete. |
| S8 | In Progress | Structured denial/privileged-workflow audit sink, append-only security_events migration, content-free payload tests. Backend 207 tests PASS. External collector/alerts and transactional audit delivery remain unverified. |
| S9 | In Progress | CI now fails high/critical audits; adds history/source/bundle scanning, policy and isolated SQL checks. Dependency remediation underway. GitHub protections and runner execution remain external. |
| S10 | Not Started | Integrated checks and independent review pending. |
| S11 | Blocked | Preparation only; production deployment is prohibited by the task. |

## Initial baseline findings (historical; subsequent fixes recorded below)

- Every main service receives the administrative Supabase client, bypassing RLS during ordinary requests.
- Buddy messages currently persist `content` in plaintext despite older documentation claiming encryption.
- Encryption decrypts using one key and does not validate the payload key version.
- JWT middleware embeds a project issuer literal; privileged MFA and recent-auth are absent from route wiring.
- API CORS config controls response headers but does not reject hostile origins; proxy trust is unspecified.
- Export/deletion routes currently enqueue requests; this does not prove execution across all data stores.
- Verification reviewer access signs documents without a malware-scanning gate.

Each gate update must name changed files, migrations, commands/results, reproducible evidence and residual risks. `Verified` requires observed evidence; operational controls require deployed evidence as well as local tests.

## 2026-09-18 continuation

[Complete requirement matrix](SECURITY_REQUIREMENT_STATUS_MATRIX.md) maps all 83 IDs, owners, implementation, evidence, risks and approval state. [Test evidence](SECURITY_TEST_EVIDENCE.md) distinguishes checkpoints from final validation. No production-ready claim.

- S2/S3: migration 20260917015000_settings_user_scoping.sql adds minimal owner settings grants and read-only export/deletion history; 7 isolated SQL suites PASS. Notifications and ordinary settings now use verified JWT clients. Other service-role usage remains incomplete.
- S3: reviewer TOTP enrollment/challenge UI and SDK contract tests: 12 tests PASS; frontend typecheck PASS. Provider MFA activation still unverified.
- S4: structured redaction tests PASS; explicit schema audit covers 136 queries with zero findings. Historical backfill/query schema access made explicit.
- S5: source/static bundle scan passed at 1024 paths, zero findings; recent additions require final rerun. User intro changes preserved.
- S9: dependency install audit reports zero vulnerabilities; CI query guard added. No GitHub settings changed.
- S10: full regression checkpoint frontend361/backend207 and build PASS before recent edits. Final comprehensive rerun pending; independent review blocked externally.
- Documentation: data classification/retention, role/permission ownership, table/function inventory, encryption/rotation, test plan/evidence and incident/backup runbooks added. Proposed policies require approval and incomplete workers are explicitly recorded.

Additional user-owned changes preserved: frontend/public/intro-init.js, frontend/src/shared/components/branding/echo-app-intro.tsx, frontend/src/shared/components/branding/echo-intro-gate.tsx.

## 2026-09-20 continuation

Production remains blocked; no approval/accepted risk or independent verification is recorded. This checkpoint adds 15 forward-only security migrations in total (20260917/18/20), none applied remotely.

- S2/S3: legacy public grants locked down; owner/composite FKs strengthened; journal and experience read scopes introduced; contact writes moved to an invoker transaction deriving ownership from auth.uid(). Ordinary settings/notifications plus journal content/drafts, Buddy history, dashboard and account-status reads now use verified JWT clients. Administrative writes and remaining wellness/analysis/verification paths still require review.
- S4: pinned, allowlisted outbound JSON transport and 24 SSRF tests; resource-limited real image decoding; validated reminder clock values; 131 explicitly qualified source queries, zero findings.
- S6: new detailed AI result payloads use AES-GCM envelopes; weekly persistent aggregates no longer replicate distributions. Safety severity and other Restricted fields/historical records remain plaintext gaps. Image uploads are decoded/re-encoded and lose EXIF/GPS metadata. Verification remains quarantined without a real scanner.
- S7: database-enforced analysis budgets added. Account exports now snapshot 62 owner/parent-owned collections, decrypt only in process memory, include bounded clean attachments, encrypt temporary artifacts, expire after 24 hours and require a recent-authenticated single-use download. Export lifecycle/audit transitions are transactional. Existing PDF generation has its own recent-authentication/audit gate. Complete account deletion, large-account export delivery and provider lifecycle remain unfinished.
- S9/S10: npm test PASS (frontend 369/80 files; backend 260/46); full typecheck PASS; 14 isolated SQL suites PASS; lint PASS with 66 frontend/29 backend warnings; npm audit zero vulnerabilities; auth-policy and target guard PASS. Build/bundle/diff checkpoint recorded separately in SECURITY_TEST_EVIDENCE.md.
- Catalog: 87 tables/views and 57 functions; includes column, schema and default grants. This is synthetic PostgreSQL evidence, not a deployed Supabase snapshot. Generated Supabase types remain incomplete.

No live account/data was exported, deleted or backfilled. No live provider was invoked. No commit, push, production deployment, live rotation or legacy project contact occurred.

## 2026-09-21 continuation

20 forward-only security migrations are now prepared locally, none applied remotely. The catalog reports 87 tables, 62 functions and 207 application-table policies; 18 isolated SQL suites pass.

- S3/S5: disabled-account sessions fail closed in the backend. Restrictive live-session/account policies cover all application tables and Storage. Protected/onboarding UI boundaries hide and unmount private pages on account changes, session invalidation and restored browser snapshots; full document navigation clears router/module state. SDK component tests are not deployed browser evidence.
- S6: new PHQ-8 answers, scores and severity are encrypted with owner/submission binding and scoring validation. A local-only dry-run backfill/rotation helper uses compare-and-swap and reports corrupt records/conflicts without printing data. An obsolete SQL score constraint was removed after a real service-role test exposed a permission failure. Historical backfill is still a deployment prerequisite.
- S7: analysis daily quotas now use timezone-independent server-owned admission timestamps, with opposite-timezone and backdating regressions. Deletion request/cancel transitions and audit events are atomic; full account erasure remains unfinished.
- S10: full check results for this continuation are recorded in SECURITY_TEST_EVIDENCE.md. No independent verification or accepted risk is recorded.

Local engineering still required: complete erasure/retention worker and all-store tests; historical analysis migration/rotation; remaining Restricted metadata encryption; remaining administrative-client separation; generated database types and full browser/two-user endpoint coverage. External release gates include policy approval, live Supabase/Storage/Auth evidence, scanner/KMS, provider privacy/deletion integration, monitoring, backup/restore and independent review.
