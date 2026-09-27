# ECHO End-to-End Security Requirements and Implementation Plan

## Document Description

This document defines the security requirements, implementation sequence, verification evidence, and production-release gates for the ECHO mental-health application. ECHO processes highly sensitive information, including identity and consent records, private journal content, Buddy conversations, verification documents, user preferences, notifications, derived insights, and AI-analysis records.

The objective is to establish defense in depth from the browser through the Express modular-monolith backend, Supabase Auth, service-owned PostgreSQL schemas, object storage, external AI providers, deployment infrastructure, and operational processes. The plan is intended to be executable by Codex or another engineering team without relying on undocumented assumptions.

This document is a technical security baseline, not a legal certification. Before ECHO stores information from real users, qualified security and privacy reviewers must assess the deployed system and determine which laws, contracts, and healthcare/privacy requirements apply in each operating jurisdiction.

---

## 1. Document Control

| Field | Value |
| --- | --- |
| Document owner | ECHO engineering/security owner |
| Application architecture | Express modular monolith with a schema-per-domain Supabase database |
| Security target | OWASP ASVS 5.0 Level 2 minimum |
| Higher-assurance areas | Level 3-style controls for administrators, verification records, encryption keys, exports, deletion, and AI-provider access |
| Primary implementation environment | New non-production Supabase project |
| Forbidden environment | Previous/legacy Supabase project unless separately authorized in writing |
| Review frequency | Before every production release and at least quarterly after launch |
| Status values | `Not Started`, `In Progress`, `Blocked`, `Implemented`, `Verified`, `Accepted Risk` |

### 1.1 Requirement Language

- **MUST** means the control is required before production.
- **MUST NOT** means the behavior is prohibited.
- **SHOULD** means the control is expected unless a documented threat analysis justifies another design.
- **MAY** means the control is optional and risk-based.

### 1.2 Priority Definitions

| Priority | Meaning |
| --- | --- |
| P0 | Release blocker; failure may expose sensitive data, credentials, or administrator access |
| P1 | Required before real-user production use |
| P2 | Defense-in-depth improvement scheduled soon after the P0/P1 baseline |

---

## 2. Scope

### 2.1 In Scope

- Next.js frontend and browser runtime
- Express API, middleware, controllers, services, and infrastructure adapters
- Supabase Auth and token verification
- Supabase Data API and custom-schema exposure
- PostgreSQL schemas, tables, views, functions, triggers, grants, and RLS policies
- Supabase Storage buckets and verification-document handling
- Journal, Buddy, verification, notification, grounding, insights, and AI-analysis workflows
- Encryption, key management, and key rotation
- External AI and analysis providers
- Logging, audit events, alerting, backups, and incident response
- Dependency, source-control, CI/CD, and deployment security
- Privacy controls, consent, export, retention, and deletion
- Automated security tests and independent security review

### 2.2 Out of Scope

- Claims of legal or regulatory certification without qualified review
- Security of users' personal devices outside reasonable browser/session controls
- Security guarantees made solely from automated scanning
- Changes to the legacy Supabase project without explicit authorization

---

## 3. Security Objectives

ECHO MUST provide the following security properties:

1. **Confidentiality:** Only an authorized user or narrowly authorized administrator can access protected records.
2. **Integrity:** Records, roles, consent state, verification state, and analysis results cannot be changed without authorization.
3. **Availability:** Abuse, oversized requests, expensive AI operations, and dependency failures cannot easily exhaust the application.
4. **Privacy:** The application collects, processes, retains, and shares only the information required for documented purposes.
5. **Accountability:** Security-relevant and administrator actions produce tamper-resistant audit evidence without exposing private content.
6. **Isolation:** Development, staging, production, users, roles, and service-owned schemas remain properly separated.
7. **Recoverability:** Backups, restoration, session revocation, key rotation, and incident procedures are tested.

---

## 4. Security Architecture Principles

### SEC-ARCH-001 — Deny by Default

- **Priority:** P0
- All routes, schemas, tables, storage objects, and administrative functions MUST deny access unless an explicit rule allows it.
- New endpoints and database objects MUST begin private.
- **Evidence:** Route authorization matrix, database grant report, and negative authorization tests.

### SEC-ARCH-002 — Defense in Depth

- **Priority:** P0
- Authorization MUST be enforced in trusted backend code and at the database/storage layer.
- Frontend visibility rules MUST NOT be treated as security controls.
- **Evidence:** Backend authorization tests plus RLS/storage-policy tests.

### SEC-ARCH-003 — Least Privilege

- **Priority:** P0
- Each runtime identity, CI credential, database role, and administrator MUST receive only the access needed for its function.
- **Evidence:** Role/permission inventory and quarterly access review.

### SEC-ARCH-004 — Service Ownership in the Modular Monolith

- **Priority:** P1
- Each module MUST own its schema and persistence contract even though the backend is deployed as one process.
- Cross-module access MUST occur through a defined service/repository interface, not arbitrary table queries.
- **Evidence:** Module-to-schema ownership matrix and static query audit.

### SEC-ARCH-005 — Separate Environments

- **Priority:** P0
- Development, staging, and production MUST use separate Supabase projects, credentials, encryption keys, storage buckets, AI keys, and deployment secrets.
- Production information MUST NOT be copied into development or routine staging tests.
- **Evidence:** Environment inventory with masked identifiers and deployment configuration review.

---

## 5. Data Classification and Handling

### 5.1 Classification Levels

| Level | Examples | Minimum handling |
| --- | --- | --- |
| Public | Public support-directory information and approved public assets | Integrity controls; no secret classification |
| Internal | Non-sensitive configuration, feature flags, aggregate operational metrics | Authenticated staff access where appropriate |
| Confidential | Profiles, preferences, consent history, contact information, notification metadata | TLS, access control, RLS, redacted logs, retention policy |
| Restricted | Journal content, Buddy content, verification records/documents, detailed insights, AI inputs/results | Application-level encryption, strict ownership, minimal processing, audited administrative access |

### 5.2 Schema Classification

| Schema | Primary information | Classification | Required owner |
| --- | --- | --- | --- |
| `user_service` | Profiles, consents, preferences, contacts, export/deletion requests | Confidential; selected fields Restricted | User module |
| `journal_service` | Journals, drafts, journal analyses | Restricted | Journal module |
| `buddy_service` | Conversations and messages | Restricted | Buddy module |
| `verification_service` | Verification workflow, reviews, documents, administrators | Restricted | Verification module |
| `notification_service` | Notification and delivery metadata | Confidential | Notification module |
| `grounding_service` | User grounding activity/history | Confidential | Grounding module |
| `insights_service` | Derived user insights and dashboard read models | Restricted | Insights module |
| `ai_analysis` | Provider requests, results, prompts, model metadata, audit records | Restricted | AI-analysis module |

### SEC-DATA-001 — Data Minimization

- **Priority:** P0
- ECHO MUST collect and transmit only fields necessary for a documented product purpose.
- Sensitive content MUST NOT be copied into notifications, URLs, analytics events, or unnecessary read models.
- **Evidence:** Field-level data inventory and external-data-flow review.

### SEC-DATA-002 — Purpose and Retention

- **Priority:** P1
- Every data category MUST have an owner, purpose, retention period, deletion behavior, and backup-expiration behavior.
- **Evidence:** Approved retention matrix and automated retention tests/jobs.

### SEC-DATA-003 — No Sensitive Test Fixtures

- **Priority:** P0
- Tests and seed files MUST use synthetic information only.
- **Evidence:** Repository secret/sensitive-data scan and seed review.

---

## 6. Authentication and Session Security

### SEC-AUTH-001 — Managed Authentication

- **Priority:** P0
- ECHO MUST use Supabase Auth or another reviewed identity provider.
- The application MUST NOT implement custom password hashing or password storage.
- **Evidence:** Authentication architecture review.

### SEC-AUTH-002 — Token Verification

- **Priority:** P0
- The backend MUST cryptographically verify every access token using the correct issuer, audience, signature, and expiration rules.
- Identity, role, verification status, and ownership MUST NOT be trusted from request bodies, query parameters, or unsigned client state.
- **Evidence:** Tests for missing, malformed, expired, wrong-project, and revoked credentials.

### SEC-AUTH-003 — Email and Account Assurance

- **Priority:** P1
- Sensitive features SHOULD require verified contact information.
- Administrator and verification-reviewer accounts MUST use MFA.
- **Evidence:** Auth configuration snapshot and MFA tests for privileged accounts.

### SEC-AUTH-004 — Session Lifecycle

- **Priority:** P0
- Sessions MUST expire, refresh securely, and support revocation.
- Password/security changes and suspected compromise MUST revoke relevant sessions.
- Logout MUST remove locally cached sensitive state.
- **Evidence:** Session expiration, refresh, logout, and revocation tests.

### SEC-AUTH-005 — Brute-Force and Enumeration Protection

- **Priority:** P0
- Login, signup, recovery, verification, and MFA endpoints MUST be rate-limited.
- Responses MUST NOT reveal whether a specific account exists.
- **Evidence:** Rate-limit tests and response comparison tests.

### SEC-AUTH-006 — Secure Browser Session Strategy

- **Priority:** P1
- The session storage strategy MUST be documented.
- Secure `HttpOnly` cookies are preferred where the architecture supports them.
- Cookie authentication MUST use `Secure`, appropriate `SameSite`, CSRF protection, and narrowly scoped cookie paths/domains.
- Restricted content MUST NOT be stored in `localStorage` or persistent browser caches.
- **Evidence:** Browser storage audit, cookie inspection, and CSRF tests.

---

## 7. Authorization and Role Security

### SEC-AZ-001 — Object-Level Authorization

- **Priority:** P0
- Every operation receiving a record identifier MUST independently confirm the authenticated actor may access that record.
- User ownership MUST come from the verified identity, not a submitted `user_id`.
- **Evidence:** Two-user cross-access tests for every CRUD endpoint.

### SEC-AZ-002 — Function-Level Authorization

- **Priority:** P0
- Administrator, reviewer, export, deletion, support, and operational endpoints MUST enforce explicit server-side roles.
- Hidden frontend buttons MUST NOT be considered authorization.
- **Evidence:** Route-role matrix and user-to-admin escalation tests.

### SEC-AZ-003 — No User-Controlled Ownership or Roles

- **Priority:** P0
- APIs MUST ignore or reject attempts to set owner IDs, administrative roles, review decisions, key versions, audit identities, or protected workflow states.
- **Evidence:** Mass-assignment and protected-field tests.

### SEC-AZ-004 — Separation of User and Administrative Supabase Clients

- **Priority:** P0
- Ordinary user operations SHOULD use a user-scoped Supabase client carrying the verified user token so RLS remains effective.
- A secret/service-role client MUST be isolated and used only for narrowly defined administrative/background operations.
- The administrative client MUST NOT be imported by frontend code.
- **Evidence:** Import-boundary test, client-usage inventory, and RLS tests.

### SEC-AZ-005 — Privileged Action Reauthentication

- **Priority:** P1
- Export, deletion, credential changes, sensitive administrative review, and recovery changes SHOULD require recent authentication.
- **Evidence:** Reauthentication tests and policy documentation.

---

## 8. Supabase and PostgreSQL Security

### SEC-DB-001 — Explicit Schema Access

- **Priority:** P0
- Backend database calls MUST use valid explicit schema selection such as `.schema("journal_service").from("journals")`.
- Dotted table strings such as `.from("journal_service.journals")` MUST NOT be used.
- Unqualified table access MUST be rejected by a static audit unless explicitly documented.
- **Evidence:** Static scan and generated database types.

### SEC-DB-002 — Minimal Data API Exposure

- **Priority:** P0
- Only required schemas MUST be exposed through PostgREST.
- Exposure alone MUST NOT grant data access.
- Internal helper schemas SHOULD remain unexposed.
- **Evidence:** `Accept-Profile` probes and exposed-schema configuration snapshot.

### SEC-DB-003 — Explicit Grants

- **Priority:** P0
- Grants MUST be explicitly defined for `anon`, `authenticated`, `service_role`, and any custom roles.
- Broad default privileges MUST be revoked where unnecessary.
- Normal frontend users MUST NOT receive direct access unless the architecture documents and tests it.
- **Evidence:** Schema/table/function/sequence grant matrix.

### SEC-DB-004 — RLS on User-Owned Tables

- **Priority:** P0
- RLS MUST be enabled on every user-owned or restricted table reachable through the Data API.
- Separate policies MUST cover `SELECT`, `INSERT`, `UPDATE`, and `DELETE` where those actions are allowed.
- Policies MUST enforce ownership and protected workflow state.
- **Evidence:** Automated pgTAP or equivalent policy tests using two users and unauthorized roles.

### SEC-DB-005 — Database Integrity Constraints

- **Priority:** P1
- Use foreign keys, unique constraints, `NOT NULL`, safe cascade rules, check constraints, length limits, enumerated state validation, and timestamps.
- Protected owner and state fields MUST not be freely writable.
- **Evidence:** Constraint inventory and invalid-write tests.

### SEC-DB-006 — Safe Functions, Triggers, and Views

- **Priority:** P0
- Database functions and views MUST use invoker semantics by default.
- Any `SECURITY DEFINER` function MUST have a fixed safe `search_path`, validate inputs, use minimal privileges, and restrict `EXECUTE` grants.
- Trigger functions MUST not allow privilege escalation or cross-user mutation.
- **Evidence:** Function/view audit and adversarial tests.

### SEC-DB-007 — Migration Safety

- **Priority:** P0
- Applied migrations MUST NOT be edited.
- Corrections MUST use forward-only migrations.
- Remote pushes MUST begin with project verification and `db push --dry-run`.
- Remote database reset MUST be prohibited in production procedures.
- **Evidence:** Migration-history comparison and CI migration check.

### SEC-DB-008 — Generated Types

- **Priority:** P1
- Database types MUST be generated from the correct project and used by backend clients/repositories.
- Generated output MUST be validated as TypeScript and must not contain CLI error output.
- **Evidence:** Typecheck and schema/type drift test.

---

## 9. Encryption and Key Management

### SEC-CRYPTO-001 — Encryption in Transit

- **Priority:** P0
- Production and staging traffic MUST use HTTPS/TLS.
- Plain HTTP MUST redirect or be rejected except for isolated local development.
- **Evidence:** TLS configuration and external security scan.

### SEC-CRYPTO-002 — Application-Level Encryption

- **Priority:** P0
- Journal bodies, drafts, Buddy messages, sensitive AI results, and designated verification fields MUST be encrypted before database storage.
- Use a reviewed authenticated-encryption construction such as AES-256-GCM.
- **Evidence:** Field inventory and ciphertext-at-rest verification.

### SEC-CRYPTO-003 — Nonce/IV Safety

- **Priority:** P0
- Every encryption operation MUST use a fresh cryptographically secure IV/nonce appropriate for the algorithm.
- An IV/nonce MUST NOT be reused with the same key.
- Authentication tags MUST be stored and verified.
- **Evidence:** cryptographic unit tests and tamper-rejection tests.

### SEC-CRYPTO-004 — Key Separation and Storage

- **Priority:** P0
- Encryption keys MUST be stored outside the database containing ciphertext.
- Keys MUST NOT be stored in frontend code, Git, logs, or database rows beside encrypted records.
- Production SHOULD use a managed secret store or KMS.
- **Evidence:** secret-location audit and deployment configuration review.

### SEC-CRYPTO-005 — Key Rotation

- **Priority:** P1
- Encrypted records MUST include a key version.
- The application MUST support decrypting approved previous versions and encrypting new records with the active version.
- A tested rotation and emergency-revocation runbook MUST exist.
- **Evidence:** rotation test and runbook exercise.

### SEC-CRYPTO-006 — Plaintext Lifetime

- **Priority:** P0
- Decrypted content MUST exist only as long as required to fulfill the request.
- Plaintext MUST NOT be logged, cached, placed in analytics, or persisted in temporary files.
- **Evidence:** logging/cache tests and code review.

---

## 10. Backend and API Security

### SEC-API-001 — Central Security Middleware

- **Priority:** P0
- The Express application MUST centrally apply request IDs, authentication, security headers, CORS, parsing limits, validation, rate limits, safe error handling, and request logging/redaction.
- **Evidence:** middleware-order test and application configuration review.

### SEC-API-002 — Security Headers

- **Priority:** P1
- Use Helmet or equivalent controls.
- Configure HSTS, content-type sniffing protection, framing protection, referrer policy, and a deployment-appropriate Content Security Policy.
- Reduce unnecessary framework fingerprinting.
- **Evidence:** response-header tests.

### SEC-API-003 — CORS

- **Priority:** P0
- Production CORS MUST use an explicit allowlist of trusted frontend origins.
- Wildcard origins MUST NOT be combined with credentials.
- Unexpected origins and methods MUST be rejected.
- **Evidence:** allowed/disallowed-origin tests.

### SEC-API-004 — Input and Output Validation

- **Priority:** P0
- Validate path, query, header, and body inputs against strict schemas.
- Sensitive writes SHOULD reject unknown fields.
- Responses MUST use explicit DTOs so internal columns and secrets cannot leak.
- **Evidence:** malformed-input, unknown-field, and response-shape tests.

### SEC-API-005 — Request and Resource Limits

- **Priority:** P0
- Limit request-body size, query ranges, pagination, file size/count, concurrent expensive operations, AI tokens, retries, and outbound-request duration.
- Apply endpoint-specific rate limits to authentication, journal writes, Buddy/AI calls, verification, exports, and administrative actions.
- **Evidence:** resource-exhaustion and rate-limit tests.

### SEC-API-006 — Injection Prevention

- **Priority:** P0
- Use parameterized Supabase/database APIs.
- Raw SQL MUST NOT interpolate untrusted values.
- User content MUST be treated as data, not executable HTML, SQL, code, or prompt instructions.
- **Evidence:** injection test suite and raw-query audit.

### SEC-API-007 — Mass Assignment Prevention

- **Priority:** P0
- Controllers/services MUST construct allowlisted persistence objects instead of spreading request bodies into database updates.
- **Evidence:** protected-field mutation tests.

### SEC-API-008 — SSRF and Outbound Request Safety

- **Priority:** P0
- Any server-side URL fetch MUST use an allowlist or strict destination validation.
- Private, loopback, link-local, metadata-service, and unexpected redirect destinations MUST be blocked unless explicitly required.
- **Evidence:** SSRF tests and outbound-host inventory.

### SEC-API-009 — Safe Errors

- **Priority:** P0
- Production responses MUST NOT expose stack traces, SQL, table names, secrets, provider payloads, or internal paths.
- Errors MUST use stable public codes and a request/correlation ID.
- **Evidence:** failure-path tests and error-log review.

### SEC-API-010 — Reliability Controls

- **Priority:** P1
- External calls MUST use timeouts, bounded retries, backoff, and circuit-breaking where appropriate.
- Write operations vulnerable to accidental repetition SHOULD support idempotency.
- **Evidence:** provider-failure, retry-bound, and duplicate-request tests.

### SEC-API-011 — Proxy and Deployment Trust

- **Priority:** P1
- Express `trust proxy`, client IP handling, secure cookies, and HTTPS detection MUST match the actual reverse-proxy architecture.
- **Evidence:** deployment-specific integration tests.

---

## 11. Frontend Security

### SEC-FE-001 — No Frontend Secrets

- **Priority:** P0
- Frontend bundles MUST contain only public configuration.
- Secret/service-role, database, encryption, and AI keys MUST never use public environment-variable prefixes.
- **Evidence:** production bundle and source-map secret scan.

### SEC-FE-002 — XSS Prevention

- **Priority:** P0
- React's safe text rendering MUST be preserved.
- `dangerouslySetInnerHTML` MUST be prohibited for user content unless a reviewed sanitizer and explicit security test exist.
- Journal and Buddy content MUST always be treated as untrusted.
- **Evidence:** static search, XSS tests, and CSP report review.

### SEC-FE-003 — Sensitive Browser State

- **Priority:** P0
- Restricted content MUST NOT be written to URLs, analytics, browser storage, page titles, error telemetry, or service-worker caches.
- Sensitive UI state MUST be cleared on logout and account changes.
- **Evidence:** browser storage/cache inspection.

### SEC-FE-004 — Content Security Policy

- **Priority:** P1
- Implement a restrictive CSP using nonces or hashes where the framework requires inline scripts.
- Limit script, style, connection, image, frame, and form destinations.
- Use `frame-ancestors` to prevent unauthorized embedding.
- **Evidence:** CSP tests and production browser report.

### SEC-FE-005 — Safe Error and Loading States

- **Priority:** P1
- UI errors MUST not reveal backend internals.
- Optimistic UI MUST clearly roll back when persistence fails and MUST not claim data was saved without a successful server response.
- **Evidence:** failed-write UI tests and refresh/restart persistence tests.

### SEC-FE-006 — Third-Party Script Control

- **Priority:** P1
- Third-party analytics, chat widgets, session replay, and advertising scripts MUST be prohibited on restricted-content screens unless formally approved.
- Sensitive fields MUST always be masked from telemetry.
- **Evidence:** third-party inventory and network-capture review.

---

## 12. File and Verification-Document Security

### SEC-FILE-001 — Private Storage

- **Priority:** P0
- Verification documents and other user-private files MUST use private buckets.
- Public bucket URLs MUST NOT expose restricted files.
- **Evidence:** storage-policy and anonymous-access tests.

### SEC-FILE-002 — Signed Access

- **Priority:** P0
- Downloads MUST use short-lived signed URLs or authenticated backend streaming after authorization.
- URLs MUST be scoped to one object and expire promptly.
- **Evidence:** expiry and cross-user download tests.

### SEC-FILE-003 — Upload Validation

- **Priority:** P0
- Validate actual file content, allowed type, extension, maximum size, dimensions/pages where relevant, and upload count.
- Generate storage names server-side.
- User filenames MUST NOT control storage paths.
- **Evidence:** spoofed MIME, oversized file, and path-manipulation tests.

### SEC-FILE-004 — Active Content and Malware

- **Priority:** P1
- Block unnecessary active formats and preview untrusted documents safely.
- Malware scanning MUST occur before privileged users open newly uploaded documents.
- **Evidence:** quarantine/scanning workflow tests.

### SEC-FILE-005 — Lifecycle and Audit

- **Priority:** P1
- File creation, access, review, replacement, and deletion MUST be audited without logging document contents.
- Database deletion MUST coordinate with object deletion and retention rules.
- **Evidence:** lifecycle integration tests and audit-event checks.

---

## 13. AI and External Provider Security

### SEC-AI-001 — Explicit Purpose and Consent

- **Priority:** P0
- Restricted content MUST be sent to an AI provider only for a documented feature with valid consent and an approved privacy configuration.
- **Evidence:** consent-gate tests and provider data-flow inventory.

### SEC-AI-002 — Data Minimization and Pseudonymization

- **Priority:** P0
- Remove unnecessary direct identifiers and send only the minimum relevant content.
- **Evidence:** provider-request inspection using synthetic data.

### SEC-AI-003 — Prompt-Injection Boundary

- **Priority:** P0
- User-provided content MUST be treated as untrusted prompt data.
- It MUST NOT override system instructions, authorization, tool permissions, or database boundaries.
- **Evidence:** adversarial prompt tests.

### SEC-AI-004 — Tool and Action Restrictions

- **Priority:** P0
- AI models MUST NOT directly authorize users, change verification outcomes, change roles, perform unrestricted database queries, or access secrets.
- Tools MUST be allowlisted and every action revalidated server-side.
- **Evidence:** tool-authorization tests.

### SEC-AI-005 — Structured Output Validation

- **Priority:** P1
- AI output used by application code MUST match a strict versioned schema.
- Invalid, oversized, or unexpected output MUST fail safely.
- **Evidence:** schema-validation and provider-failure tests.

### SEC-AI-006 — Provider Privacy Controls

- **Priority:** P0
- Provider retention, training, region, access, deletion, and contractual settings MUST be reviewed.
- Restricted information MUST NOT be used for model training without a separate explicit legal basis and consent.
- **Evidence:** provider configuration record and privacy review.

### SEC-AI-007 — Cost and Abuse Controls

- **Priority:** P1
- Use per-user rate limits, token/input limits, budgets, concurrency limits, and a kill switch.
- **Evidence:** quota tests and kill-switch exercise.

### SEC-AI-008 — User-Facing Limitations

- **Priority:** P1
- AI-generated content MUST be presented as informational and MUST NOT claim professional diagnosis or guaranteed accuracy.
- High-impact product logic MUST receive appropriate human and domain review.
- **Evidence:** UX content review and product-policy approval.

---

## 14. Privacy, Consent, Export, and Deletion

### SEC-PRIV-001 — Consent Records

- **Priority:** P0
- Consent records MUST include the user, purpose, version, decision, and timestamp.
- Consent withdrawal MUST stop future optional processing.
- **Evidence:** consent-version and withdrawal tests.

### SEC-PRIV-002 — Transparent Privacy Notice

- **Priority:** P1
- The notice MUST explain collection, purpose, storage, sharing, AI processing, retention, export, deletion, and contact/escalation paths.
- **Evidence:** legal/privacy review approval.

### SEC-PRIV-003 — Data Export

- **Priority:** P1
- Export MUST require strong authorization and recent authentication.
- Exports MUST include only the requesting user's data, use secure delivery, expire, and be audited.
- **Evidence:** two-user isolation and expiry tests.

### SEC-PRIV-004 — Account Deletion

- **Priority:** P1
- Deletion MUST cover every owned schema, storage object, cache, derived record, and provider request where deletion is supported.
- Backup expiration behavior MUST be documented.
- **Evidence:** end-to-end synthetic-account deletion test.

### SEC-PRIV-005 — No Sensitive Advertising or Replay

- **Priority:** P0
- Restricted content MUST NOT be sold, used for behavioral advertising, or captured in session-replay systems.
- **Evidence:** third-party integration review.

---

## 15. Logging, Audit, Monitoring, and Alerting

### SEC-LOG-001 — Logging Redaction

- **Priority:** P0
- Logs MUST NOT contain passwords, tokens, cookies, secret keys, encryption keys, plaintext journals/messages, document contents, or full AI prompts containing restricted information.
- **Evidence:** automated redaction tests and log sampling.

### SEC-LOG-002 — Security Audit Events

- **Priority:** P0
- Audit authentication events, consent changes, verification workflow actions, privileged access, exports, deletions, authorization failures, key changes, and security-configuration changes.
- **Evidence:** audit-event integration tests.

### SEC-LOG-003 — Audit Integrity

- **Priority:** P1
- Ordinary users MUST not alter audit records.
- Audit records SHOULD be append-only, retained according to policy, and protected from administrator misuse where practical.
- **Evidence:** grant/policy tests and retention configuration.

### SEC-LOG-004 — Monitoring and Alerts

- **Priority:** P1
- Alert on repeated authentication failures, unusual privileged access, high-volume exports, cross-user access failures, rate-limit abuse, abnormal AI spending, permission changes, and secret-scanning findings.
- **Evidence:** alert tests and incident drill.

### SEC-LOG-005 — Safe Observability

- **Priority:** P1
- Metrics and traces SHOULD use opaque identifiers and operational metadata, not restricted content.
- Error-reporting tools MUST apply field scrubbing before transmission.
- **Evidence:** telemetry payload inspection.

---

## 16. Infrastructure, Deployment, and Supply-Chain Security

### SEC-OPS-001 — Supported Runtime and Dependencies

- **Priority:** P0
- Use supported Node.js, Express, Next.js, Supabase SDK, database, and deployment versions.
- Remove deprecated and unused dependencies.
- **Evidence:** version inventory and vulnerability scan.

### SEC-OPS-002 — Reproducible Dependencies

- **Priority:** P1
- Commit lockfiles and use deterministic CI installation.
- Dependency updates MUST run tests and security scanning.
- **Evidence:** CI configuration.

### SEC-OPS-003 — Source-Control Protection

- **Priority:** P0
- Enable secret scanning, branch protection, required status checks, and review for production changes.
- Pre-existing worktree changes MUST be preserved during automated security work.
- **Evidence:** repository settings and CI results.

### SEC-OPS-004 — CI/CD Least Privilege

- **Priority:** P0
- CI credentials MUST be environment-specific, short-lived where possible, and unable to access unrelated projects.
- Preview deployments MUST NOT receive production secrets.
- **Evidence:** credential/permission inventory.

### SEC-OPS-005 — Security Scanning

- **Priority:** P1
- CI SHOULD run secret scanning, dependency analysis, static analysis, typecheck, lint, tests, build validation, migration validation, and infrastructure/container scanning where applicable.
- **Evidence:** required CI jobs and stored reports.

### SEC-OPS-006 — Patch Management

- **Priority:** P1
- Define remediation timeframes based on severity and exposure.
- Critical internet-exposed findings require immediate triage.
- **Evidence:** vulnerability-management procedure.

---

## 17. Backup, Recovery, and Incident Response

### SEC-IR-001 — Backups

- **Priority:** P1
- Production MUST use encrypted backups with restricted restoration permissions.
- Backup retention MUST align with privacy/deletion requirements.
- **Evidence:** backup configuration and access review.

### SEC-IR-002 — Restoration Testing

- **Priority:** P1
- Restoration MUST be tested periodically in an isolated environment using non-sensitive or approved test information.
- **Evidence:** documented restore drill with timing and results.

### SEC-IR-003 — Incident Response Plan

- **Priority:** P0
- Maintain procedures for detection, containment, investigation, credential rotation, session revocation, provider shutdown, recovery, evidence preservation, communication, and post-incident review.
- **Evidence:** approved runbook and tabletop exercise.

### SEC-IR-004 — Emergency Security Controls

- **Priority:** P1
- Provide controlled methods to disable AI calls, file uploads, selected endpoints, compromised integrations, or privileged accounts without a full redeployment.
- **Evidence:** kill-switch and revocation drill.

---

## 18. Required Security Documentation Deliverables

Codex or the implementation team MUST create and maintain:

1. `docs/security/SECURITY_REQUIREMENTS.md`
2. `docs/security/THREAT_MODEL.md`
3. `docs/security/DATA_CLASSIFICATION_AND_RETENTION.md`
4. `docs/security/ROLE_AND_PERMISSION_MATRIX.md`
5. `docs/security/RLS_AND_DATABASE_POLICY_MATRIX.md`
6. `docs/security/ENCRYPTION_AND_KEY_MANAGEMENT.md`
7. `docs/security/SECURITY_TEST_PLAN.md`
8. `docs/security/SECURITY_TEST_EVIDENCE.md`
9. `docs/security/INCIDENT_RESPONSE_PLAN.md`
10. `docs/security/SECURITY_IMPLEMENTATION_STATUS.md`

Each requirement ID in this plan MUST map to:

- responsible owner;
- implementation files or configuration;
- test/evidence location;
- status;
- review date;
- remaining risk;
- approval or accepted-risk record.

---

## 19. Milestone Implementation Plan

### Security Gate S0 — Baseline and Threat Model

**Objective:** Understand the real architecture and identify high-risk data flows before changing controls.

**Tasks:**

1. Record Git status and preserve user-owned changes.
2. Confirm the active Supabase project is the authorized new non-production project.
3. Inventory frontend routes, API endpoints, service modules, database queries, schemas, storage buckets, AI providers, secrets, logs, and deployment environments.
4. Produce a data-flow diagram with browser, backend, Supabase Auth, database, storage, AI provider, and administrator boundaries.
5. Threat-model authentication, authorization, encryption, file handling, AI processing, export, deletion, and administration.
6. Classify threats by impact, likelihood, existing controls, and proposed mitigation.

**Exit criteria:**

- Threat model reviewed.
- Every restricted data flow identified.
- Every external provider documented.
- No production mutation performed.

### Security Gate S1 — Project Targeting, Secrets, and Environment Isolation

**Objective:** Ensure commands and deployments cannot accidentally use the wrong project or leak credentials.

**Tasks:**

1. Correct stale CLI link metadata.
2. Add project-target verification to deployment/migration scripts.
3. Audit `.env` loading and Git tracking.
4. Separate frontend public variables from backend secrets.
5. Add secret scanning and redact command output.
6. Rotate any credential proven exposed.

**Exit criteria:**

- New project targeting is reproducible.
- Old project is untouched.
- No secret is tracked or present in frontend output.
- Staging and production credentials are distinct.

### Security Gate S2 — Database Exposure, Grants, RLS, and Integrity

**Objective:** Make the database deny unauthorized access even if backend authorization fails.

**Tasks:**

1. Expose only required schemas.
2. Define explicit minimal grants.
3. Enable and test RLS for every user-owned/restricted table.
4. Audit functions, triggers, views, default privileges, and ownership.
5. Add required integrity constraints.
6. Add static checks for unqualified/dotted table access.
7. Generate and validate database types.

**Exit criteria:**

- Two-user database policy tests pass.
- Unauthorized roles cannot read or mutate restricted records.
- No unresolved PGRST exposure error remains for required backend schemas.
- Grant and policy matrices are complete.

### Security Gate S3 — Authentication and Authorization

**Objective:** Establish verified identity and consistent ownership/role enforcement.

**Tasks:**

1. Harden JWT verification.
2. Implement centralized route authorization.
3. Separate user-scoped and administrative database clients.
4. Require MFA for privileged accounts.
5. Add session lifecycle and revocation tests.
6. Add two-user IDOR/BOLA tests for every endpoint.

**Exit criteria:**

- Authentication negative tests pass.
- No user can access another user's object.
- No normal user can invoke privileged functions.
- Administrative client use is narrowly inventoried.

### Security Gate S4 — Backend/API Hardening

**Objective:** Protect the Express application against hostile inputs, abuse, and information leakage.

**Tasks:**

1. Apply security middleware in correct order.
2. Implement strict CORS and security headers.
3. Validate all inputs and outputs.
4. Add request/resource limits and endpoint rate limits.
5. Prevent mass assignment, injection, SSRF, unsafe redirects, and verbose errors.
6. Add timeouts, retry limits, and idempotency where needed.

**Exit criteria:**

- API security tests pass.
- Production errors expose no sensitive internals.
- Expensive flows have enforceable limits.

### Security Gate S5 — Frontend and Browser Hardening

**Objective:** Prevent browser-side disclosure, XSS, unsafe session handling, and false persistence states.

**Tasks:**

1. Audit frontend bundles and environment variables.
2. Add CSP and browser security headers.
3. Remove unsafe HTML rendering.
4. Remove sensitive persistent browser caching/storage.
5. Scrub analytics and error telemetry.
6. Test failed writes, refresh persistence, logout clearing, and CSRF if applicable.

**Exit criteria:**

- Frontend secret scan passes.
- XSS/CSP tests pass.
- Restricted content is absent from browser persistence and telemetry.

### Security Gate S6 — Encryption, Keys, and File Security

**Objective:** Protect restricted information at rest and ensure documents cannot become a secondary attack path.

**Tasks:**

1. Inventory encrypted fields and plaintext gaps.
2. Standardize authenticated encryption and key versions.
3. Move keys to approved secret storage.
4. Implement rotation and tamper-rejection tests.
5. Harden private buckets, signed URLs, upload validation, malware handling, and deletion.

**Exit criteria:**

- Restricted database fields contain ciphertext.
- Keys are separated from ciphertext.
- Cross-user file access is denied.
- Rotation and tamper tests pass.

### Security Gate S7 — AI and Privacy Controls

**Objective:** Limit external disclosure and prevent AI output/input from bypassing application security.

**Tasks:**

1. Map AI provider data flows and contracts.
2. Enforce consent and minimum-data requests.
3. Add prompt/tool boundaries and structured-output validation.
4. Add provider retention/training controls.
5. Implement budgets, rate limits, and kill switches.
6. Complete export, deletion, retention, and privacy-notice requirements.

**Exit criteria:**

- Provider requests contain only approved fields.
- Adversarial prompt tests cannot change authorization or tool permissions.
- Export/deletion tests cover every schema and storage location.

### Security Gate S8 — Logging, Monitoring, and Incident Response

**Objective:** Detect and investigate abuse without creating a second sensitive-data store in logs.

**Tasks:**

1. Implement structured redacted logging.
2. Add security audit events.
3. Add alert rules and operational dashboards.
4. Write incident, credential-rotation, session-revocation, and provider-shutdown runbooks.
5. Conduct an incident tabletop exercise.

**Exit criteria:**

- No restricted plaintext is found in test logs.
- Audit events exist for privileged workflows.
- Alert and incident drills are documented.

### Security Gate S9 — CI/CD and Supply Chain

**Objective:** Prevent insecure changes and vulnerable dependencies from reaching production.

**Tasks:**

1. Add secret, dependency, static, migration, type, test, lint, and build checks.
2. Protect production branches and environments.
3. Restrict CI credentials.
4. Establish patch and vulnerability-triage procedures.

**Exit criteria:**

- Required checks block unsafe merges/deployments.
- No unresolved critical/high dependency vulnerability remains without approved mitigation.

### Security Gate S10 — Full Validation and Independent Review

**Objective:** Prove the integrated application meets its documented security baseline.

**Tasks:**

1. Run complete unit, integration, database, browser, API, and adversarial security suites.
2. Map evidence to OWASP ASVS Level 2.
3. Run DAST only against the authorized staging environment.
4. Conduct an independent penetration test before real-user launch.
5. Resolve findings and rerun affected tests.

**Exit criteria:**

- No unresolved critical or high finding.
- All P0 requirements are `Verified`.
- All P1 requirements are `Verified` or have formally approved risk treatment.
- Security reviewer signs the release recommendation.

### Security Gate S11 — Production Release and Continuous Security

**Objective:** Release safely and maintain security after launch.

**Tasks:**

1. Complete a final environment/project-ref check.
2. Confirm production secrets, grants, RLS, storage, alerts, backups, and rollback.
3. Deploy using approved CI/CD.
4. Perform post-deployment smoke/security checks.
5. Schedule access reviews, dependency updates, restoration drills, security scans, and annual independent assessments.

**Exit criteria:**

- Production release checklist approved.
- Monitoring and response ownership active.
- Ongoing security-review schedule documented.

---

## 20. Required Test Matrix

| Test area | Required cases | Evidence |
| --- | --- | --- |
| Authentication | Missing, malformed, expired, revoked, wrong-project token; recovery abuse; MFA for admin | Automated auth tests |
| Object authorization | User A cannot read/update/delete User B records across every module | Two-user integration suite |
| Role authorization | Normal user cannot invoke admin/reviewer endpoints or change protected states | API integration tests |
| RLS/grants | `anon`, `authenticated`, `service_role`, and cross-user behavior for each table/action | pgTAP/database tests |
| Encryption | Round trip, unique IV, wrong key, altered ciphertext/tag, missing metadata, rotation | Crypto unit/integration tests |
| Input handling | Invalid type, length, unknown fields, injection strings, mass assignment | API validation tests |
| Resource abuse | Oversized body/file, high request volume, excessive range/token usage | Rate/resource-limit tests |
| CORS/CSRF | Allowed/disallowed origins; credential behavior; CSRF if cookies used | HTTP/browser tests |
| Frontend/XSS | Text rendering, unsafe HTML, CSP violations, sensitive browser storage | Browser/security tests |
| File security | MIME spoofing, oversized file, path manipulation, cross-user signed URL, expiry | Storage tests |
| SSRF | Loopback, private network, metadata endpoints, redirects, unexpected schemes | Outbound-fetch tests |
| AI boundary | Prompt injection, tool escalation, schema-invalid output, budget limits, kill switch | AI security tests |
| Privacy | Consent withdrawal, export isolation, deletion across schemas/storage/providers | End-to-end privacy tests |
| Logging | Secret/token/content redaction; audit-event presence | Log assertions |
| Deployment | Correct project target, no frontend secrets, migrations, headers, TLS | Release smoke tests |
| Recovery | Backup restoration, session revocation, key rotation, provider shutdown | Drill reports |

---

## 21. Production Release Blocking Criteria

Production MUST be blocked if any of the following is true:

1. The active project/environment cannot be proven.
2. A backend secret appears in frontend output, Git, logs, or screenshots.
3. Any cross-user access test fails.
4. A required table lacks RLS or has an unverified policy.
5. The service-role client is broadly used for normal user requests without equivalent verified authorization controls.
6. Restricted content is stored plaintext where encryption is required.
7. Verification files are publicly reachable.
8. Critical/high security findings remain unresolved.
9. Export or deletion can affect another user.
10. Logs contain restricted plaintext or credentials.
11. AI tools can bypass server-side authorization.
12. Backups or incident-response ownership is missing.
13. Security tests, typecheck, build, or migration validation fail.
14. Independent review has not occurred before real-user handling.

---

## 22. Definition of Done

The security program is ready for production approval only when:

- [ ] Every P0 requirement is implemented and independently verified.
- [ ] Every P1 requirement is implemented or has a time-bounded approved risk treatment.
- [ ] OWASP ASVS Level 2 requirements are mapped to implementation evidence.
- [ ] The threat model and data-flow diagram reflect the deployed architecture.
- [ ] Every API endpoint has authentication, authorization, validation, rate-limit, and test coverage status.
- [ ] Every table/view/function/storage bucket has a documented owner, grant, RLS/access policy, and test.
- [ ] Two-user cross-access tests pass for every data module.
- [ ] No frontend artifact contains backend secrets.
- [ ] No restricted plaintext appears in logs, analytics, error telemetry, or persistent browser storage.
- [ ] Encryption, key rotation, and tamper-rejection tests pass.
- [ ] Export and deletion cover all schemas, storage, caches, derived records, and provider workflows.
- [ ] Dependency, secret, static, database, typecheck, lint, build, integration, and security tests pass.
- [ ] Backup restoration, incident response, key rotation, and emergency shutdown have been exercised.
- [ ] No unresolved critical/high vulnerability remains.
- [ ] A qualified independent reviewer has assessed the staging deployment.
- [ ] Production release approval is recorded.

---

## 23. Codex Execution Rules

When Codex implements this plan, it MUST:

1. Read this entire document and the current architecture/status documents before changing code.
2. Record and preserve all pre-existing user-owned worktree changes.
3. Work only against the authorized new non-production Supabase project until production approval.
4. Never contact or mutate the legacy project.
5. Never print or commit credentials.
6. Complete one security gate at a time and update `SECURITY_IMPLEMENTATION_STATUS.md` after each gate.
7. Add tests together with every security control.
8. Use forward-only migrations and dry runs.
9. Stop only for a genuine authorization/credential requirement, unexpected real data, destructive ambiguity, or a risk needing owner acceptance.
10. Never mark a requirement `Verified` without reproducible evidence.
11. Do not commit, push, deploy to production, delete an environment, or rotate live credentials without explicit authorization.
12. Finish with an exact report of changed files, migrations, tests, evidence, unresolved risks, and confirmation that the legacy project was untouched.

---

## 24. Reference Standards

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Top 10](https://owasp.org/Top10/2025/)
- [Supabase: Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Express Production Security Best Practices](https://expressjs.com/en/advanced/best-practice-security/)

---

## 25. Final Security Position

ECHO must be treated as a high-sensitivity system, not as an ordinary content application. Security completion is determined by verified authorization boundaries, database policies, encrypted restricted data, minimal external disclosure, safe operational practices, and reproducible test evidence—not by the presence of security libraries alone.

This plan establishes the minimum engineering path toward a defensible release. It does not replace qualified privacy advice, independent penetration testing, or ongoing monitoring after deployment.
