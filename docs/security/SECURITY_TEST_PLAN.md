# Security validation plan

Review: 2026-09-18. Synthetic data only. Never run against the legacy project.

| Area | Automated evidence | Remaining required validation |
| --- | --- | --- |
| Auth/session | session-verifier.test.ts; missing/malformed/wrong issuer/audience/expired/revoked mocks; MFA/recent-auth routes | Live signature, recovery, logout/refresh/revocation and provider rate limits |
| Ownership / roles | Existing IDOR/mass-assignment tests; security-settings-isolation.sql; security-notification-isolation.sql; journal/wellness SQL | Every protected CRUD endpoint with two real synthetic accounts; stored-file isolation |
| Database | Isolated complete migration replay, security-baseline.sql, DATABASE_CATALOG.json | Real Supabase PostgREST/Storage probes, applied-history comparison, validate NOT VALID constraints, generated types |
| Crypto | encryption.service.test.ts, storage-encryption.test.ts | Database ciphertext inventory including analysis/projections, production rotation and restoration |
| API | api-hardening.test.ts, uuid-validation.test.ts, mass-assignment.test.ts | All DTO/range boundaries; comprehensive SSRF DNS/redirect tests; deployed proxy behavior |
| Browser | proxy.test.ts; clear-sensitive-state tests; reviewer login MFA tests; bundle scan | Real Google/OTP sign-in, CSP reports, logout/account-switch storage/caches and visual regression |
| Files | MIME/size/quarantine/scanner contract tests | Real scanner integration, signed URL expiry and storage deletion drill |
| AI/privacy | Existing journal/wellness transaction/consent tests; runtime-audit.test.ts | Provider adversarial/cost tests, export/deletion/retention end-to-end |
| Observability | runtime-audit.test.ts; redaction.test.ts | Durable audit delivery, collector routing and triggered alerts |
| Supply chain | npm audit, source/bundle scans, CI workflow | Git history scanner execution and GitHub branch/environment protections |
| Recovery | Versioned key unit tests and runbooks | Actual restore, tabletop, credential/session/provider shutdown drills |

Minimum final commands: npm run typecheck; npm run lint; npm test; npm run build; npm run test:sql:isolated -- --catalog; npm run check:auth-policy; node --test scripts/security-project-target.test.mjs; node scripts/security-project-target.mjs; node scripts/security-scan.mjs --bundle; npm audit; git diff --check.

PGlite replays PostgreSQL migrations with synthetic Auth/Storage scaffolding. It does not exercise PostgREST, GoTrue, Storage APIs or deployed configuration. Mocked SDK verification tests do not prove the remote identity provider. Never describe these as a penetration test.

Before staging DAST, verify exact project and test-only accounts; use an approved low-rate scope and stop on real data. Independent ASVS 5.0 Level 2 mapping and penetration review must name reviewer, date, version, findings and retest receipts. None has occurred here.
