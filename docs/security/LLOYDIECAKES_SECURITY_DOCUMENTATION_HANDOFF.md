# ECHO security documentation handoff for Lloydiecakes

Prepared from the actual final working tree and recorded execution evidence on 2026-09-21. Documentation-only request: no application code, migration, test or configuration is changed by this handoff. No commit, push or message delivery is performed.

The implementation pass is concluded at the user's instruction. That does **not** mean every security requirement is complete. The repository still records unfinished engineering and external release gates. This report does not call ECHO fully secure, production-ready, independently reviewed or compliant.

**Evidence basis:** current Git status/diff, inspected changed/new source and migration files, actual test files, and the recorded final runs in [SECURITY_TEST_EVIDENCE.md](SECURITY_TEST_EVIDENCE.md). The original plan is not treated as proof of implementation. All paths below are repository-relative.

**Status usage:** Implemented means the stated local code/control exists; its exact passing evidence is recorded separately. Partially Implemented identifies an incomplete wider control. Blocked / Manual Action Required denotes external operational preparation without completed deployment. No complete requirement is relabeled Verified based only on a mocked test or documentation. Passed checks prove their stated local scope, not hosted deployment or independent assurance.

**Change provenance:** retained pre-existing mechanisms are explicitly identified, particularly managed Auth/basic login, reviewer membership, parts of headers/no-store, existing consent/job gates, worker leases/idempotency and existing journal/verification encryption.

## 1. FULL IMPLEMENTATION LIST

The 40 requested categories are listed below. Overlapping categories describe shared controls; they are not a count of 40 independent security features.

### Security architecture

**Explicit trust boundaries and authorized-target guard — Implemented**

- **What was implemented:** Recorded backend/browser/Auth/database/Storage/worker boundaries, provider inventory, 83-requirement matrix and explicit schema query scanning. Added exact-origin project guard and a guarded migration dry-run helper. Modular monolith architecture is retained.
- **Why / security improvement:** Prevent wrong-project operations and make privileged boundaries reviewable. The guard refuses non-authorized targets rather than guessing a linked project.
- **Exact files/modules:** `docs/security/THREAT_MODEL.md`; `docs/security/ENVIRONMENT_AND_PROVIDER_INVENTORY.md`; `scripts/security-project-target.mjs`; `scripts/security-migrate.mjs`; `scripts/security-query-boundaries.mjs`.
- **Migration(s):** None for this control.
- **Test/evidence:** Project guard: 1 passing Node test. Query scan: 128 queries, 0 findings. Local configuration inspection recorded 3 matching URLs.
- **Scope / remaining limitation:** Local configuration is not remote environment verification; no remote migration command ran.

### Authentication

**Managed token verification and neutral registration responses — Implemented**

- **What was implemented:** Verifies the exact bearer through Supabase Auth getUser; rejects wrong issuer, audience, role, expiry, future issuance/not-before and invalid session ID. Moves issuer derivation to configured URL. Uses fresh public Auth clients for registration/password verification; duplicate-signup responses are neutral and unexpected provider messages are hidden.
- **Why / security improvement:** Avoid trusting decoded claims or caller roles, prevent shared Auth-session contamination, and reduce account enumeration.
- **Exact files/modules:** `backend/src/infrastructure/supabase/supabase-admin.client.ts`; `backend/src/shared/middleware/auth.middleware.ts`; `backend/src/features/registration/registration.service.ts`; `backend/src/features/settings/settings.service.ts`; `backend/src/server.ts`; `frontend/src/services/authentication/auth.supabase-adapter.ts`.
- **Migration(s):** `20260917011000_security_session_lifecycle.sql`; `20260920016000_disabled_account_sessions.sql`
- **Test/evidence:** backend/tests/security/session-verifier.test.ts; backend/src/features/registration/__tests__/registration.enumeration.test.ts; password and frontend Auth-adapter tests: PASS.
- **Scope / remaining limitation:** Hosted Auth recovery/abuse configuration and live response timing remain unverified. Managed Auth and basic login existed before this pass.

### Session security

**Live revocation/account checks and sensitive-action reauthentication — Implemented**

- **What was implemented:** Adds backend-only session existence/expiry checking and active account status. Reads signed amr authentication times instead of treating refreshed iat as a fresh login. Adds a 10-minute recent-auth gate, privileged aal2 gate and password-change global sign-out with explicit revocation-failure handling.
- **Why / security improvement:** Reject revoked, expired or disabled-account sessions and require recent assurance for high-impact actions.
- **Exact files/modules:** `backend/src/infrastructure/supabase/supabase-admin.client.ts`; `backend/src/shared/middleware/assurance.middleware.ts`; `backend/src/shared/types/authenticated-user.ts`; `backend/src/features/settings/settings.service.ts`; `backend/src/features/settings/settings.routes.ts`; `backend/src/features/verification/verification.routes.ts`.
- **Migration(s):** `20260917011000_security_session_lifecycle.sql`; `20260920016000_disabled_account_sessions.sql`; `20260920017000_session_bound_data_policies.sql`
- **Test/evidence:** session-verifier.test.ts; security-session-lifecycle.sql; security-session-data-access.sql; settings.service.password.test.ts: PASS.
- **Scope / remaining limitation:** Real provider session/recovery/revocation drills are not run. Already-issued signed object URLs remain valid until expiry.

### Authorization

**Verified user-context database access — Partially Implemented**

- **What was implemented:** Propagates the verified access token through AsyncLocalStorage and creates publishable-key clients bound to that token. Server wiring supplies user clients for ordinary settings/notifications and selected journal, Buddy, grounding, consent, dashboard and account/onboarding reads. Missing verified token fails closed in the user-client factory.
- **Why / security improvement:** Allow RLS to enforce owner access during ordinary operations instead of always bypassing it with service_role.
- **Exact files/modules:** `backend/src/shared/request-context.ts`; `backend/src/infrastructure/supabase/supabase-user.client.ts`; `backend/src/server.ts`; `backend/src/features/settings/settings.service.ts`; `backend/src/features/notifications/notifications.service.ts`; `backend/src/features/journals/journals.service.ts`; `backend/src/features/experience/experience.service.ts`; `backend/src/features/access/access.service.ts`; `backend/src/features/onboarding/onboarding.service.ts`.
- **Migration(s):** `20260917013000_notification_user_scoping.sql`; `20260917015000_settings_user_scoping.sql`; `20260920012000_journal_read_scope.sql`; `20260920014000_experience_read_scope.sql`
- **Test/evidence:** Module two-user isolation SQL; existing feature/route tests and full regression: PASS.
- **Scope / remaining limitation:** Other writes, analysis/wellness access and verification still use administrative paths. Some service constructors retain compatibility fallbacks; production wiring supplies the user factory. This is not complete service-role elimination.

### Role-based access control

**Reviewer MFA combined with existing database role checks — Implemented**

- **What was implemented:** Adds recent-auth and aal2 middleware to reviewer routes and TOTP enrollment/challenge UI. Existing backend reviewer-membership checks remain authoritative; browser login alone cannot grant reviewer access.
- **Why / security improvement:** Require both a server-recognized reviewer role and stronger authentication, reducing role spoofing and stolen-session misuse.
- **Exact files/modules:** `backend/src/features/verification/verification.routes.ts`; `backend/src/features/verification/verification.service.ts`; `backend/src/shared/middleware/assurance.middleware.ts`; `frontend/src/services/authentication/reviewer-mfa.ts`; `frontend/src/features/authentication/view/admin-login-view.tsx`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`
- **Test/evidence:** reviewer-mfa.test.ts: 5 PASS; admin-login-view.test.tsx: 7 PASS; session-verifier/verification route tests: PASS.
- **Scope / remaining limitation:** Hosted MFA activation and real reviewer enrollment require operational configuration. The underlying reviewer role system predates this pass.

### Supabase/database security

**Forward-only hardening and reproducible local catalog — Implemented**

- **What was implemented:** Created 20 security migrations and expanded the PGlite harness to inventory schemas, columns, grants, policies, functions, triggers and constraints. Catalog records 87 application tables, 62 functions and 207 application-table policies.
- **Why / security improvement:** Make database controls reviewable and reproducible without modifying a remote environment.
- **Exact files/modules:** `backend/scripts/validate-analysis-sql.mjs`; `docs/security/DATABASE_CATALOG.json`; `docs/security/RLS_AND_DATABASE_POLICY_MATRIX.md`.
- **Migration(s):** `All 20 migrations listed in section 2`
- **Test/evidence:** npm run test:sql:isolated -- --catalog: 18 suites PASS.
- **Scope / remaining limitation:** PGlite uses synthetic Auth/Storage scaffolding; it is not live Supabase/PostgREST/Realtime evidence. Generated database.types.ts remains incomplete and was not generated by this pass.

### Row Level Security (RLS)

**Owner policies plus restrictive live-session policies — Implemented**

- **What was implemented:** Enables table RLS, preserves owner policies, removes dangerous dormant write policies, adds owner export/deletion history reads and layers an authenticated restrictive live-session/account-status policy on all 87 application tables plus storage.objects.
- **Why / security improvement:** Block foreign-owner access and direct Data API operations using revoked or inactive-account sessions; the restrictive policy does not grant access on its own.
- **Exact files/modules:** `supabase/migrations/20260917010000_security_privileges_and_integrity.sql`; `supabase/migrations/20260917015000_settings_user_scoping.sql`; `supabase/migrations/20260918011000_public_compatibility_lockdown.sql`; `supabase/migrations/20260920017000_session_bound_data_policies.sql`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917015000_settings_user_scoping.sql`; `20260918011000_public_compatibility_lockdown.sql`; `20260920017000_session_bound_data_policies.sql`
- **Test/evidence:** security-baseline.sql; security-*-isolation.sql; security-session-data-access.sql; security-public-boundaries.sql: PASS.
- **Scope / remaining limitation:** Policies are locally migration-tested only; complete live action/role tests remain required.

### Database grants and permissions

**Deny-by-default grants and protected columns — Implemented**

- **What was implemented:** Revokes private-schema browser access/default grants, legacy public CRUD and public CREATE. Explicitly regrants required owner reads and selected columns, such as notification read_at. Protects account/eligibility/contact-verification fields and audit mutation. Private RPC execution is revoked from anonymous/browser roles except deliberate owner invokers.
- **Why / security improvement:** Prevent permission drift, direct protected-state changes, private RPC impersonation and legacy-schema bypass.
- **Exact files/modules:** `supabase/migrations/20260917010000_security_privileges_and_integrity.sql`; `supabase/migrations/20260917013000_notification_user_scoping.sql`; `supabase/migrations/20260917015000_settings_user_scoping.sql`; `supabase/migrations/20260918011000_public_compatibility_lockdown.sql`; `docs/security/ROLE_AND_PERMISSION_MATRIX.md`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917013000_notification_user_scoping.sql`; `20260917015000_settings_user_scoping.sql`; `20260918011000_public_compatibility_lockdown.sql`; `20260920012000_journal_read_scope.sql`; `20260920014000_experience_read_scope.sql`
- **Test/evidence:** Baseline, settings/notification/public isolation and service-only RPC denial SQL: PASS.
- **Scope / remaining limitation:** Migration IDs abbreviate the exact filenames in section 2; runtime still has privileged service-role operations.

### Database integrity and constraints

**Parent-owner foreign keys and atomic contact updates — Implemented**

- **What was implemented:** Adds missing account FKs, composite Buddy conversation/message/feedback and verification document ownership constraints, parent review FK, verification state/file bounds, ciphertext-only new-write constraints, and an auth.uid()-derived contact transaction with per-owner locking.
- **Why / security improvement:** Reject nonexistent/foreign owners and avoid demoting an existing primary contact before a denied or failed save.
- **Exact files/modules:** `supabase/migrations/20260917010000_security_privileges_and_integrity.sql`; `supabase/migrations/20260918012000_account_ownership_integrity.sql`; `supabase/migrations/20260920013000_atomic_trusted_contacts.sql`; `backend/src/features/settings/settings.service.ts`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917012000_buddy_ciphertext_and_document_quarantine.sql`; `20260918012000_account_ownership_integrity.sql`; `20260920010000_analysis_result_ciphertext.sql`; `20260920013000_atomic_trusted_contacts.sql`; `20260920018000_wellness_assessment_ciphertext.sql`
- **Test/evidence:** security-account-integrity.sql; security-contact-transactions.sql; ciphertext and wellness SQL: PASS.
- **Scope / remaining limitation:** NOT VALID constraints check new/changed rows but do not certify historical consistency.

### Encryption

**Authenticated crypto and expanded ciphertext coverage — Partially Implemented**

- **What was implemented:** Hardens existing AES-256-GCM with canonical 32-byte keys, fresh 12-byte IVs, 16-byte tags and version checks. Adds encrypted-only Buddy messages, new detailed AI results, PHQ-8 responses/score/severity bound to owner/submission, and whole encrypted export artifacts bound to owner/request. Recomputes PHQ-8 scores after decryption. Weekly stored analysis distributions are removed; existing encrypted journal/verification fields are retained.
- **Why / security improvement:** Reduce plaintext database exposure and reject tampered, wrong-key, cross-owner or inconsistent sensitive payloads.
- **Exact files/modules:** `backend/src/infrastructure/encryption/encryption.service.ts`; `backend/src/infrastructure/encryption/analysis-result-encryption.ts`; `backend/src/features/experience/experience.service.ts`; `backend/src/features/experience/wellness.service.ts`; `backend/src/features/journals/journals.service.ts`; `backend/src/features/analysis/local-worker.service.ts`; `backend/src/features/settings/data-export.service.ts`.
- **Migration(s):** `20260917012000_buddy_ciphertext_and_document_quarantine.sql`; `20260920010000_analysis_result_ciphertext.sql`; `20260920015000_private_data_exports.sql`; `20260920018000_wellness_assessment_ciphertext.sql`
- **Test/evidence:** encryption.service.test.ts; analysis-result-encryption.test.ts; storage-encryption.test.ts; wellness-encryption.test.ts; data-export.test.ts: PASS.
- **Scope / remaining limitation:** Historical records need backfill; AI safety severity index, journal metadata and other Restricted projections remain gaps. Private object access is not proof of application-level object encryption.

### Key management

**Versioned distinct keyring and guarded migration tooling — Partially Implemented**

- **What was implemented:** Adds approved previous-key configuration, distinct key/version validation, local-only Buddy and PHQ-8 migration CLIs and in-memory CAS migration helpers. Dry runs count coverage; mutation requires --apply-synthetic and a loopback database. Existing journal backfill now uses explicit schema access and synthetic local restrictions.
- **Why / security improvement:** Support controlled key transition and historical encryption without silently overwriting concurrent changes or logging plaintext.
- **Exact files/modules:** `backend/src/config/environment.ts`; `backend/.env.example`; `backend/src/infrastructure/encryption/encryption.service.ts`; `backend/src/infrastructure/encryption/text-migration.ts`; `backend/src/infrastructure/encryption/wellness-migration.ts`; `backend/scripts/buddy-ciphertext-backfill.mts`; `backend/scripts/wellness-ciphertext-backfill.mts`; `backend/src/features/journals/ciphertext-backfill.service.ts`; `docs/security/ENCRYPTION_AND_KEY_MANAGEMENT.md`.
- **Migration(s):** `20260918010000_buddy_ciphertext_rotation.sql`; `20260921010000_wellness_ciphertext_rotation.sql`
- **Test/evidence:** Crypto rotation/tamper, text-migration, wellness-migration and journal-backfill tests; migration SQL: PASS.
- **Scope / remaining limitation:** No backfill CLI or live rotation was executed. Analysis migration/rotation, managed KMS and restore-compatible key retirement remain unfinished.

### Backend/API security

**Central middleware and bounded dependency calls — Implemented**

- **What was implemented:** Moves correlation/log context ahead of parsing; inserts origin rejection, forwarding checks, rate limits and runtime controls; retains Helmet and no-store API behavior. Supabase fetch now has a shared 30-second deadline, rejects redirects and retries only GET/HEAD up to three attempts.
- **Why / security improvement:** Make failed/abusive requests attributable and prevent unsafe write retries or unbounded dependency waits.
- **Exact files/modules:** `backend/src/app.ts`; `backend/src/infrastructure/supabase/resilient-fetch.ts`; `backend/src/shared/middleware/security-policy.ts`; `backend/src/infrastructure/security/runtime-controls.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** api-hardening.test.ts and full API regression/build/typecheck: PASS.
- **Scope / remaining limitation:** Not every service call has independent integration coverage. Helmet, correlation and no-store responses were partly pre-existing and were retained/reordered.

### Input validation

**Strict DTOs and bounded values — Implemented**

- **What was implemented:** Adds strict object handling across settings, verification, onboarding, experience and worker input; bounds strings/passwords, validates UUIDs and constrains reminder time to valid HH:MM. PHQ-8 validates eight bounded responses before scoring/encryption.
- **Why / security improvement:** Reject malformed/unexpected fields before service mutations and constrain resource use.
- **Exact files/modules:** `backend/src/features/settings/settings.controller.ts`; `backend/src/features/verification/verification.controller.ts`; `backend/src/features/onboarding/onboarding.controller.ts`; `backend/src/features/experience/experience.controller.ts`; `backend/src/features/journals/journals.controller.ts`; `backend/src/features/analysis/local-worker.routes.ts`; `backend/src/features/experience/wellness.service.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** mass-assignment.test.ts; uuid-validation.test.ts; onboarding/settings/verification route tests; wellness-encryption.test.ts: PASS.
- **Scope / remaining limitation:** Some journal schemas strip unknown properties rather than rejecting them; report the observed route behavior, not a universal strict-object claim.

### Rate limiting

**Actor-scoped route limits and safe 429 responses — Implemented**

- **What was implemented:** Adds a shared limiter keyed to verified user ID or normalized IP: global 120/minute, sensitive settings/security/export/deletion group 6/minute, journal writes 30/minute, verification 30/minute, selected experience/AI writes 20/minute, internal worker 60/minute.
- **Why / security improvement:** Constrain abuse without allowing spoofed forwarding headers to rotate an authenticated actor key.
- **Exact files/modules:** `backend/src/shared/middleware/security-policy.ts`; `backend/src/app.ts`; `backend/src/features/settings/settings.routes.ts`; `backend/src/features/journals/journals.routes.ts`; `backend/src/features/verification/verification.routes.ts`; `backend/src/features/experience/experience.routes.ts`; `backend/src/features/analysis/local-worker.routes.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** api-hardening.test.ts; registration.routes.test.ts; route regression: PASS.
- **Scope / remaining limitation:** HTTP limiters are process-local, not a shared distributed store. Database AI/export quotas provide separate persistent admission controls.

### CORS

**Exact-origin and method enforcement — Implemented**

- **What was implemented:** Rejects unapproved Origin/method before parsing, constrains allowed methods/headers, and supports localhost/127.0.0.1 aliases only for non-production HTTP loopback.
- **Why / security improvement:** Turn CORS policy into explicit rejection and prevent accidental hostname-alias expansion.
- **Exact files/modules:** `backend/src/app.ts`; `backend/src/shared/middleware/security-policy.ts`; `backend/src/config/environment.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** api-hardening.test.ts: exact/hostile origins, preflight methods and non-loopback alias cases PASS.
- **Scope / remaining limitation:** Actual staging/production FRONTEND_URL still requires environment configuration and browser validation.

### Security headers

**Maintained API/browser headers with nonce correction — Implemented**

- **What was implemented:** Retains Helmet, x-powered-by removal and uncached API responses; confirms safe headers on malformed/oversized input. Corrects browser CSP propagation to the Next renderer (detailed under CSP).
- **Why / security improvement:** Reduce browser exposure and sensitive-response caching while keeping error responses protected.
- **Exact files/modules:** `backend/src/app.ts`; `frontend/src/proxy.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** api-hardening.test.ts; frontend/src/proxy.test.ts: PASS.
- **Scope / remaining limitation:** Headers were not all newly invented in this pass. Deployed TLS/header scans were not run.

### Proxy/trust proxy handling

**Explicit trusted proxy addresses — Implemented**

- **What was implemented:** Adds TRUSTED_PROXY_ADDRESSES and rejects wildcard/hop-count-style configuration. Defaults Express trust proxy to false and rejects Forwarded/X-Forwarded-For on direct deployments.
- **Why / security improvement:** Prevent client-controlled source-IP spoofing and rate-limit bypass caused by broad proxy trust.
- **Exact files/modules:** `backend/src/config/environment.ts`; `backend/src/server.ts`; `backend/src/app.ts`; `backend/src/shared/middleware/security-policy.ts`; `backend/.env.example`.
- **Migration(s):** None for this control.
- **Test/evidence:** api-hardening.test.ts spoofed-proxy checks: PASS.
- **Scope / remaining limitation:** Operator must configure real ingress addresses/CIDRs and confirm forwarding behavior under deployment.

### Error handling

**Stable client errors and reduced diagnostic leakage — Implemented**

- **What was implemented:** Removes detailed error bodies from server logs, redacts permitted sub-500 response details, hides provider/decoder diagnostics and uses safe auth/storage/export errors. Body parse failures remain stable 400/413 with request IDs.
- **Why / security improvement:** Avoid exposing tokens, Restricted content or database/provider internals through failures.
- **Exact files/modules:** `backend/src/shared/middleware/error.middleware.ts`; `backend/src/shared/utils/redaction.ts`; `backend/src/infrastructure/supabase/supabase-diagnostics.ts`; `backend/src/features/registration/registration.service.ts`; `backend/src/infrastructure/security/image-validation.ts`; `frontend/src/services/authentication/auth.supabase-adapter.ts`; `frontend/src/services/settings/settings.service.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** redaction.test.ts; api-hardening.test.ts; registration.enumeration.test.ts; private export/auth-adapter tests: PASS.

### SSRF protection

**Allowlisted and DNS-pinned outbound HTTPS — Implemented**

- **What was implemented:** Adds exact approved origins; rejects URL credentials/query/fragment and unsafe hosts/IPs; requires all resolved addresses to be public; pins approved lookup while retaining TLS server-name verification; rejects redirects; caps request at 256 KiB, response at 1 MiB and total timeout at 30 seconds. AI adapter also caps journal input at 40,000 characters.
- **Why / security improvement:** Prevent cloud/private-network access, DNS rebinding, redirect escape and oversized/hanging provider responses.
- **Exact files/modules:** `backend/src/infrastructure/security/outbound-json.ts`; `backend/src/infrastructure/ai/ai.client.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** backend/tests/security/outbound-json.test.ts: 24 PASS in the recorded targeted/full runs.
- **Scope / remaining limitation:** The external AI adapter is not an active production-provider integration; no live provider call or network penetration test ran.

### Mass assignment protection

**Server-derived identity and protected state — Implemented**

- **What was implemented:** Routes derive owner identity from verified authentication; DTOs strip or reject injected owner/status/role fields. Database column grants separately withhold account, eligibility, contact-verification and workflow mutations.
- **Why / security improvement:** Prevent users assigning records to another owner or escalating privileged states through ordinary update payloads.
- **Exact files/modules:** `backend/src/features/journals/journals.controller.ts`; `backend/src/features/settings/settings.controller.ts`; `backend/src/features/verification/verification.controller.ts`; `backend/src/features/onboarding/onboarding.controller.ts`; `backend/tests/security/mass-assignment.test.ts`.
- **Migration(s):** `20260917015000_settings_user_scoping.sql`
- **Test/evidence:** mass-assignment.test.ts and security-settings-isolation.sql: PASS.

### Frontend/browser security

**Private session-bound component lifecycle — Implemented**

- **What was implemented:** Wraps protected/onboarding layouts in a boundary that hides immediately, unmounts private content and requests full-document navigation on account change, session clear or restored browser snapshot; same-account token refresh does not reset it. Exports cancel on unmount/session clear and revoke Blob URLs.
- **Why / security improvement:** Prevent prior-account mounted state and router/module caches surviving an identity change.
- **Exact files/modules:** `frontend/src/infrastructure/security/private-session-boundary.tsx`; `frontend/src/app/(protected)/layout.tsx`; `frontend/src/app/(onboarding)/layout.tsx`; `frontend/src/features/settings/components/export-data.tsx`.
- **Migration(s):** None for this control.
- **Test/evidence:** private-session-boundary.test.tsx and clear-sensitive-state.test.ts: 8 PASS together; full frontend 376 PASS.
- **Scope / remaining limitation:** jsdom cannot execute real document navigation. Real multi-account/back-forward/network-cache testing remains required.

### CSP

**Next renderer receives the request CSP nonce — Implemented**

- **What was implemented:** Adds Content-Security-Policy to the forwarded request alongside x-nonce so Next applies the same random nonce to framework scripts; existing response CSP is retained.
- **Why / security improvement:** Close a renderer/response mismatch while preserving nonce-based script restrictions.
- **Exact files/modules:** `frontend/src/proxy.ts`; `frontend/src/proxy.test.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** Proxy test verifies same unpredictable nonce policy for renderer/browser: PASS; Next production build PASS.
- **Scope / remaining limitation:** No deployed browser CSP report/network inspection or general XSS penetration test was performed.

### Sensitive browser storage protection

**Remove obsolete plaintext journal caching — Implemented**

- **What was implemented:** Deletes the unused journal-draft-manager component/export, replaces localStorage autosave with an async persistence callback, and removes recognized old draft/autosave/active-analysis keys from local/session storage on sensitive-state clear while preserving UI preferences.
- **Why / security improvement:** Avoid durable plaintext journal copies and prevent stale private caches across logout/session failure.
- **Exact files/modules:** `frontend/src/features/journal/components/journal-draft-manager.tsx (deleted)`; `frontend/src/features/journal/components/index.ts`; `frontend/src/features/journal/components/journal-autosave.tsx`; `frontend/src/infrastructure/security/clear-sensitive-state.ts`; `frontend/src/services/authentication/auth.supabase-adapter.ts`; `frontend/src/infrastructure/api/supabase-auth-token-provider.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** clear-sensitive-state.test.ts and private-session-boundary.test.tsx: PASS; source/bundle scan 0 findings.
- **Scope / remaining limitation:** This does not certify every browser storage mechanism or zeroize JavaScript memory; existing SDK session handling remains.

### File/upload security

**Decode/re-encode images and quarantine verification documents — Partially Implemented**

- **What was implemented:** Uses real sharp decoding for JPEG/PNG/WebP and avatar GIF: 5 MiB, 8192 side, 20M total pixels, 50 frames, two active decoders and 10-second native limit; removes EXIF/GPS/comments/trailing content. Verification files require JPEG/PNG/PDF signature, 8 MiB bound and scanner evidence matching digest/version plus PDF <=20 pages or image <=40M pixels. Scanner timeout is 15 seconds; default/outage remains quarantined.
- **Why / security improvement:** Reject disguised/corrupt/bomb files, strip metadata and prevent unscanned documents being treated as clean.
- **Exact files/modules:** `backend/src/infrastructure/security/image-validation.ts`; `backend/src/infrastructure/security/document-scanner.ts`; `backend/src/features/journals/journal-images.service.ts`; `backend/src/features/settings/settings.service.ts`; `backend/src/features/verification/verification.service.ts`; `backend/package.json`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917012000_buddy_ciphertext_and_document_quarantine.sql`
- **Test/evidence:** image-validation.test.ts (9) plus avatar storage test (1): PASS; storage-encryption.test.ts: PASS.
- **Scope / remaining limitation:** No real antivirus/PDF scanner was connected; clean evidence is tested with synthetic scanner adapters. Signature checking is not malware detection.

### Supabase Storage security

**Private sensitive buckets and clean-only reviewer access — Partially Implemented**

- **What was implemented:** Makes journal-images and verification-documents private in migration, adds live-session restrictive storage policy, blocks reviewer document signing/approval until all files have clean scan evidence, and exports only approved owner-prefixed paths.
- **Why / security improvement:** Limit object disclosure and stop foreign-path substitution or quarantine bypass.
- **Exact files/modules:** `backend/src/features/verification/verification.service.ts`; `backend/src/features/settings/data-export.service.ts`; `backend/src/features/journals/journal-images.service.ts`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917012000_buddy_ciphertext_and_document_quarantine.sql`; `20260920017000_session_bound_data_policies.sql`
- **Test/evidence:** security-baseline.sql; security-session-data-access.sql; storage-encryption.test.ts; data-export.test.ts: PASS.
- **Scope / remaining limitation:** Private buckets/policies were not applied remotely. Avatar public URL behavior remains; not all buckets were made private. Signed URLs remain bearer tickets until expiry.

### AI security

**Runtime shutdown checks and encrypted completion — Partially Implemented**

- **What was implemented:** Adds emergency-control checks at worker claim and AI adapter/execution/admission paths and encrypts final worker/development results before persistence. Existing worker authentication, leases, callback idempotency and result schemas are retained.
- **Why / security improvement:** Stop new optional AI processing under emergency controls and avoid persisting detailed outputs in plaintext.
- **Exact files/modules:** `backend/src/infrastructure/security/runtime-controls.ts`; `backend/src/features/analysis/local-worker.service.ts`; `backend/src/features/analysis/local-worker.routes.ts`; `backend/src/features/journals/journals.service.ts`; `backend/src/infrastructure/ai/ai.client.ts`; `backend/src/infrastructure/encryption/analysis-result-encryption.ts`.
- **Migration(s):** `20260920010000_analysis_result_ciphertext.sql`
- **Test/evidence:** runtime-audit.test.ts; analysis-result-encryption.test.ts; existing journal-analysis SQL and full backend tests: PASS.
- **Scope / remaining limitation:** Worker leases/idempotency are pre-existing, not newly built here. No live inference/provider security assessment was performed.

### AI consent/privacy controls

**Preserved consent gates and limited read exposure — Partially Implemented**

- **What was implemented:** Keeps existing consent-at-job gates, restores settings visibility of journal_ai_analysis_enabled, grants owner consent reads, and applies emergency AI disable checks. Provider destinations are explicit in the unused outbound adapter.
- **Why / security improvement:** Maintain user choice and avoid optional processing when current gates disallow it.
- **Exact files/modules:** `backend/src/features/settings/settings.service.ts`; `backend/src/features/experience/experience.service.ts`; `backend/src/features/journals/journals.service.ts`; `backend/src/infrastructure/security/runtime-controls.ts`; `docs/security/ENVIRONMENT_AND_PROVIDER_INVENTORY.md`.
- **Migration(s):** `20260920014000_experience_read_scope.sql`
- **Test/evidence:** Existing journal-analysis security/transaction SQL and runtime-control tests: PASS.
- **Scope / remaining limitation:** Consent model/job gates predate this pass. Provider retention/training/region/deletion agreements, withdrawal propagation to provider copies and full consent-history review remain unfinished.

### Prompt injection protection

**Structured-output boundary, with no dedicated prompt-injection implementation claimed — Partially Implemented**

- **What was implemented:** New result-encryption helper validates the existing versioned analysis result schema. Outbound transport remains a fixed analyze endpoint with bounded input/output. No semantic prompt-injection filter, tool-execution sandbox or dedicated adversarial prompt suite was added.
- **Why / security improvement:** Schema validation can reject malformed output and keep it within the application contract, but cannot prove resistance to malicious instructions in user content.
- **Exact files/modules:** `backend/src/infrastructure/encryption/analysis-result-encryption.ts`; `backend/src/infrastructure/ai/ai.client.ts`; `backend/src/infrastructure/security/outbound-json.ts`.
- **Migration(s):** `20260920010000_analysis_result_ciphertext.sql`
- **Test/evidence:** analysis-result-encryption.test.ts validates malformed result rejection; outbound-json.test.ts validates transport only. Dedicated prompt/tool attack evaluation: NOT RUN.
- **Scope / remaining limitation:** Do not label transport/schema tests as prompt-injection protection verification. Provider/model instruction separation and attack evaluation require further engineering/review.

### AI rate/budget controls

**Database-enforced admission budgets — Implemented**

- **What was implemented:** Adds serialized policy-controlled limits: 30/user/day, 1000 globally/day, 10 outstanding/user and 100 globally outstanding. service_role can read but cannot raise limits. New admitted jobs use server-owned now() to prevent timezone shifts/backdating from bypassing UTC-day counts.
- **Why / security improvement:** Control workload and provider exposure across backend replicas, beyond process-local HTTP rate limiting.
- **Exact files/modules:** `supabase/migrations/20260920011000_analysis_admission_budgets.sql`; `supabase/tests/database/security-ai-budgets.sql`.
- **Migration(s):** `20260920011000_analysis_admission_budgets.sql`
- **Test/evidence:** security-ai-budgets.sql covers per-user/global outstanding/daily quotas, opposite timezones, backdated timestamps and budget mutation denial: PASS.
- **Scope / remaining limitation:** These are request-count budgets, not provider token-cost or monetary spend limits; terminal historical inserts are excluded from admission enforcement.

### Privacy and consent

**Documented data handling and narrower owner access — Partially Implemented**

- **What was implemented:** Adds data classification/purpose/retention and provider inventories, owner privacy/consent reads, metadata-only audit design and export coverage. Existing consent storage is retained and protected by grants/session policies.
- **Why / security improvement:** Make data purposes and incomplete lifecycle handling explicit for privacy review and reduce unintended access.
- **Exact files/modules:** `docs/security/DATA_CLASSIFICATION_AND_RETENTION.md`; `docs/security/EXPORT_COVERAGE.md`; `docs/security/ENVIRONMENT_AND_PROVIDER_INVENTORY.md`; `backend/src/features/settings/settings.service.ts`; `backend/src/features/onboarding/onboarding.service.ts`.
- **Migration(s):** `20260917015000_settings_user_scoping.sql`; `20260920014000_experience_read_scope.sql`; `20260920017000_session_bound_data_policies.sql`
- **Test/evidence:** Settings/experience isolation SQL and existing consent tests: PASS.
- **Scope / remaining limitation:** Retention durations are proposed, not legally approved. This pass does not certify a final approved privacy notice or complete lifecycle automation.

### Export/deletion controls

**Encrypted single-use exports and atomic deletion requests — Partially Implemented**

- **What was implemented:** Implements account JSON export over 62 fixed owner/parent-owned collections plus bounded clean attachments; encrypts before artifact persistence, validates owner/request after decryption, expires at 24 hours and consumes once. Recent auth protects generation/download/PDF authorization. Admission: 3/user and 200 global per rolling day, two concurrent process operations; bounded rows/bytes/files. Deletion request/cancel now use per-user locked service-only RPCs and mandatory same-transaction audits with a 30-day schedule.
- **Why / security improvement:** Prevent cross-account or replayed exports, incomplete artifacts and unaudited/racy privacy-request changes.
- **Exact files/modules:** `backend/src/features/settings/data-export.service.ts`; `backend/src/features/settings/settings.service.ts`; `backend/src/features/settings/settings.controller.ts`; `backend/src/features/settings/settings.routes.ts`; `backend/src/server.ts`; `frontend/src/features/settings/components/export-data.tsx`; `frontend/src/services/settings/settings.service.ts`; `docs/security/EXPORT_COVERAGE.md`.
- **Migration(s):** `20260920015000_private_data_exports.sql`; `20260920018000_wellness_assessment_ciphertext.sql`; `20260921011000_atomic_deletion_requests.sql`
- **Test/evidence:** data-export.test.ts; settings export route/service tests; security-export-lifecycle.sql; security-deletion-requests.sql: PASS.
- **Scope / remaining limitation:** Actual account erasure across all schemas/objects/providers and restore tombstones is NOT implemented. Oversized exports need a separate delivery process. No real account was exported/deleted.

### Logging

**Structured redaction and path scrubbing — Implemented**

- **What was implemented:** Redacts nested sensitive keys, credentials and Restricted content, handles cyclic structures, removes raw details from server errors and scrubs URL/path-sensitive values from request/Supabase diagnostic logging.
- **Why / security improvement:** Keep diagnostics usable without copying private text, tokens or signed URLs into logs.
- **Exact files/modules:** `backend/src/shared/utils/redaction.ts`; `backend/src/shared/middleware/request-logger.middleware.ts`; `backend/src/shared/middleware/error.middleware.ts`; `backend/src/infrastructure/supabase/supabase-diagnostics.ts`.
- **Migration(s):** None for this control.
- **Test/evidence:** redaction.test.ts; runtime-audit.test.ts: PASS.
- **Scope / remaining limitation:** This is local code-level logging behavior, not a review of hosted log destinations or retention.

### Audit trail

**Append-only metadata events and transactional privacy audit — Partially Implemented**

- **What was implemented:** Creates security_events with request UUID, actor hash, event/outcome/status metadata. Runtime may append/read but not mutate security audit evidence; existing audit_events runtime update/delete/truncate is revoked. Export and deletion-request state transitions write their audit rows atomically.
- **Why / security improvement:** Provide content-free correlation and prevent silent privacy state changes when audit insertion fails.
- **Exact files/modules:** `backend/src/shared/middleware/security-audit.middleware.ts`; `backend/src/server.ts`; `backend/src/features/settings/settings.service.ts`.
- **Migration(s):** `20260917010000_security_privileges_and_integrity.sql`; `20260917014000_security_audit_events.sql`; `20260920015000_private_data_exports.sql`; `20260921011000_atomic_deletion_requests.sql`
- **Test/evidence:** runtime-audit.test.ts; baseline privilege SQL; export lifecycle/deletion request rollback SQL: PASS.
- **Scope / remaining limitation:** Generic response-finish audit delivery is best-effort, with a failure log; it is not a durable transactional outbox. Other workflow audits are not all mandatory/transactional.

### Monitoring hooks

**Security event sink and failure signals — Partially Implemented**

- **What was implemented:** Wires the security middleware sink to user_service.security_events, emits safe audit-delivery failure and maintenance failure signals, and documents alert routing/threshold proposals.
- **Why / security improvement:** Provide integration points for operational detection without logging request bodies or arbitrary URLs.
- **Exact files/modules:** `backend/src/shared/middleware/security-audit.middleware.ts`; `backend/src/server.ts`; `docs/security/INCIDENT_RESPONSE_PLAN.md`.
- **Migration(s):** `20260917014000_security_audit_events.sql`
- **Test/evidence:** runtime-audit.test.ts exercises content-free denial events: PASS; collector/alert drill: NOT RUN.
- **Scope / remaining limitation:** No external monitoring collector, retention archive, on-call routing or active alert was configured.

### CI/CD security

**Least-privilege security workflow — Partially Implemented**

- **What was implemented:** Updates PR/main-push CI with contents:read, high/critical audit failure, source/bundle/query/target/auth-policy/isolated-SQL checks, build and evidence upload. Adds full-checkout gitleaks history action.
- **Why / security improvement:** Automate reproducible checks without granting broad repository permissions.
- **Exact files/modules:** `.github/workflows/security-checks.yml`; `scripts/security-scan.mjs`; `scripts/security-query-boundaries.mjs`; `scripts/security-project-target.test.mjs`.
- **Migration(s):** None for this control.
- **Test/evidence:** Corresponding local commands passed; actual GitHub workflow run/settings were not verified.
- **Scope / remaining limitation:** This workflow does not itself run npm test/typecheck/lint explicitly; those were run locally. Actions use version tags rather than pinned commit SHAs. Branch protection/required checks remain external.

### Dependency/security scanning

**Dependency remediation and source/bundle scanning — Implemented**

- **What was implemented:** Updated Next 16.3.5, Vitest/coverage 4.1.11, sharp 0.35.4 and qs resolution 6.16.0 in the lockfile; added explicit backend sharp dependency. Added scans for secret patterns, public env exposure, privileged frontend imports and query boundaries.
- **Why / security improvement:** Remove known audited dependency findings and detect accidental sensitive code/config exposure.
- **Exact files/modules:** `frontend/package.json`; `backend/package.json`; `package-lock.json`; `scripts/security-scan.mjs`; `scripts/security-query-boundaries.mjs`; `.github/workflows/security-checks.yml`.
- **Migration(s):** None for this control.
- **Test/evidence:** npm audit --audit-level=high: 0 vulnerabilities; source/bundle: 1080 paths, 0 findings; query scan: 128, 0 findings.
- **Scope / remaining limitation:** Registry/pattern results are time-specific; local full-history gitleaks run was not recorded. No claim of complete SAST/DAST coverage.

### Backup/recovery preparation

**Recovery and key-retention runbook — Blocked / Manual Action Required**

- **What was implemented:** Documents isolated restore steps, database/object/key separation, deletion-tombstone replay expectation and proposed backup/RPO/RTO targets.
- **Why / security improvement:** Provide an operational checklist that preserves encryption access and prevents restoring deleted data into service.
- **Exact files/modules:** `docs/security/INCIDENT_RESPONSE_PLAN.md`; `docs/security/DATA_CLASSIFICATION_AND_RETENTION.md`; `docs/security/ENCRYPTION_AND_KEY_MANAGEMENT.md`.
- **Migration(s):** None for this control.
- **Test/evidence:** Documentation exists and was inspected; actual backup/restore/key-recovery drill: NOT RUN.
- **Scope / remaining limitation:** Preparation only. No backup service, deletion-tombstone implementation or recovery guarantee was delivered. Proposed 35-day backup retention, RPO 24h and RTO 8h need approval.

### Incident response

**Documented response procedure and runtime kill-switch file — Partially Implemented**

- **What was implemented:** Adds a secret-free validated hot-read controls file for AI/uploads/route prefixes, plus incident containment, revocation, credential rotation, investigation, recovery and communications procedures. Configured missing/malformed controls fail closed.
- **Why / security improvement:** Let operators disable risky processing without a code redeploy and give responders defined evidence/containment steps.
- **Exact files/modules:** `backend/src/infrastructure/security/runtime-controls.ts`; `backend/security-controls.example.json`; `backend/.env.example`; `docs/security/INCIDENT_RESPONSE_PLAN.md`.
- **Migration(s):** None for this control.
- **Test/evidence:** runtime-audit.test.ts checks hot reload and malformed controls: PASS. Live multi-instance kill-switch/tabletop: NOT RUN.
- **Scope / remaining limitation:** With no ECHO_SECURITY_CONTROLS_FILE configured the overlay defaults enabled. File distribution, on-call ownership and drills are manual.

### Security documentation

**Requirement/evidence and operations documentation set — Implemented**

- **What was implemented:** Creates authoritative-copy, requirement-status, role/grant/RLS/catalog, encryption, retention, export, test and incident documents and expands the threat model. Previous implementation handoff inventories changes and records unfinished work.
- **Why / security improvement:** Give the thesis and reviewers traceable implementation evidence without inventing deployment or independent-review claims.
- **Exact files/modules:** `docs/security/SECURITY_REQUIREMENTS.md`; `docs/security/SECURITY_REQUIREMENT_STATUS_MATRIX.md`; `docs/security/SECURITY_IMPLEMENTATION_STATUS.md`; `docs/security/SECURITY_IMPLEMENTATION_HANDOFF.md`; `docs/security/SECURITY_TEST_EVIDENCE.md`; `docs/security/SECURITY_TEST_PLAN.md`; `docs/security/THREAT_MODEL.md`; `docs/security/DATA_CLASSIFICATION_AND_RETENTION.md`; `docs/security/ROLE_AND_PERMISSION_MATRIX.md`; `docs/security/RLS_AND_DATABASE_POLICY_MATRIX.md`; `docs/security/DATABASE_CATALOG.json`; `docs/security/ENCRYPTION_AND_KEY_MANAGEMENT.md`; `docs/security/EXPORT_COVERAGE.md`; `docs/security/ENVIRONMENT_AND_PROVIDER_INVENTORY.md`; `docs/security/ENDPOINT_SECURITY_MATRIX.md`; `docs/security/INCIDENT_RESPONSE_PLAN.md`.
- **Migration(s):** None for this control.
- **Test/evidence:** 83/83 requirement IDs checked in prior handoff; authoritative copy byte-match confirmed; catalog generated after 18 passing SQL suites.
- **Scope / remaining limitation:** Policy/independent-review sign-off is not implied by writing documentation.

### Automated security tests

**New and extended negative security regressions — Implemented**

- **What was implemented:** Adds 31 new test files: 13 backend Vitest, 3 frontend Vitest, 14 SQL suites and 1 Node test. Modifies 17 existing test files for the changed contracts and additional security assertions.
- **Why / security improvement:** Detect owner/session/role bypass, malformed input, tampering, SSRF, unsafe files, secret logging and privacy lifecycle regressions.
- **Exact files/modules:** `All exact test paths and cases in section 3`; `backend/scripts/validate-analysis-sql.mjs`.
- **Migration(s):** `Test fixtures replay all 20 new migrations locally`
- **Test/evidence:** Final run: 376 frontend + 276 backend tests; 18 SQL suites; 1 Node project-guard test PASS.
- **Scope / remaining limitation:** No exact newly-added individual-case count is claimed; parameterized tests and expanded existing files prevent a reliable count from the retained output. No independent pentest or live end-to-end Supabase run.

## 2. DATABASE MIGRATIONS

**20 created security migration files. Every one is local-only, replayed in isolated synthetic PGlite tests, and NOT applied to remote Supabase.** No remote migration history/dry run/apply was observed. All are under `supabase/migrations/`. Existing pre-pass migrations are not credited as newly created.

| Filename | Purpose | Schemas/tables/functions affected | RLS/grant/constraint/security changes | Application evidence |
| --- | --- | --- | --- | --- |
| 20260917010000_security_privileges_and_integrity.sql | Foundational privileges and integrity | Nine private/service schemas; public schema CREATE; user_service.audit_events; Buddy conversations/messages; verification records/documents; storage.buckets | Revokes browser/default grants; enables RLS; pins missing definer search paths; revokes runtime audit mutation; removes dangerous write policies; adds owner composite FKs and verification state/MIME/size bounds; sets journal-images and verification-documents private. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260917011000_security_session_lifecycle.sql | Managed session check | user_service.security_session_active(uuid,uuid); auth.sessions | Service-only definer checks exact account/session and expiry; browser/anonymous execute revoked. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260917012000_buddy_ciphertext_and_document_quarantine.sql | Ciphertext and quarantine state | buddy_service.buddy_messages; verification_service.verification_documents | Adds NOT VALID encrypted-content constraint and scan status/time/version with clean-evidence constraints. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260917013000_notification_user_scoping.sql | Minimal notification access | notification_service.notifications | Authenticated schema usage and SELECT; UPDATE restricted to read_at, under owner RLS. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260917014000_security_audit_events.sql | Metadata audit store | user_service.security_events; security_events_event_time index | New RLS table; runtime SELECT/INSERT only; no browser access; bounded event/outcome/request/actor fields. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260917015000_settings_user_scoping.sql | Minimal settings/contacts/history access | user_service profiles, notification_preferences, privacy_preferences, trusted_contacts, audit_events, data_export_requests, account_deletion_requests | Explicit owner read and selected insert/update/delete grants; protected fields withheld; owner read policies for export/deletion history. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260918010000_buddy_ciphertext_rotation.sql | Guarded Buddy backfill/rotation | buddy_service.replace_message_ciphertext; buddy_messages | Service-only invoker validates envelope/size and replaces only matching id, owner and SHA-256 old-content digest. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260918011000_public_compatibility_lockdown.sql | Close legacy public bypass | public tables/sequences/default privileges/functions; public.analysis_status_projection | Revokes legacy browser CRUD/sequence and default function execution; enables public-table RLS; regrants only authenticated projection SELECT. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260918012000_account_ownership_integrity.sql | Account and child ownership integrity | user_id tables across eight app service schemas; buddy_messages/buddy_feedback; verification_reviews | Adds missing auth.users FKs with ON DELETE CASCADE NOT VALID, message-owner uniqueness, feedback composite-owner FK and review parent FK. Existing FK behavior is preserved when present. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920010000_analysis_result_ciphertext.sql | Encrypt detailed AI results | ai_analysis.complete_journal_analysis; analysis_results; insights_service.recompute_analysis_week/weekly_analysis_metrics | Requires ciphertext new-result payloads, sentinel summary, null raw score/confidence; detailed weekly distributions no longer persist. Function execute remains service-only. Safety severity stays as a documented plaintext index. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920011000_analysis_admission_budgets.sql | Persisted AI quotas | ai_analysis.quota_policy; analysis_requests; enforce_admission_budget trigger; created/user index | RLS policy table, runtime read-only budget, serialized global/user daily/outstanding enforcement; now() default and server-owned admitted timestamp. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920012000_journal_read_scope.sql | Owner journal/draft read path | journal_service.journals; journal_drafts | Authenticated schema usage and SELECT only; existing owner policies apply; no new browser write grant. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920013000_atomic_trusted_contacts.sql | Atomic primary-contact save | user_service.save_trusted_contact; trusted_contacts | Invoker derives owner from auth.uid(), validates inputs, locks per owner and checks target ownership before primary changes. Execute authenticated only, not anonymous/service_role. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920014000_experience_read_scope.sql | Owner experience reads | buddy_service.buddy_conversations/buddy_messages; grounding_service.grounding_sessions; user_service.user_consents | Authenticated usage/SELECT for the specific owner-policy-protected read paths, without authorizing assistant-message or consent writes. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920015000_private_data_exports.sql | Encrypted and audited export lifecycle | user_service.export_artifacts; data_export_requests; audit_events; collect_user_export, begin_data_export, finish_data_export, consume_data_export, expire_data_exports | RLS private ciphertext table with expiry/admission indexes; fixed 62-collection owner/parent-owner snapshot definer; service-only lifecycle invokers; counts/size bounds; atomic audit; one-use download and expiry. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920016000_disabled_account_sessions.sql | Inactive-account denial | user_service.security_session_active; profiles.account_status | Replaces session bridge to require active account as well as matching unexpired Auth session. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920017000_session_bound_data_policies.sql | Data API/Storage session enforcement | public.security_request_active; all 87 app tables; storage.objects | Uses auth.uid() and signed session_id; adds RESTRICTIVE authenticated all-action policy alongside existing policies; helper execute authenticated/service only. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260920018000_wellness_assessment_ciphertext.sql | Encrypted PHQ-8 writes and export support | insights_service.phq8_assessments; save_encrypted_phq8; old save_phq8/score trigger/constraint; user_service.collect_user_export | Adds ciphertext, makes legacy raw fields nullable and requires null raw fields on new/changed rows; removes old score trigger/constraint; revokes old plaintext save; new service-only save preserves retry/due-window locking; includes ciphertext in export snapshot. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260921010000_wellness_ciphertext_rotation.sql | PHQ-8 CAS migration | insights_service.replace_assessment_ciphertext; phq8_assessments | Service-only invoker binds id/user/submission and every old value, updates ciphertext and clears raw answers/score/severity only on a matching snapshot. | Local creation + isolated replay PASS; remote NOT APPLIED |
| 20260921011000_atomic_deletion_requests.sql | Audited request/cancel transaction | user_service.request_account_deletion; cancel_account_deletion; account_deletion_requests; audit_events | Service-only invokers use owner locks, reuse an active request, schedule with now()+30 days, restrict cancellation to owner pending requests, and atomically append audit. No account-erasure worker is added. | Local creation + isolated replay PASS; remote NOT APPLIED |

NOT VALID constraints preserve historical rows for review while enforcing new/changed rows. They do not prove historical ownership or encryption coverage. Encrypted-only readers require the documented historical backfill before deployment; otherwise old content can fail closed. Private bucket definitions and restrictive policies also remain unapplied remotely.

## 3. NEW SECURITY TESTS

**31 new test files** were identified as new/untracked in the final worktree: 13 backend Vitest files, 3 frontend Vitest files, 14 SQL files and 1 Node test. The passing result below is grounded in the recorded final run that included the file, not a new test run for this documentation request.

| New test file | Main behavior / attack cases | Final recorded result |
| --- | --- | --- |
| backend/src/features/registration/__tests__/registration.enumeration.test.ts | Neutral duplicate-account responses for known provider duplicate codes; unexpected provider diagnostics hidden. | PASS — included in 276 backend tests |
| backend/tests/security/analysis-result-encryption.test.ts | Structured result encrypt/decrypt round trip; raw detail absent from persistence parameters; plaintext fallback, invalid result and wrong-key rejection. | PASS — included in 276 backend tests |
| backend/tests/security/api-hardening.test.ts | Hostile/exact origins, preflight methods, spoofed proxy headers, correlated safe 400/413 errors and headers, actor rate limits and unsafe origin aliases. | PASS — included in 276 backend tests |
| backend/tests/security/data-export.test.ts | Encrypt-before-persist, owner/request binding, one-use consume, decryption without key metadata, clean/quarantined attachment rules, foreign path rejection and storage-failure handling. | PASS — included in 276 backend tests |
| backend/tests/security/image-validation.test.ts | Real image decoding across supported formats; EXIF/trailing-data removal; forged/truncated/MIME mismatch rejection; dimensions/frames limits; bounded animation; reject before DB/Storage. | PASS — included in 276 backend tests |
| backend/tests/security/outbound-json.test.ts | Approved exact URLs, unsafe IPv4/IPv6/host/address rejection, DNS pinning with TLS host checks, mixed public/private DNS, no redirects, byte/deadline bounds. | PASS — included in 276 backend tests |
| backend/tests/security/redaction.test.ts | Nested/camel-case credentials, cookies, Restricted content, bearer/JWT values and cyclic objects are scrubbed safely. | PASS — included in 276 backend tests |
| backend/tests/security/runtime-audit.test.ts | Hot-reloaded emergency settings, malformed control failure, and denial audit payloads that omit request content, credentials and supplied URLs. | PASS — included in 276 backend tests |
| backend/tests/security/session-verifier.test.ts | Wrong/expired issuer/audience/role/time/session claims, Auth rejection, revoked session/DB outage, verified assurance, refresh-vs-recent-auth and MFA/recent gates. | PASS — included in 276 backend tests |
| backend/tests/security/storage-encryption.test.ts | Opaque authenticated Buddy envelopes without plaintext fallback; document MIME/size checks; default quarantine; denied reviewer access; clean digest/version/decoded metadata; scanner outage/active content. | PASS — included in 276 backend tests |
| backend/tests/security/text-migration.test.ts | Dry-run no writes; plaintext encryption and approved old-key rotation; round-trip; already-current idempotency; tampering and CAS conflicts without overwrite. | PASS — included in 276 backend tests |
| backend/tests/security/wellness-encryption.test.ts | Server scoring and ciphertext-only persistence parameters; invalid answers, changed retries, owner/submission substitution, incorrect score and tampered ciphertext. | PASS — included in 276 backend tests |
| backend/tests/security/wellness-migration.test.ts | Historical encryption/rotation, dry-run counts, current-key idempotency, corrupt/mixed/foreign payload rejection and concurrent-change conflict reporting. | PASS — included in 276 backend tests |
| frontend/src/infrastructure/security/clear-sensitive-state.test.ts | Clears recognized sensitive keys from both browser storage areas while preserving UI preferences. | PASS — included in 376 frontend tests |
| frontend/src/infrastructure/security/private-session-boundary.test.tsx | Same-account refresh preserved; logout/account change removes old UI and caches; clear-event handling; pagehide/restored snapshot; observer failure/cleanup. | PASS — included in 376 frontend tests |
| frontend/src/services/authentication/reviewer-mfa.test.ts | Verified factor reuse, TOTP enrollment cleanup limited to this flow, fail-closed assurance, no redundant aal2 enrollment, code validation and safe provider errors. | PASS — included in 376 frontend tests |
| scripts/security-project-target.test.mjs | Only exact authorized HTTPS project origin accepted; alternate targets/credentials/URL suffixes rejected. | PASS — 1 Node test |
| supabase/tests/database/security-account-integrity.sql | Nonexistent owners, foreign-parent feedback, stale and valid ciphertext CAS, account/message cascades and preservation of unrelated account. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-ai-budgets.sql | Per-user/global daily/outstanding quotas, opposite session timezones, caller backdating and runtime policy-budget mutation denial. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-baseline.sql | Private schema/browser grants, RLS coverage, audit mutation denial, private buckets, private definer RPC denial and role/direct-write escalation attempts. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-contact-transactions.sql | Foreign-owner save denial without demoting existing primary, permission acknowledgement, atomic primary switch, other-owner preservation and anonymous RPC denial. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-deletion-requests.sql | Request retry deduplication, timezone-stable schedule, same-transaction audit, foreign/repeated/processing cancellation denial, audit-failure rollback and direct-browser RPC denial. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-experience-isolation.sql | Two-user conversation/message/grounding/consent isolation; known foreign ID read denial; assistant forgery, consent overwrite and direct grounding deletion denied. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-export-lifecycle.sql | Owner snapshot, admission concurrency, wrong-owner finalize/consume, plaintext artifact rejection, incomplete generation, one-use replay, audit, expiry cleanup and privileged RPC/artifact denial. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-journal-isolation.sql | Two-user journal/draft reads; foreign IDs; direct encryption-key mutation, deletion and draft-state writes denied. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-notification-isolation.sql | Foreign-owner read/update denial, permitted owner read_at update, owner/message rewriting and delete/anonymous access denial. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-public-boundaries.sql | Legacy public RLS/grant closure and denial of anonymous access, projection mutation, Buddy/profile bypass and legacy private-data reads. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-session-data-access.sql | Missing, mismatched, expired/revoked and inactive-account session restrictions on notification/Storage access and owner writes. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-session-lifecycle.sql | Valid session accepted; foreign, expired/revoked and inactive-account session denied; private session inventory inaccessible. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-settings-isolation.sql | Two-user profile/contact isolation; own update; foreign edit/delete; protected eligibility/account/contact flags, owner reassignment, audit forgery and deletion-state writes denied. | PASS — included in 18 SQL suites |
| supabase/tests/database/security-wellness-migration.sql | Actual service-role encrypted save; historical row migration, wrong-owner/stale CAS denial, raw-field clearing/original timestamp preservation and browser RPC denial. | PASS — included in 18 SQL suites |

### Existing test files modified in this pass

These **17 files are not new suites**. Some add assertions; others adapt fixtures to the changed assurance/encryption contract while preserving regression coverage. The complete existing contents are not all claimed as new security cases.

| Modified test file | Observed scope / changes | Final recorded result |
| --- | --- | --- |
| backend/src/features/journals/__tests__/ciphertext-backfill.service.test.ts | Existing encrypted title authority, no overwrite, missing-title backfill/sentinel, resumability, tamper coverage failure and concurrent-edit CAS. | PASS — included in backend run |
| backend/src/features/journals/__tests__/encryption.service.test.ts | Unique-IV AES-GCM round trips, key/tamper rejection and approved old/current-key version behavior. | PASS — included in backend run |
| backend/src/features/onboarding/__tests__/onboarding.routes.test.ts | Authenticated status/consent and malformed profile input rejected before service. | PASS — included in backend run |
| backend/src/features/registration/__tests__/registration.routes.test.ts | Untrusted-origin denial, secure path-scoped HttpOnly draft/CSRF cookie behavior and pre-auth request limiting; updated fixtures reflect new policy. | PASS — included in backend run |
| backend/src/features/settings/__tests__/settings.routes.test.ts | Authenticated/validated settings routes; file/password/UUID/query bounds; added uncached export download, exact owner, stale-auth and unauthenticated denial cases. | PASS — included in backend run |
| backend/src/features/settings/__tests__/settings.service.avatar.test.ts | Real sanitized image path and safe Storage-specific 503 response. | PASS — included in backend run |
| backend/src/features/settings/__tests__/settings.service.password.test.ts | Current-password identity/session verification before admin update, global revocation invocation and invalid-password rejection. | PASS — included in backend run |
| backend/src/features/verification/__tests__/verification.routes.additional.test.ts | Authenticated verification/admin routes with supported protected document payloads and updated assurance fixtures. | PASS — included in backend run |
| backend/src/features/verification/__tests__/verification.routes.test.ts | Authentication failure, supported document body and adult application validation with assurance updates. | PASS — included in backend run |
| backend/tests/security/mass-assignment.test.ts | Injected journal owners/privileged fields stripped, strict privacy/review escalation fields rejected, verified owner passed to service. | PASS — included in backend run |
| backend/tests/security/uuid-validation.test.ts | Malformed journal/contact/deletion/admin IDs rejected and valid UUID preserved; authenticated/assurance fixture updates. | PASS — included in backend run |
| frontend/src/features/authentication/view/__tests__/admin-login-view.test.tsx | Backend reviewer authorization, invalid/network/simulated-login denial, no public admin registration and added MFA invalid-code retry. | PASS — included in frontend run |
| frontend/src/proxy.test.ts | Safe internal redirect/config failure behavior and added renderer/response nonce consistency. | PASS — included in frontend run |
| frontend/src/services/authentication/auth.supabase-adapter.test.ts | Existing OTP/session persistence/logout tests retained; neutral duplicate-signup behavior and session cleanup updates. | PASS — included in frontend run |
| frontend/src/services/settings/settings.service.test.ts | Existing settings endpoints retained; added authenticated no-store export fetch without URL token and safe consumed/expired-export errors. | PASS — included in frontend run |
| supabase/tests/database/journal-analysis-transactions.test.sql | Existing transactional job tests adapted to encrypted result payload contract; local transaction/analysis behavior preserved. | PASS — included in SQL replay |
| supabase/tests/database/wellness-security-and-lifecycle.sql | Encrypted PHQ-8 storage/due/retry/history contract replaces raw-score persistence assertions; existing journal image lifecycle and foreign ownership cases retained. | PASS — included in SQL replay |

### Test coverage limits

- Two-user/IDOR/BOLA evidence exists for the named owner/parent paths in SQL and selected routes; a complete real two-user endpoint suite was not run.
- Authentication/MFA failures, role/protected-column escalation, RLS, AES-GCM tampering, CORS, proxy spoofing, rate limits, input/mass assignment, SSRF, browser state, file checks, redaction and export/request-cancellation have the exact tests above.
- Browser-state/nonce tests are not a comprehensive XSS/CSRF scan. jsdom does not navigate real documents.
- Transport/result-schema tests are not adversarial prompt/tool-boundary tests. No dedicated semantic prompt-injection/tool-execution suite was added.
- Deletion tests cover request/cancel/audit and selected relational integrity, not end-to-end account erasure across all stores/providers/backups.
- Scanner tests use synthetic adapters; they do not prove malware detection by a deployed scanner.
- Exactly how many **individual test cases** were newly added across parameterized tests and modified pre-existing files is **Not reliably determined** from retained output. File counts and final full-run counts are provable and are reported separately.

## 4. FINAL TEST RESULTS

These are the final recorded implementation validations, not newly rerun application tests for this documentation-only request. Targeted runs overlap the full suite and must not be double-counted.

| Outcome | Exact command | Exact observed result | Qualification |
| --- | --- | --- | --- |
| PASS | npm run typecheck | Frontend and backend passed. | Final implementation run; not rerun for this documentation-only request. |
| PASS + WARNING | npm run lint | 0 errors; 66 frontend + 30 backend warnings = 96. | Warnings are retained; no waiver implied. |
| PASS + WARNING | npm test | Frontend 376 tests / 81 files; backend 276 tests / 48 files. Total application tests: 652. | jsdom reports navigation to another Document is not implemented; this limits real-navigation evidence. |
| PASS | npm run build | Contracts, Next 16.3.5 frontend and TypeScript backend build passed. | No deployment; original user next-env.d.ts dev-type import restored after build. |
| PASS | npm run test:sql:isolated -- --catalog | 18 SQL suites passed; catalog written: 87 tables, 62 functions, 207 application-table policies. | Actual invocation includes --catalog. Synthetic PGlite, not remote Supabase. |
| PASS | npm run check:auth-policy | Supabase/backend/frontend password policy alignment passed. | Static policy check, not a live hosted Auth configuration check. |
| PASS | node --test scripts/security-project-target.test.mjs | 1 test passed, 0 failed, skipped or cancelled. | No remote connection. |
| PASS | node scripts/security-query-boundaries.mjs | 128 queries checked; 0 findings. | AST explicit-schema boundary check. |
| PASS | npm audit --audit-level=high | 0 vulnerabilities. | At the recorded dependency/registry checkpoint. |
| PASS | node scripts/security-scan.mjs --bundle | 1080 tracked/untracked paths; 0 findings. | Before creating this new report; do not inflate that historical path count. Source/bundle pattern scan only. |
| PASS + WARNING | git diff --check | Exit 0; no whitespace errors. | LF-to-CRLF conversion notices. Also rerun during this documentation review with exit 0. Untracked files are not covered by git diff. |
| PASS | npm run test -w backend -- tests/security/wellness-migration.test.ts tests/security/wellness-encryption.test.ts | 16 tests / 2 files passed. | Included in the later 276-test backend run; do not add twice. |
| PASS + WARNING | npm run test -w frontend -- src/infrastructure/security/private-session-boundary.test.tsx src/infrastructure/security/clear-sensitive-state.test.ts | 8 tests / 2 files passed. | Included in the later 376-test frontend run; jsdom navigation warnings. |

### PASS

All final commands in the table completed successfully. Application tests total 652; the separate project-target Node test adds one individually reported test. The 18 SQL suites are reported separately because their assertion count was not captured as individual test cases.

### WARNING

- Quantified lint warnings: **96** (66 frontend, 30 backend); zero lint errors.
- jsdom emits document-navigation warnings in the frontend run/targeted boundary tests.
- Git emits LF-to-CRLF conversion notices for working files.
- A combined count of every warning across repeated/targeted/full/tool runs is **Not reliably determined**. Do not present 96 as the grand total of every warning emitted during the work.

### FAIL

**0 failed checks in the final recorded validation set.** Earlier failures were fixed and rerun: timezone-shifted quota timestamps; SQL test dollar quoting; obsolete PHQ-8 plaintext score constraint permission; and earlier export/contact/image fixture issues recorded in SECURITY_TEST_EVIDENCE.md. No failing check was skipped to manufacture a passing final set.

### NOT RUN

Remote migration application; real Supabase/PostgREST/Storage/Realtime checks; real browser/CSP/CSRF/session end-to-end probes; external provider/malware/KMS validation; dedicated adversarial prompt/tool tests; local full-history gitleaks execution; GitHub Actions execution verification; DAST/independent penetration testing; live backfill; real account export/deletion; key/credential/restore/tabletop/revocation/kill-switch drills; production deployment.

### BLOCKED

Hosted-service and operational assurance require the external access/configuration/approvals in section 5. Complete account erasure, remaining encryption/least-privilege/type generation and several integration tests remain engineering gaps, not merely manual toggles. A prior automatic approval-review usage-limit block was resolved before the final successful runs; it is not an outstanding failed test.

### Documentation-only inspection commands

This request inspected `git status --porcelain=v1 --untracked-files=all`, `git diff --numstat`, targeted `git diff -- <paths>`, existing source/migrations/tests and recorded evidence, and reran `git diff --check` successfully. No source changes or new application-test claims are made for this request.

## 5. MANUAL / EXTERNAL ACTIONS STILL REQUIRED

The table defines **30 grouped, outstanding manual/external work items**. Suggested roles are not claims that a named owner has accepted the work. Items involving provider integration can also require engineering; a console configuration alone cannot close them.

| ID | Action | Suggested owner | What must be done | Exactly why it remains manual/external |
| --- | --- | --- | --- | --- |
| M01 | Confirm new non-production Supabase project | Wine/platform owner | Confirm ownership, environment classification and exact allowed project before any connection. | Local URL matches do not prove account ownership, environment purpose or remote state; the legacy project is prohibited. |
| M02 | Review/apply the 20 remote migrations | Database/platform owner | Compare remote migration history, inspect a guarded dry run, take approved recovery precautions and apply only to approved non-production first. | No Supabase CLI link/history, credentials-based remote review or migration execution evidence exists. |
| M03 | Validate historical constraints and ciphertext coverage | Database/security owner | Review NOT VALID constraints, reconcile historical owner/parent issues and approve per-store backfill/validation. | Synthetic new-write tests cannot certify existing remote records; migration may affect real sensitive data. |
| M04 | Run real RLS/PostgREST/Storage/Realtime checks | Backend/platform owner | Use two synthetic users plus anon/reviewer roles against the approved deployed environment; test every intended action. | PGlite Auth/Storage scaffolding cannot reproduce hosted API exposure or deployed permission behavior. |
| M05 | Activate and enroll reviewer MFA | Identity owner | Configure provider MFA and enroll reviewers; exercise sign-in, challenge, recovery and lost-factor handling. | Requires hosted Auth settings and human factor enrollment; mocked SDK tests cannot enroll a real person. |
| M06 | Review hosted Auth abuse and recovery settings | Identity owner | Confirm password/recovery policy, session lifetime, email/OAuth redirects, enumeration/rate controls and email assurance. | These are project/provider settings outside repository enforcement. |
| M07 | Provision separate staging/production secrets | Platform owner | Use isolated publishable/service, encryption, signing/idempotency, worker and future provider/scanner secrets; verify access separation. | Secret issuance/access policies require operator accounts and must not be invented or printed in a report. |
| M08 | Set up managed secret/KMS storage | Platform/security owner | Choose approved store, least-privilege identities, access logging and protected recovery of required old key versions. | Only backend environment-key loading exists; cloud account/policy choices are external. |
| M09 | Approve/exercise encryption rotation and retirement | Security/database owner | Run controlled synthetic key transition and restore compatibility, reconcile every encrypted store, and approve old-key retirement timing. | Unit rotation tests are not a live data/key change; existing-data and backup key needs require human authorization. |
| M10 | Connect a real malware/PDF scanner | Platform/privacy owner | Approve a scanner, retention/no-training settings and credentials; implement/validate its adapter and clean evidence in staging. | Default scanner only quarantines. Provider selection/settings and adapter integration remain required; there is no real clean-scan service. |
| M11 | Approve AI provider privacy configuration | Privacy/AI owner | Confirm training opt-out, retention, region, access, sub-processors, contracts and permitted input categories before enabling. | No production provider agreement or console evidence was obtained. |
| M12 | Establish provider erasure/receipt workflow | Privacy/AI owner | Confirm deletion support and retention limits, implement receipt handling and test it with the account-erasure workflow. | The provider workflow and full erasure worker are not implemented; external APIs/agreements and additional engineering are needed. |
| M13 | Set GitHub branch protection/review rules | Repository administrator | Require reviewed PRs and restrict bypass/admin permissions appropriately. | Organization/repository settings require administrator access and were not changed. |
| M14 | Configure required CI checks and release approvals | Repository administrator | Choose required tests, protect deployment environments and verify workflow execution/artifact retention. | A workflow file alone does not make a check required or prove GitHub has executed it. |
| M15 | Review CI action trust/history scan | Repository/security owner | Review/pin action versions according to policy and run/inspect full-history gitleaks evidence. | Current actions use tags; no local history scan or remote Actions execution was observed. |
| M16 | Configure production/staging CORS origins | Platform owner | Set exact frontend origins per environment and verify actual browser preflights/credentials. | Final deployment hostnames/configuration were not supplied or exercised. |
| M17 | Configure reverse-proxy trust | Platform owner | Set actual ingress IP/CIDR trust and test forwarded-header spoofing through the deployed proxy. | Only the deployment operator can confirm network topology and proxy header handling. |
| M18 | Verify HTTPS/TLS and deployed headers | Platform/security owner | Install/validate certificates and transport policy for browser, backend, Supabase and internal worker, then inspect live headers/CSP. | Code URL checks and build success are not a TLS scan or a deployed browser trace. |
| M19 | Run real browser lifecycle/CSRF/CSP tests | Frontend/security owner | Exercise account switching, multiple tabs, back-forward cache, logout/recovery, cookie behavior, CSRF and network/storage inspection. | jsdom navigation is unimplemented; SDK tests do not verify a real browser/provider session. |
| M20 | Connect a monitoring/retention platform | Operations owner | Ship metadata-only events securely with access controls, durable retention and tamper protection. | Current hooks write DB/console signals; no external collector/archive was provisioned. |
| M21 | Configure and drill alerts/on-call routing | Operations/security owner | Approve thresholds, destinations, escalation and audit-delivery/AI-budget/scanner alerts; exercise delivery. | Runbook thresholds are proposals and no active alert platform or recipient ownership was established. |
| M22 | Configure encrypted database/object backups | Platform/privacy owner | Select backup services, credentials, encryption, separate key recovery, job monitoring and approved retention/RPO/RTO. | Database/object backup infrastructure and approval are absent; documentation is preparation only. |
| M23 | Perform an isolated restore drill | Platform/database owner | Restore approved synthetic data/objects/keys into isolated non-production and verify decryption, permissions and deletion handling. | No actual restore ran; deletion-tombstone replay additionally depends on unfinished erasure engineering. |
| M24 | Approve incident owners and run a tabletop | Security/privacy owner | Name responders and communications approver, establish contacts and rehearse detection/containment/recovery. | Requires people, escalation decisions and recorded human participation. |
| M25 | Perform service/worker/CI credential rotation drill | Platform/security owner | Replace and revoke test credentials through approved stores; verify integrations and access logs. | No live credential change was authorized/performed; external issuers and operators are required. |
| M26 | Perform hosted session revocation drill | Identity/security owner | Exercise global sign-out, password change and account disable with existing tokens in browser/API/Storage flows. | Local session rows/mocks cannot prove hosted Auth revocation behavior. |
| M27 | Distribute and drill AI/upload kill switches | Operations/AI owner | Configure ECHO_SECURITY_CONTROLS_FILE on every instance, replace atomically and test fail-closed behavior across replicas/workers. | No file means enabled defaults; operator distribution and live multi-instance exercise are external. |
| M28 | Approve privacy notice, retention and evidence exceptions | Privacy/legal/team owner | Approve purpose/notice/consent wording, retention durations, export exclusions/large-account delivery and deletion/audit/backup exceptions. | These policy/legal decisions are not established by code or engineering draft tables. |
| M29 | Run independent security review/pentest | Independent reviewer and team | Assess deployed staging, including BOLA/RLS, auth recovery, SSRF, XSS, file handling and provider/prompt/tool boundaries; remediate and retest. | No independent reviewer, penetration test or DAST evidence exists; implementation tests are not independence. |
| M30 | Authorize production release | Release owner | Close engineering/security/policy gates, review evidence and obtain explicit release approval. | Production deployment was prohibited and unmet local/external controls remain; no automated readiness claim is valid. |

### Remaining engineering — not disguised as manual setup

The user ended the implementation pass, but these six grouped engineering gaps are still recorded in the actual repository. They should remain visible in the thesis limitations and team backlog.

| ID | Engineering gap | Observed missing work |
| --- | --- | --- |
| E01 | Complete account-erasure/retention implementation | Request/cancel is implemented; retryable database/object/cache/provider erasure, durable receipts/tombstones, restoration replay and all-store synthetic tests are not. |
| E02 | Complete Restricted-data encryption and historical analysis migration | New protected payloads exist; historical analysis backfill/rotation and remaining safety/index/journal metadata/projections still require implementation. Buddy/PHQ-8 tooling exists but has not been run against data. |
| E03 | Finish least-privilege service separation | Remaining ordinary writes and analysis/wellness/verification paths need reviewed user/admin boundaries and complete two-user endpoint tests. |
| E04 | Generate/verify complete database types | Existing backend database.types.ts is still a skeleton. No complete generated Supabase types were produced or counted as changed. |
| E05 | Complete browser/provider/prompt security evaluation and missing integrations | Dedicated prompt/tool attack tests, real scanner/provider adapters, live browser/CSRF/session tests and end-to-end deployment evidence remain absent. |
| E06 | Complete bounded-export exception path and durable audit operations | Large-account delivery, full provider coverage, remaining mandatory workflow audit/outbox and operational collector/alert integration need further work. |

## 6. FILES CHANGED

At the start of this documentation request, Git listed **166 changed/untracked paths**. Four documented pre-existing user-owned files are excluded below, leaving **162 security-pass files: 88 created, 73 modified, 1 deleted**. This handoff adds **one documentation file only**, so the delivered security-related inventory is **163 files: 89 created, 73 modified, 1 deleted**. These are worktree changes, not committed or Git-staged changes.

Files are grouped without duplication. Tests are grouped under Tests regardless of frontend/backend location; package/environment/security configuration files are grouped under Configuration.

### Frontend

**Created (3)**

| Exact file | Why changed / created / removed |
| --- | --- |
| frontend/src/infrastructure/security/clear-sensitive-state.ts | Session cleanup, neutral authentication errors and private browser-state invalidation. |
| frontend/src/infrastructure/security/private-session-boundary.tsx | Removes private mounted UI and browser/router state across account/session transitions. |
| frontend/src/services/authentication/reviewer-mfa.ts | Reviewer TOTP enrollment/challenge and assurance flow. |

**Modified (13)**

| Exact file | Why changed / created / removed |
| --- | --- |
| frontend/src/app/(onboarding)/layout.tsx | Removes private mounted UI and browser/router state across account/session transitions. |
| frontend/src/app/(protected)/layout.tsx | Removes private mounted UI and browser/router state across account/session transitions. |
| frontend/src/features/authentication/view/admin-login-view.tsx | Reviewer TOTP enrollment/challenge and assurance flow. |
| frontend/src/features/journal/components/index.ts | Removes the deleted plaintext draft-manager public export. |
| frontend/src/features/journal/components/journal-autosave.tsx | Replaces localStorage save/load with an asynchronous persistence callback and safe timer cleanup. |
| frontend/src/features/settings/components/export-data.tsx | Encrypted account export generation, recent-authenticated delivery and client download lifecycle. |
| frontend/src/features/settings/model/settings.model.ts | Adds delivered/expired export statuses to the client model. |
| frontend/src/features/settings/view/settings-views.tsx | Connects export download/history refresh behavior to the settings views. |
| frontend/src/infrastructure/api/supabase-auth-token-provider.ts | Session cleanup, neutral authentication errors and private browser-state invalidation. |
| frontend/src/proxy.ts | CSP nonce propagation and browser security headers. |
| frontend/src/services/authentication/auth.supabase-adapter.ts | Session cleanup, neutral authentication errors and private browser-state invalidation. |
| frontend/src/services/settings/settings.mock-adapter.ts | Keeps mock export history/status behavior consistent with the new UI contract. |
| frontend/src/services/settings/settings.service.ts | Adds bearer-authenticated no-store export download and PDF authorization API calls. |

**Deleted (1)**

| Exact file | Why changed / created / removed |
| --- | --- |
| frontend/src/features/journal/components/journal-draft-manager.tsx | Deletes obsolete component that persisted private drafts in browser storage. |

### Backend

**Created (14)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/scripts/buddy-ciphertext-backfill.mts | Bounded local-only or reusable ciphertext backfill/rotation with fail-closed validation. |
| backend/scripts/wellness-ciphertext-backfill.mts | Bounded local-only or reusable ciphertext backfill/rotation with fail-closed validation. |
| backend/src/features/settings/data-export.service.ts | Encrypted account export generation, recent-authenticated delivery and client download lifecycle. |
| backend/src/infrastructure/encryption/analysis-result-encryption.ts | Authenticated versioned encryption and protected read/write validation. |
| backend/src/infrastructure/encryption/text-migration.ts | Bounded local-only or reusable ciphertext backfill/rotation with fail-closed validation. |
| backend/src/infrastructure/encryption/wellness-migration.ts | Bounded local-only or reusable ciphertext backfill/rotation with fail-closed validation. |
| backend/src/infrastructure/security/document-scanner.ts | Quarantine, clean-evidence checks, privileged assurance and verification workflow protection. |
| backend/src/infrastructure/security/image-validation.ts | Bounded image validation/re-encoding and private object handling. |
| backend/src/infrastructure/security/outbound-json.ts | Bounded allowlisted HTTPS transport, DNS pinning and redirect denial. |
| backend/src/infrastructure/security/runtime-controls.ts | Runtime emergency controls for AI/uploads and safe example configuration. |
| backend/src/infrastructure/supabase/supabase-user.client.ts | Verified request-JWT client without administrative fallback. |
| backend/src/shared/middleware/assurance.middleware.ts | Managed Auth verification, live session/account validation and recent-auth/MFA gates. |
| backend/src/shared/middleware/security-audit.middleware.ts | Metadata-only logs/audit and secret/URL/content redaction. |
| backend/src/shared/middleware/security-policy.ts | Security middleware, request context, route wiring or typed authorization integration. |

**Modified (36)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/scripts/validate-analysis-sql.mjs | Expands synthetic Auth/Storage scaffolding, selected SQL suites and reproducible catalog of columns/grants/policies/functions/triggers/constraints. |
| backend/src/app.ts | Orders request context/security middleware; exact-origin/method rejection, explicit trust proxy, safe limits and runtime controls. |
| backend/src/features/access/access.service.ts | Uses a request-user client for ordinary account/access status reads. |
| backend/src/features/analysis/local-worker.routes.ts | Makes worker DTO strict and adds 60/minute route limiting. |
| backend/src/features/analysis/local-worker.service.ts | Adds AI kill-switch check at claim and encrypts validated final results before completion RPC; existing lease/protocol retained. |
| backend/src/features/experience/experience.controller.ts | Protected encrypted data handling, owner-scoped reads, strict inputs and consent/assurance gates. |
| backend/src/features/experience/experience.routes.ts | Protected encrypted data handling, owner-scoped reads, strict inputs and consent/assurance gates. |
| backend/src/features/experience/experience.service.ts | Adds encrypted Buddy storage/reads, selected user-JWT read paths, runtime AI gate and injected wellness encryption. |
| backend/src/features/experience/wellness.service.ts | Validates/scores PHQ-8 on server, encrypts answers/score/severity with owner/submission binding and verifies decrypted history/retries. |
| backend/src/features/journals/ciphertext-backfill.service.ts | Bounded local-only or reusable ciphertext backfill/rotation with fail-closed validation. |
| backend/src/features/journals/journal-images.service.ts | Bounded image validation/re-encoding and private object handling. |
| backend/src/features/journals/journals.controller.ts | Protected encrypted data handling, owner-scoped reads, strict inputs and consent/assurance gates. |
| backend/src/features/journals/journals.routes.ts | Protected encrypted data handling, owner-scoped reads, strict inputs and consent/assurance gates. |
| backend/src/features/journals/journals.service.ts | Adds selected user-scoped reads, encrypted AI result completion/decryption and in-memory aggregate calculation with runtime controls. |
| backend/src/features/notifications/notifications.service.ts | Uses a request-user client for ordinary owner-scoped notification operations. |
| backend/src/features/onboarding/onboarding.controller.ts | Ordinary account operations use verified owner-scoped database clients and validated inputs. |
| backend/src/features/onboarding/onboarding.service.ts | Uses a request-user client for normal profile/consent reads while retaining necessary administrative paths. |
| backend/src/features/registration/registration.service.ts | Uses a fresh public Auth-client factory and neutral duplicate-signup/safe error responses. |
| backend/src/features/settings/settings.controller.ts | Owner-scoped settings, safe password/avatar flows, export delivery and atomic privacy request integration. |
| backend/src/features/settings/settings.routes.ts | Owner-scoped settings, safe password/avatar flows, export delivery and atomic privacy request integration. |
| backend/src/features/settings/settings.service.ts | Separates normal user reads/writes from administrative operations; adds safe avatar/password handling, atomic contact/privacy RPC calls, PDF authorization and account export integration. |
| backend/src/features/verification/verification.controller.ts | Quarantine, clean-evidence checks, privileged assurance and verification workflow protection. |
| backend/src/features/verification/verification.routes.ts | Quarantine, clean-evidence checks, privileged assurance and verification workflow protection. |
| backend/src/features/verification/verification.service.ts | Quarantine, clean-evidence checks, privileged assurance and verification workflow protection. |
| backend/src/infrastructure/ai/ai.client.ts | Bounded allowlisted HTTPS transport, DNS pinning and redirect denial. |
| backend/src/infrastructure/encryption/encryption.service.ts | Authenticated versioned encryption and protected read/write validation. |
| backend/src/infrastructure/supabase/resilient-fetch.ts | Bounded requests, redirects disabled and retries restricted to safe methods. |
| backend/src/infrastructure/supabase/supabase-admin.client.ts | Managed Auth verification, live session/account validation and recent-auth/MFA gates. |
| backend/src/infrastructure/supabase/supabase-diagnostics.ts | Metadata-only logs/audit and secret/URL/content redaction. |
| backend/src/server.ts | Wires separate user/admin/Auth/background clients, keyring, export service/expiry and metadata audit sink. |
| backend/src/shared/middleware/auth.middleware.ts | Managed Auth verification, live session/account validation and recent-auth/MFA gates. |
| backend/src/shared/middleware/error.middleware.ts | Security middleware, request context, route wiring or typed authorization integration. |
| backend/src/shared/middleware/request-logger.middleware.ts | Metadata-only logs/audit and secret/URL/content redaction. |
| backend/src/shared/request-context.ts | Stores and retrieves the verified bearer in request-local AsyncLocalStorage context. |
| backend/src/shared/types/authenticated-user.ts | Carries verified session ID, assurance level and authentication time for downstream gates. |
| backend/src/shared/utils/redaction.ts | Metadata-only logs/audit and secret/URL/content redaction. |

### Supabase/migrations

**Created (20)**

| Exact file | Why changed / created / removed |
| --- | --- |
| supabase/migrations/20260917010000_security_privileges_and_integrity.sql | Revokes browser/default grants; enables RLS; pins missing definer search paths; revokes runtime audit mutation; removes dangerous write policies; adds owner composite FKs and verification state/MIME/size bounds; sets journal-images and verification-documents private. |
| supabase/migrations/20260917011000_security_session_lifecycle.sql | Service-only definer checks exact account/session and expiry; browser/anonymous execute revoked. |
| supabase/migrations/20260917012000_buddy_ciphertext_and_document_quarantine.sql | Adds NOT VALID encrypted-content constraint and scan status/time/version with clean-evidence constraints. |
| supabase/migrations/20260917013000_notification_user_scoping.sql | Authenticated schema usage and SELECT; UPDATE restricted to read_at, under owner RLS. |
| supabase/migrations/20260917014000_security_audit_events.sql | New RLS table; runtime SELECT/INSERT only; no browser access; bounded event/outcome/request/actor fields. |
| supabase/migrations/20260917015000_settings_user_scoping.sql | Explicit owner read and selected insert/update/delete grants; protected fields withheld; owner read policies for export/deletion history. |
| supabase/migrations/20260918010000_buddy_ciphertext_rotation.sql | Service-only invoker validates envelope/size and replaces only matching id, owner and SHA-256 old-content digest. |
| supabase/migrations/20260918011000_public_compatibility_lockdown.sql | Revokes legacy browser CRUD/sequence and default function execution; enables public-table RLS; regrants only authenticated projection SELECT. |
| supabase/migrations/20260918012000_account_ownership_integrity.sql | Adds missing auth.users FKs with ON DELETE CASCADE NOT VALID, message-owner uniqueness, feedback composite-owner FK and review parent FK. Existing FK behavior is preserved when present. |
| supabase/migrations/20260920010000_analysis_result_ciphertext.sql | Requires ciphertext new-result payloads, sentinel summary, null raw score/confidence; detailed weekly distributions no longer persist. Function execute remains service-only. Safety severity stays as a documented plaintext index. |
| supabase/migrations/20260920011000_analysis_admission_budgets.sql | RLS policy table, runtime read-only budget, serialized global/user daily/outstanding enforcement; now() default and server-owned admitted timestamp. |
| supabase/migrations/20260920012000_journal_read_scope.sql | Authenticated schema usage and SELECT only; existing owner policies apply; no new browser write grant. |
| supabase/migrations/20260920013000_atomic_trusted_contacts.sql | Invoker derives owner from auth.uid(), validates inputs, locks per owner and checks target ownership before primary changes. Execute authenticated only, not anonymous/service_role. |
| supabase/migrations/20260920014000_experience_read_scope.sql | Authenticated usage/SELECT for the specific owner-policy-protected read paths, without authorizing assistant-message or consent writes. |
| supabase/migrations/20260920015000_private_data_exports.sql | RLS private ciphertext table with expiry/admission indexes; fixed 62-collection owner/parent-owner snapshot definer; service-only lifecycle invokers; counts/size bounds; atomic audit; one-use download and expiry. |
| supabase/migrations/20260920016000_disabled_account_sessions.sql | Replaces session bridge to require active account as well as matching unexpired Auth session. |
| supabase/migrations/20260920017000_session_bound_data_policies.sql | Uses auth.uid() and signed session_id; adds RESTRICTIVE authenticated all-action policy alongside existing policies; helper execute authenticated/service only. |
| supabase/migrations/20260920018000_wellness_assessment_ciphertext.sql | Adds ciphertext, makes legacy raw fields nullable and requires null raw fields on new/changed rows; removes old score trigger/constraint; revokes old plaintext save; new service-only save preserves retry/due-window locking; includes ciphertext in export snapshot. |
| supabase/migrations/20260921010000_wellness_ciphertext_rotation.sql | Service-only invoker binds id/user/submission and every old value, updates ciphertext and clears raw answers/score/severity only on a matching snapshot. |
| supabase/migrations/20260921011000_atomic_deletion_requests.sql | Service-only invokers use owner locks, reuse an active request, schedule with now()+30 days, restrict cancellation to owner pending requests, and atomically append audit. No account-erasure worker is added. |

### Tests

**Created (31)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/src/features/registration/__tests__/registration.enumeration.test.ts | Neutral duplicate-account responses for known provider duplicate codes; unexpected provider diagnostics hidden. |
| backend/tests/security/analysis-result-encryption.test.ts | Structured result encrypt/decrypt round trip; raw detail absent from persistence parameters; plaintext fallback, invalid result and wrong-key rejection. |
| backend/tests/security/api-hardening.test.ts | Hostile/exact origins, preflight methods, spoofed proxy headers, correlated safe 400/413 errors and headers, actor rate limits and unsafe origin aliases. |
| backend/tests/security/data-export.test.ts | Encrypt-before-persist, owner/request binding, one-use consume, decryption without key metadata, clean/quarantined attachment rules, foreign path rejection and storage-failure handling. |
| backend/tests/security/image-validation.test.ts | Real image decoding across supported formats; EXIF/trailing-data removal; forged/truncated/MIME mismatch rejection; dimensions/frames limits; bounded animation; reject before DB/Storage. |
| backend/tests/security/outbound-json.test.ts | Approved exact URLs, unsafe IPv4/IPv6/host/address rejection, DNS pinning with TLS host checks, mixed public/private DNS, no redirects, byte/deadline bounds. |
| backend/tests/security/redaction.test.ts | Nested/camel-case credentials, cookies, Restricted content, bearer/JWT values and cyclic objects are scrubbed safely. |
| backend/tests/security/runtime-audit.test.ts | Hot-reloaded emergency settings, malformed control failure, and denial audit payloads that omit request content, credentials and supplied URLs. |
| backend/tests/security/session-verifier.test.ts | Wrong/expired issuer/audience/role/time/session claims, Auth rejection, revoked session/DB outage, verified assurance, refresh-vs-recent-auth and MFA/recent gates. |
| backend/tests/security/storage-encryption.test.ts | Opaque authenticated Buddy envelopes without plaintext fallback; document MIME/size checks; default quarantine; denied reviewer access; clean digest/version/decoded metadata; scanner outage/active content. |
| backend/tests/security/text-migration.test.ts | Dry-run no writes; plaintext encryption and approved old-key rotation; round-trip; already-current idempotency; tampering and CAS conflicts without overwrite. |
| backend/tests/security/wellness-encryption.test.ts | Server scoring and ciphertext-only persistence parameters; invalid answers, changed retries, owner/submission substitution, incorrect score and tampered ciphertext. |
| backend/tests/security/wellness-migration.test.ts | Historical encryption/rotation, dry-run counts, current-key idempotency, corrupt/mixed/foreign payload rejection and concurrent-change conflict reporting. |
| frontend/src/infrastructure/security/clear-sensitive-state.test.ts | Clears recognized sensitive keys from both browser storage areas while preserving UI preferences. |
| frontend/src/infrastructure/security/private-session-boundary.test.tsx | Same-account refresh preserved; logout/account change removes old UI and caches; clear-event handling; pagehide/restored snapshot; observer failure/cleanup. |
| frontend/src/services/authentication/reviewer-mfa.test.ts | Verified factor reuse, TOTP enrollment cleanup limited to this flow, fail-closed assurance, no redundant aal2 enrollment, code validation and safe provider errors. |
| scripts/security-project-target.test.mjs | Only exact authorized HTTPS project origin accepted; alternate targets/credentials/URL suffixes rejected. |
| supabase/tests/database/security-account-integrity.sql | Nonexistent owners, foreign-parent feedback, stale and valid ciphertext CAS, account/message cascades and preservation of unrelated account. |
| supabase/tests/database/security-ai-budgets.sql | Per-user/global daily/outstanding quotas, opposite session timezones, caller backdating and runtime policy-budget mutation denial. |
| supabase/tests/database/security-baseline.sql | Private schema/browser grants, RLS coverage, audit mutation denial, private buckets, private definer RPC denial and role/direct-write escalation attempts. |
| supabase/tests/database/security-contact-transactions.sql | Foreign-owner save denial without demoting existing primary, permission acknowledgement, atomic primary switch, other-owner preservation and anonymous RPC denial. |
| supabase/tests/database/security-deletion-requests.sql | Request retry deduplication, timezone-stable schedule, same-transaction audit, foreign/repeated/processing cancellation denial, audit-failure rollback and direct-browser RPC denial. |
| supabase/tests/database/security-experience-isolation.sql | Two-user conversation/message/grounding/consent isolation; known foreign ID read denial; assistant forgery, consent overwrite and direct grounding deletion denied. |
| supabase/tests/database/security-export-lifecycle.sql | Owner snapshot, admission concurrency, wrong-owner finalize/consume, plaintext artifact rejection, incomplete generation, one-use replay, audit, expiry cleanup and privileged RPC/artifact denial. |
| supabase/tests/database/security-journal-isolation.sql | Two-user journal/draft reads; foreign IDs; direct encryption-key mutation, deletion and draft-state writes denied. |
| supabase/tests/database/security-notification-isolation.sql | Foreign-owner read/update denial, permitted owner read_at update, owner/message rewriting and delete/anonymous access denial. |
| supabase/tests/database/security-public-boundaries.sql | Legacy public RLS/grant closure and denial of anonymous access, projection mutation, Buddy/profile bypass and legacy private-data reads. |
| supabase/tests/database/security-session-data-access.sql | Missing, mismatched, expired/revoked and inactive-account session restrictions on notification/Storage access and owner writes. |
| supabase/tests/database/security-session-lifecycle.sql | Valid session accepted; foreign, expired/revoked and inactive-account session denied; private session inventory inaccessible. |
| supabase/tests/database/security-settings-isolation.sql | Two-user profile/contact isolation; own update; foreign edit/delete; protected eligibility/account/contact flags, owner reassignment, audit forgery and deletion-state writes denied. |
| supabase/tests/database/security-wellness-migration.sql | Actual service-role encrypted save; historical row migration, wrong-owner/stale CAS denial, raw-field clearing/original timestamp preservation and browser RPC denial. |

**Modified (17)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/src/features/journals/__tests__/ciphertext-backfill.service.test.ts | Existing encrypted title authority, no overwrite, missing-title backfill/sentinel, resumability, tamper coverage failure and concurrent-edit CAS. |
| backend/src/features/journals/__tests__/encryption.service.test.ts | Unique-IV AES-GCM round trips, key/tamper rejection and approved old/current-key version behavior. |
| backend/src/features/onboarding/__tests__/onboarding.routes.test.ts | Authenticated status/consent and malformed profile input rejected before service. |
| backend/src/features/registration/__tests__/registration.routes.test.ts | Untrusted-origin denial, secure path-scoped HttpOnly draft/CSRF cookie behavior and pre-auth request limiting; updated fixtures reflect new policy. |
| backend/src/features/settings/__tests__/settings.routes.test.ts | Authenticated/validated settings routes; file/password/UUID/query bounds; added uncached export download, exact owner, stale-auth and unauthenticated denial cases. |
| backend/src/features/settings/__tests__/settings.service.avatar.test.ts | Real sanitized image path and safe Storage-specific 503 response. |
| backend/src/features/settings/__tests__/settings.service.password.test.ts | Current-password identity/session verification before admin update, global revocation invocation and invalid-password rejection. |
| backend/src/features/verification/__tests__/verification.routes.additional.test.ts | Authenticated verification/admin routes with supported protected document payloads and updated assurance fixtures. |
| backend/src/features/verification/__tests__/verification.routes.test.ts | Authentication failure, supported document body and adult application validation with assurance updates. |
| backend/tests/security/mass-assignment.test.ts | Injected journal owners/privileged fields stripped, strict privacy/review escalation fields rejected, verified owner passed to service. |
| backend/tests/security/uuid-validation.test.ts | Malformed journal/contact/deletion/admin IDs rejected and valid UUID preserved; authenticated/assurance fixture updates. |
| frontend/src/features/authentication/view/__tests__/admin-login-view.test.tsx | Backend reviewer authorization, invalid/network/simulated-login denial, no public admin registration and added MFA invalid-code retry. |
| frontend/src/proxy.test.ts | Safe internal redirect/config failure behavior and added renderer/response nonce consistency. |
| frontend/src/services/authentication/auth.supabase-adapter.test.ts | Existing OTP/session persistence/logout tests retained; neutral duplicate-signup behavior and session cleanup updates. |
| frontend/src/services/settings/settings.service.test.ts | Existing settings endpoints retained; added authenticated no-store export fetch without URL token and safe consumed/expired-export errors. |
| supabase/tests/database/journal-analysis-transactions.test.sql | Existing transactional job tests adapted to encrypted result payload contract; local transaction/analysis behavior preserved. |
| supabase/tests/database/wellness-security-and-lifecycle.sql | Encrypted PHQ-8 storage/due/retry/history contract replaces raw-score persistence assertions; existing journal image lifecycle and foreign ownership cases retained. |

### CI/CD

**Created (4)**

| Exact file | Why changed / created / removed |
| --- | --- |
| scripts/security-migrate.mjs | Allows guarded linked-project migration dry-run only; exact target/link checks; not executed remotely. |
| scripts/security-project-target.mjs | Validates exact authorized HTTPS origin and local environment/optional link metadata without printing secrets. |
| scripts/security-query-boundaries.mjs | AST scanner rejects unqualified/dotted database table access while excluding non-database from() uses. |
| scripts/security-scan.mjs | Scans tracked/untracked source and optional built bundle for secret/public-env/privileged frontend exposure; handles deleted files safely. |

**Modified (1)**

| Exact file | Why changed / created / removed |
| --- | --- |
| .github/workflows/security-checks.yml | Adds least-privilege audit/secret/history/query/target/policy/SQL/build checks and evidence upload. |

### Documentation

**Created (16)**

| Exact file | Why changed / created / removed |
| --- | --- |
| docs/security/DATABASE_CATALOG.json | Machine-readable isolated schema, columns, grants, policies, functions, triggers and constraints. |
| docs/security/DATA_CLASSIFICATION_AND_RETENTION.md | Maps data categories/purposes, proposed retention/deletion/backup behavior and actual lifecycle gaps. |
| docs/security/ENCRYPTION_AND_KEY_MANAGEMENT.md | Documents concrete cipher/key formats, store coverage, guarded migration/rotation procedure and missing KMS/backfills. |
| docs/security/ENDPOINT_SECURITY_MATRIX.md | Inventories actual endpoint authentication/role/validation/rate-limit controls and review gaps. |
| docs/security/ENVIRONMENT_AND_PROVIDER_INVENTORY.md | Records local approved-target consistency and provider/hosting responsibilities requiring external evidence. |
| docs/security/EXPORT_COVERAGE.md | Lists the 62 exported collections, ownership rules, attachment/size limits and exclusions. |
| docs/security/INCIDENT_RESPONSE_PLAN.md | Draft incident, alert, credential/key, backup and restore procedures with explicit unperformed drills. |
| docs/security/RLS_AND_DATABASE_POLICY_MATRIX.md | Generated table/policy/function grants summary with local-only and historical-constraint limitations. |
| docs/security/ROLE_AND_PERMISSION_MATRIX.md | Maps browser/user/reviewer/service/worker responsibilities and protected operations. |
| docs/security/SECURITY_IMPLEMENTATION_HANDOFF.md | Earlier incomplete A–H checkpoint with thesis inventory, 83-requirement matrix and unsent handoff. |
| docs/security/SECURITY_IMPLEMENTATION_STATUS.md | Maintains dated gate ledger, observed changes and remaining engineering/external work. |
| docs/security/SECURITY_REQUIREMENTS.md | Verbatim authoritative baseline copied for traceability; not rewritten as claimed implementation. |
| docs/security/SECURITY_REQUIREMENT_STATUS_MATRIX.md | Maps all 83 authoritative requirements to status, owner, locations, evidence and remaining risk. |
| docs/security/SECURITY_TEST_EVIDENCE.md | Records actual commands/results/warnings/resolved failures and unperformed operational tests. |
| docs/security/SECURITY_TEST_PLAN.md | Documents reproducible negative test scope, owners and missing live/independent checks. |
| docs/security/LLOYDIECAKES_SECURITY_DOCUMENTATION_HANDOFF.md | Documentation-only final-diff handoff requested by the user; complete implementation/migration/test/file/manual/thesis/message inventory. |

**Modified (1)**

| Exact file | Why changed / created / removed |
| --- | --- |
| docs/security/THREAT_MODEL.md | Updates trust boundaries, sensitive flows, threats and implementation/verification limitations. |

### Configuration

**Created (1)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/security-controls.example.json | Secret-free example AI/upload/route emergency control file. |

**Modified (5)**

| Exact file | Why changed / created / removed |
| --- | --- |
| backend/.env.example | Documents prior-key, trusted-proxy and runtime-control configuration without secrets. |
| backend/package.json | Adds explicit sharp runtime dependency and updates security-related dependencies. |
| backend/src/config/environment.ts | Validates prior encryption-key map, production HTTPS and explicit trusted proxy configuration. |
| frontend/package.json | Updates Next/Vitest-related dependency versions. |
| package-lock.json | Locks dependency remediation including Next, sharp, qs, Vitest and coverage changes. |

### Preserved user-owned changes — excluded from security totals

| File | Treatment |
| --- | --- |
| frontend/next-env.d.ts | Existing .next/dev/types import preserved and restored after Next builds; not credited as security work. |
| frontend/public/intro-init.js | Pre-existing user branding/intro work preserved; not credited as security implementation. |
| frontend/src/shared/components/branding/echo-app-intro.tsx | Pre-existing user branding/intro work preserved; not credited as security implementation. |
| frontend/src/shared/components/branding/echo-intro-gate.tsx | Pre-existing user branding/intro work preserved; not credited as security implementation. |

The previously existing generated-types script/database type skeleton and existing worker/consent/security tests not in this inventory were not counted as new work.

## 7. THESIS DOCUMENTATION UPDATE LIST

| Thesis section / diagram / table | What Lloydiecakes should document |
| --- | --- |
| System Architecture | Retain the modular-monolith description. Distinguish browser/publishable user clients, privileged backend operations, background journal runner, Auth, database, Storage and optional providers. Document remaining admin-client paths. |
| Security Architecture | Explain deny-by-default grants, defense in depth, request identity, emergency controls, safe transport/file handling and the requirement/evidence matrix; distinguish code from operational approval. |
| Database Design | Describe the 20 new migrations, owner/composite FKs, NOT VALID semantics, ciphertext fields, quota policy, security_events and encrypted export artifacts. Include exact function execution roles and historical validation prerequisites. |
| Authentication | Document managed getUser verification plus issuer/audience/time/session checks, fresh Auth clients, neutral duplicate responses, recent signed-amr authentication, TOTP enrollment/challenge and hosted configuration gaps. |
| Authorization | Explain server-derived ownership, selected user-JWT clients, reviewer membership plus aal2/recent auth, protected fields and direct Data API restrictions. Do not claim all service_role usage was removed. |
| Encryption | Document AES-256-GCM parameters, versioned distinct keyring, new Buddy/AI/PHQ-8/export encryption, integrity checks, in-memory plaintext, local CAS helpers and historical/plaintext gaps. Separate private Storage from application encryption. |
| API Security | Cover DTO validation, body/byte/time limits, process-local rate limits, exact-origin CORS, explicit proxy trust, safe errors/request IDs and allowlisted DNS-pinned outbound HTTPS. |
| Data Privacy | Describe protected consent reads, preserved processing gates, 62-collection bounded exports, one-time/24-hour delivery and atomic deletion requests. State that full account erasure/provider deletion/retention automation and legal approval are unfinished. |
| AI Security | Document new encrypted results, emergency checks and database count quotas. Identify pre-existing worker leases/idempotency and consent gates as retained controls. Explicitly separate output schemas from unimplemented prompt-injection evaluation. |
| File Security | Explain real image decoding/re-encoding, metadata removal, 5 MiB/pixel/frame/time/concurrency limits, verification signature/size validation, quarantine and clean-evidence requirements. State that the default scanner does not scan for malware. |
| Logging/Audit | Document structured redaction, request IDs, actor hashes, append/read-only grants, transactional export/deletion-request audits and best-effort generic audit delivery. Monitoring/retention deployment remains external. |
| Testing | Use exact filenames and attack cases in section 3. Record 376 frontend/276 backend tests, 18 SQL suites and 1 Node guard test separately. Explain mocks/PGlite/jsdom limitations and resolved failures; no pentest claim. |
| Deployment | Record unapplied migrations, project-target guard, environment separation, exact-origin/proxy/TLS configuration, required provider integrations and CI file contents. Do not imply GitHub protections or all local commands are enforced in CI. |
| Risk Management | Maintain explicit engineering gaps, 30 manual/external actions, proposed retention/backup targets, no accepted risk and no independent review. Do not replace incomplete statuses with Verified. |
| Data Flow Diagram | Show verified bearer flowing to backend and selected RLS user clients; privileged paths separate; encrypted database artifacts; bounded authenticated export plaintext delivery; quarantined files; fixed provider boundary; metadata-only audit. |
| Architecture Diagram | Add live-session/Auth bridge, owner-JWT factory, recent/MFA gates, runtime controls file, image sanitizer, scanner interface/default quarantine, export service/expiry task, audit sink and external KMS/monitoring placeholders marked pending. |
| Database/RLS diagrams or tables | Use catalog counts 87 tables/62 functions/207 app policies; add storage.objects policy separately. Show owner policies AND restrictive active-session policy, role/schema/column/RPC grants and parent-owner relationships. Mark NOT VALID historical checks. |
| Test result tables | Separate PASS, WARNING, FAIL, NOT RUN and BLOCKED. Report 96 lint warnings without inventing a grand warning count, zero final failed checks, and no remote application. Do not sum SQL suites as individual test cases. |

Suggested wording for evaluation: “The implementation pass introduced and locally tested the documented security controls. Hosted-service configuration, independent assessment and specified engineering gaps remain outstanding.” Avoid “fully secure,” “all requirements verified,” “remote migrations deployed,” “complete account deletion,” or “production-ready.”

## 8. READY-TO-SEND MESSAGE TO LLOYDIECAKES

The following text is prepared for copying. **It has not been sent.**

Lloydiecakes,

Tapos na ang current security implementation pass na ginawa natin sa ECHO branch, and ito na ang documentation handoff. Important distinction: concluded na itong pass, pero hindi ibig sabihin na complete na lahat ng security requirements or production-ready na ang application. May remaining engineering work at manual/external setup na clearly listed sa report. Walang independent penetration test or security sign-off na kino-claim.

Architecture: modular monolith pa rin ang ECHO. Mas explicit na ngayon ang separation ng browser, backend user operations, admin operations, background workers, Supabase Auth/database/Storage at optional external providers. Verified user JWT clients na ang gamit sa ordinary settings/notifications and selected journal, Buddy, grounding, dashboard, consent and account reads. May remaining service_role paths pa; please do not document this as complete least-privilege migration.

Authentication/session: managed Supabase Auth pa rin ang nagve-verify ng exact token. Added configured issuer/audience/role/time checks plus active session and account-status checks. Sensitive export/deletion-request and reviewer operations require recent authentication; reviewer routes also require aal2 together with the existing backend reviewer role. May TOTP enrollment/challenge UI. Password verification uses a fresh Auth client, and successful password change attempts global session revocation with an explicit failure response if revocation fails. Duplicate signup responses are neutralized. Hosted MFA/recovery/session settings and real revocation drills remain manual.

Authorization/RBAC and database: hindi client-supplied owner or role ang authority. Protected DTO fields and column grants block injected owner/status/role changes. We prepared 20 forward-only security migrations, all local and tested through isolated replay—none applied remotely. They revoke broad legacy/private/default grants, add owner/parent constraints, narrow reads/writes, protect audit evidence and add restrictive live-session/account policies on 87 application tables plus Storage objects. The catalog lists 62 functions and 207 application-table policies. NOT VALID constraints still require review of historical records.

Encryption/key handling: hardened AES-256-GCM uses a fresh 12-byte IV, 16-byte authentication tag and versioned distinct 32-byte keys. New Buddy messages, detailed analysis outputs, PHQ-8 answers/score/severity and temporary account exports are encrypted, alongside the existing journal/verification encrypted fields. May local-only dry-run/CAS helpers for Buddy and PHQ-8 migration/rotation; none ran against real data. Historical backfill, analysis rotation, remaining Restricted metadata and cloud KMS are still incomplete. Private Storage access is not the same as application-level file encryption.

Backend/API: added strict/bounded inputs, exact-origin CORS rejection, explicit proxy trust, safe error/redaction behavior and route-specific rate limits. Outbound AI HTTP uses approved HTTPS origins, public DNS validation/pinning, no redirects and byte/time caps. The Supabase fetch wrapper avoids retrying unsafe write methods. HTTP limiters are process-local; database AI/export quotas are separate persistent controls. Existing headers/no-store behavior were retained, and CSP was fixed so Next's renderer receives the same nonce policy as the browser.

Frontend/browser: removed the obsolete plaintext draft manager and localStorage autosave path, added known sensitive-cache cleanup, and added private session boundaries that hide/unmount old-account UI and reset the document on account/session changes or restored snapshots. Exports cancel and revoke temporary Blob URLs on cleanup. Unit tests pass, but real-browser account-switch/back-forward/cache/CSP/CSRF checks are still needed; jsdom cannot perform real document navigation.

Files/Storage: journal/avatar images are actually decoded and re-encoded with byte/dimension/pixel/frame/concurrency/time limits, and EXIF/GPS/trailing content is removed. Verification uploads have signature/size checks and stay quarantined unless valid clean scanner evidence is present. Reviewer signing/approval is blocked for unclean documents. A real malware/PDF scanning provider is not connected, so please document the scanner interface and default quarantine honestly. Sensitive bucket changes are unapplied locally prepared migrations; avatar public URL behavior was retained.

AI/privacy: we added runtime AI/upload/route kill switches, encrypted final results and database user/global daily/outstanding quotas, including a timezone/backdating fix. Existing worker leases, callback idempotency and consent/job gates were retained; hindi lahat ng iyon newly built in this pass. Structured outputs and safe transport are present, but no dedicated semantic prompt-injection filter/tool sandbox or adversarial prompt suite was added. Provider training/retention/region/deletion approval remains external.

Exports/deletion: account JSON exports cover 62 fixed owner/parent-owned collections plus bounded clean attachments, are encrypted before temporary persistence, require recent auth, expire after 24 hours and can be downloaded once. PDF generation has its own recent-auth/audit authorization. Deletion request/cancel now runs atomically with its audit and owner/state checks. Important: this is not a complete account-erasure worker; schema/object/provider deletion, tombstones and general retention automation still need engineering and policy approval.

Logs/audit/monitoring: structured redaction, request IDs, actor hashes, append/read-only audit permissions and transactional export/deletion-request audits are implemented. Generic request audit delivery is still best-effort, and external monitoring, archive retention, alerts and on-call routing are not configured. May incident/backup/rotation runbooks and kill-switch hooks, pero walang actual restore/tabletop/live rotation drill na ginawa.

CI/testing: updated the security workflow for least-privilege permissions, dependency audit, source/bundle/history scanning, query/target/auth-policy/SQL checks, build and evidence upload. GitHub branch protection, required checks and actual Actions execution are not verified. The final local run passed 376 frontend tests and 276 backend tests, plus 18 isolated SQL suites and 1 separate project-target Node test. Typecheck/build/auth-policy and diff checks pass. Lint has 96 warnings (66 frontend, 30 backend); dependency audit has zero vulnerabilities. Source/bundle scan checked 1080 paths with zero findings; query scan checked 128 queries with zero findings. These are local checks, not proof of full security or an independent assessment.

For the thesis, please update System Architecture, Security Architecture, Database Design, Authentication, Authorization/RBAC, Encryption/Key Management, API Security, Data Privacy, AI Security, File Security, Logging/Audit, Testing/Evaluation, Deployment and Risk Management. Update the DFD and architecture diagram with user/admin/worker boundaries, session/MFA gates, encrypted stores/export flow, quarantine/scanner and audit sink. Update ERD/RLS/grant tables for the new FKs, ciphertext fields, quotas, audit/export tables, owner policies and restrictive session policy. Add exact test-result, encryption-coverage, retention and requirement-to-evidence tables. Keep unfinished engineering and external requirements in Limitations/Future Work—huwag i-convert into completed features.

Nasa docs/security ang complete requirement/status matrix, threat model, role/RLS/catalog, encryption/rotation, retention/export coverage, test evidence/plan, incident response and implementation handoffs. The new LLOYDIECAKES_SECURITY_DOCUMENTATION_HANDOFF.md includes every changed security file, all 20 migrations, all 31 newly added test files, the 17 modified test files, and 30 grouped manual/external work items with reasons and suggested owners.

Next team actions include approved-project verification and remote migration review/application; real Supabase/browser tests; MFA/secrets/KMS/scanner/provider setup; GitHub protections; CORS/proxy/TLS; monitoring/alerts; backup/restore and incident/revocation/rotation/kill-switch drills; privacy/legal approval; independent review; and explicit release approval. Remaining code work is separately listed so hindi natin ma-label as manual setup lang.

No code changes were made for this documentation request. No commit, push, production deploy, legacy-project access, remote migration, real account export/deletion or live credential rotation was performed. This message is prepared for copying; it has not been sent automatically.

## 9. FINAL SHORT SUMMARY

| Metric | Proven count / result | Counting rule |
| --- | --- | --- |
| Total security files changed | 163 delivered: 89 created, 73 modified, 1 deleted | 162 from implementation pass + this one documentation file; excludes 4 user-owned changes. |
| Total migrations created | 20 | All local-only; 0 remote applications. |
| Total security tests added | 31 new test files/suites | 13 backend Vitest + 3 frontend Vitest + 14 SQL + 1 Node. Also 17 existing test files modified. Newly added individual case count: Not reliably determined. |
| Total tests passed | 652 application tests + 1 separate Node guard test; 18 SQL suites | 376 frontend + 276 backend = 652; targeted reruns not counted twice. SQL individual assertion count: Not reliably determined. |
| Total warnings | 96 quantified lint warnings | 66 frontend + 30 backend. Grand total including jsdom/Git/repeated-run notices: Not reliably determined. |
| Total failures | 0 in the final recorded validation set | Does not mean no earlier resolved failures or no outstanding security risks. |
| Total manual/external items remaining | 30 grouped action items | M01–M30 in section 5; 6 additional grouped engineering gaps tracked separately. |
| Code/configuration changes for this documentation request | 0 | Only this Markdown report is created. |
| Commit / push / deployment / external message | None | No remote migration, real user-data operation or live secret rotation performed. |

Evidence remains scoped to the inspected worktree and recorded local executions. No independent verification, accepted risk or production-release approval is asserted.
