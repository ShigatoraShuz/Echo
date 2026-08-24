# Plan 7 QA/Security Report

Date: 2026-08-24
Scope: full baseline checks, static RLS/auth-boundary audit, database policy review.
Environment note: Docker/Podman unavailable on this machine, so local-stack runtime checks (`supabase test db`, live integration) could not execute. Those items are marked BLOCKED below rather than skipped silently.

## Baseline results

| Check | Workspace | Result |
|---|---|---|
| typecheck | frontend + backend | PASS |
| lint | frontend + backend | PASS (0 errors; pre-existing warnings only) |
| unit tests | frontend | PASS (56 files / 233 tests) |
| unit tests | backend | PASS (14 files / 68 tests) |
| build | frontend (Next 16.3.2, 35 routes) | PASS |
| build | backend | PASS |

## Database policy surface (static audit)

- 25/25 public tables have RLS enabled across the migration chain.
- 90 CREATE POLICY statements total; all 22 role-unqualified policies (from 20260728000001/000002) are dropped by 20260817000000_security_hardening_rls.sql. Final state: 0 role-unqualified policies. The pgTAP structural assertion (`no role-unqualified policies remain`) should hold.
- buddy_messages final policy set: select only through owned conversation; insert restricted to `message_role = 'user'`, `model_version_id is null`, own conversation. Assistant-role injection and cross-user writes are impossible via policies.
- Every UPDATE policy on sensitive tables carries both USING and WITH CHECK ownership conditions.
- storage.objects privileges revoked from anon/authenticated (uploads/downloads flow through the API).
- Migration chain consistency verified: canonical encrypted tables are created in 20260724021728; later `create table if not exists` duplicates in 20260728000000 are no-ops for those names, so the strict shapes win. Policy drop/recreate pairs are idempotent.

## Backend auth boundary

- All feature routers (journal, experience, settings, onboarding, verification) sit behind `createAuthMiddleware`; missing/malformed Bearer tokens reject with AuthenticationError before controllers run.
- Tokens verified server-side via `supabaseAdmin.auth.getUser(accessToken)`; verifier failures fail closed (treated as no session, never passed through).
- Service-role key included in log redaction list; unknown errors normalize to a generic 500 with no stack trace or internals.

## Findings

1. MEDIUM - Dead schema surface with live grants: `grounding_sessions`, `export_requests` (shadow), `deletion_requests` (shadow), and `user_preferences` are created, RLS-enabled, granted to authenticated, and locked into the pgTAP contract, but no application code reads or writes them. Grounding persists as `audit_events`; export/deletion/preferences use the canonical `data_export_requests`, `account_deletion_requests`, and `privacy_preferences`. Recommendation: new migration dropping the four shadow tables plus revoking their grants, and update the pgTAP assertions accordingly.
2. LOW - Unqualified DDL in migrations: 20260728000000/000002 create tables without schema qualifiers (search_path-dependent). Harmless under the CLI's postgres role today, but fragile. Recommendation: qualify with `public.` in future migrations.
3. LOW - Error middleware sends `appError.details` to clients unredacted while logs redact them (backend/src/shared/middleware/error.middleware.ts:29). No current AppError appears to carry sensitive details, but the asymmetry invites leaks. Recommendation: apply `redact()` to response details too.
4. INFO - Tables with zero policies (`audit_events`, `model_versions`, `analysis_windows`, `journal_drafts`, `verification_*`, `safety_events`) are intentional API-only surfaces reachable solely via service_role; consistent with the architecture.

## Blocked items (environment)

- `supabase test db` (rls-policy.test.sql, ownership-isolation.test.sql): requires Docker Desktop/Podman; neither installed.
- Live integration path (`backend/tests/e2e/live-integration.mjs`): requires configured local services/credentials.
- Manual browser walkthrough of route groups: requires running frontend/backend with credentials.

## Acceptance criteria status

- No uncaught runtime errors on core flows: NOT VERIFIED (browser walkthrough blocked).
- No broken routes or auth redirects: PARTIAL - builds compile all 35 routes; runtime gating unverified.
- No cross-user data exposure: PASS statically (RLS + WITH CHECK + server-side auth enforced); runtime confirmation pending DB tests.
- No critical/high security findings open: PASS (highest open finding is medium).
- Medium/low findings documented: DONE (above).
