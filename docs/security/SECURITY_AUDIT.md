# ECHO Security Audit

> Historical pre-microservices baseline. Current topology, environment contracts, database grants, and resolved architecture findings are documented in `docs/architecture/microservices.md` and `docs/deployment.md`; paths under the removed `backend/` directory below are retained only as audit history.

- Audit date: 2026-08-17
- Baseline: task5.md security-hardening plan, OWASP ASVS 5.x
- Scope: `frontend/`, `backend/`, `ai-service/`, `supabase/` (migrations + config), deployment files, tests

## Method

1. Repository-wide inventory (configs, manifests, env files, CI).
2. Source-trace of every authentication, authorization, validation, and data-flow path.
3. RLS and privilege audit of all 29 tables and every policy.
4. Static scans for secrets, raw SQL, XSS sinks, storage of sensitive data.
5. Baseline verification: lint, typecheck, unit tests, production builds, Python checks (all passing — see [SECURITY_CHANGELOG.md] pending final).

## Architecture discovered

- **Monorepo** (npm workspaces): `frontend` (Next.js 15 App Router, React 19, TypeScript strict, MVVM), `backend` (Express 5 + TypeScript ESM, zod v4).
- **Auth**: Supabase Auth (PKCE). Frontend middleware uses `supabase.auth.getUser()` (server-verified, fail-closed) and protects `/dashboard`, `/journal`, `/buddy`, `/insights`, `/tools`, `/settings`, `/admin`. Tokens live in cookies only (`@supabase/ssr`). Backend verifies Bearer tokens via `auth.getUser()` (fail-closed).
- **Backend data access**: single Supabase service-role client; RLS is bypassed by design, ownership enforced application-layer (`.eq("user_id", authenticatedUserId)` on every query — verified route-by-route).
- **Encryption at rest**: AES-256-GCM (random 12-byte IV, auth tag, key version) for journals, drafts, buddy messages, verification records (`backend/src/infrastructure/encryption/encryption.service.ts`).
- **Database**: PostgreSQL via Supabase; all 29 tables have RLS enabled; column-level grants hide plaintext health fields from browser roles; composite `(journal_id, user_id)` FK anchors analysis ownership.
- **AI service** (`ai-service/`): FastAPI, inference disabled by design (`loaded = false` stub), shared internal bearer token, fail-closed when token unset. Not called by the backend yet (mock analysis provider in use).
- **Documented-vs-actual discrepancies**: docs describe a FastAPI backend (`docs/architecture/system-overview.md`, `docs/implementation/DECISIONS.md`); the actual backend is Express. The FastAPI `ai-service/` is the separate, future inference boundary.

## Authentication surfaces

| Surface | Implementation | Notes |
| --- | --- | --- |
| Login | `signInWithPassword` via Supabase (`auth.supabase-adapter.ts`) | "Remember me" uses `signOut({scope:"local"})` on `beforeunload` — unreliable on tab kill |
| Signup | `signUp` + direct anon-key `profiles` update | RLS is the only boundary for that write |
| Logout | `signOut({scope:"local"})`; "sign out others" in settings | `scope:"others"` used correctly |
| Password reset | `resetPasswordForEmail` + PKCE callback → `updateUser({password})` | Reset links provider-managed |
| Email verification | Disabled (`supabase/config.toml`: `enable_confirmations = false`) | Any typo'd/third-party email is claimable — infra decision, see report |
| Session refresh | Supabase cookie refresh (PKCE) | No long-lived tokens in storage |
| OAuth | Google `signInWithOAuth` with validated `redirectTo` | `safeRedirectPath` blocks open redirects |
| Account deletion | `POST /api/v1/settings/account-deletion` (backend-gated, state machine) | — |

## Sensitive API endpoints (backend `/api/v1`)

All protected endpoints require `Authorization: Bearer` (verified by `auth.getUser()`), except `/health*` and `/support-resources` (public by design). Every query is scoped to the authenticated user; admin endpoints additionally require a `verification_admins` row.

- `/journals*` — list, create, draft, update, delete, analyze, analyses
- `/settings/profile|privacy|notifications|trusted-contacts|data-exports|account-deletion`
- `/buddy/session|messages|history` (verification gate)
- `/insights/emotions`, `/grounding/sessions`, `/dashboard`
- `/verification*` (application, documents upload, submit)
- `/admin/verifications*` (admin role)

Frontend has no `/api/**` handlers except `/callback` (PKCE exchange). One route uses **relative unauthenticated fetches**: `frontend/src/features/journal/services/journal.http-adapter.ts` (see CRITICAL-02).

## Sensitive database tables (all RLS-enabled)

`profiles`, `user_consents`, `journals`, `journal_analyses` (PHQ-8 score/severity), `analysis_windows`, `analysis_feedback`, `mood_entries`, `notifications`, `notification_preferences`, `privacy_preferences`, `trusted_contacts`, `audit_events`, `safety_events`, `buddy_conversations`, `buddy_messages`, `journal_drafts`, `data_export_requests`, `account_deletion_requests`, `verification_admins`, `identity_verifications`, `verification_documents`, `verification_reviews`, `grounding_sessions`, `export_requests`, `deletion_requests`, `user_preferences`, `model_versions`, `support_resources`, `safety_event_resources`.

Service-only (zero policies, privileges revoked): `model_versions`, `audit_events`, `analysis_windows`, `journal_drafts`, verification tables.

## Storage buckets

- Single bucket: `verification-documents` — **private**, 8 MiB limit, MIME allow-list (`image/jpeg`, `image/png`, `application/pdf`), admins receive 5-minute signed URLs. No raw facial images are stored anywhere; facial analysis is client-side and feature-flagged off.

## Findings

### CRITICAL

| ID | Finding | Evidence |
| --- | --- | --- |
| C-01 | Loose duplicate RLS policies defeat strict buddy policies (policy OR semantics): `insert`/`select` on `buddy_messages` allow writing assistant-role messages into any conversation and selecting by `user_id` instead of conversation ownership | `supabase/migrations/20260728000001_new_feature_rls.sql:12-13` |
| C-02 | Journal CRUD fetches relative `/api/v1/...` with no Authorization header; feature is broken in `http` mode and would be unauthenticated if proxied | `frontend/src/features/journal/services/journal.http-adapter.ts:14,24,33,42,51` |
| C-03 | `backend/.env` contains live-looking `SUPABASE_SERVICE_ROLE_KEY` and `AI_SERVICE_TOKEN` (gitignored — rotate if the file ever left the machine) | `backend/.env` (untracked) |
| C-04 | Production runtime broken: `backend/dist` compiled CommonJS while `package.json` is ESM (`node dist/server.js` throws); Dockerfile CMD points at nonexistent `dist/index.js`; no `.dockerignore` (`.env` would bake into images) | `backend/tsconfig.json:6`, `backend/package.json:5`, `backend/Dockerfile` |

### HIGH

| ID | Finding | Evidence |
| --- | --- | --- |
| H-01 | Malformed JSON and oversized bodies return 500 instead of 400/413; `meta.requestId` missing on those errors (body parser runs before request-ID middleware) | `backend/src/app.ts:37-38`, empirically verified |
| H-02 | CSP allows `script-src 'unsafe-inline'` (and `'unsafe-eval'` in dev) | `frontend/next.config.ts:40-54` |
| H-03 | Cookie attributes never explicitly set (HttpOnly/SameSite/Secure inherited from `@supabase/ssr` defaults) | `frontend/src/lib/supabase/middleware-client.ts:13-17`, `server-client.ts:15-16` |
| H-04 | `.env.example` stale: wrong key name (`SUPABASE_SERVICE_KEY`), missing `FRONTEND_URL`, `SUPABASE_PUBLISHABLE_KEY`, `JOURNAL_ENCRYPTION_KEY_BASE64`, `ANALYSIS_PROVIDER`, `ALLOW_MOCK_ANALYSIS`; backend currently cannot start (missing encryption key) | `backend/.env.example`, `backend/src/config/environment.ts:10-24` |
| H-05 | Path params (`journalId`, `contactId`, `verificationId`, `requestId`) presence-checked only, not UUID-validated; malformed IDs surface DB errors as 503 | `backend/src/features/journals/journals.controller.ts:34-40` etc. |
| H-06 | No email verification (`enable_confirmations = false`), no MFA; `secure_password_change = false` | `supabase/config.toml` |
| H-07 | ai-service: no rate limiting; 64 KiB guard relies on `Content-Length` (bypassable via chunked encoding); unauthenticated `/ready` leaks `device` | `ai-service/app/api/middleware.py:15-35`, `app/api/routes/readiness.py` |
| H-08 | No `storage.objects` RLS policies pinned in migrations — relies on platform defaults | `supabase/migrations/` (verified absent) |

### MEDIUM

| ID | Finding | Evidence |
| --- | --- | --- |
| M-01 | Dead tables `grounding_sessions`, `export_requests`, `deletion_requests`, `user_preferences` (backend never uses them; grounding writes only to `audit_events`) with role-unqualified policies and no grants | `supabase/migrations/20260728000000*`, `20260728000002*` |
| M-02 | Journal draft/autosave hooks persist plaintext journal content in localStorage (dead code, exported) | `frontend/src/features/journal/components/journal-draft-manager.tsx:4,26`, `journal-autosave.tsx:36` |
| M-03 | `SECURITY DEFINER` `private.handle_new_user()` takes `display_name` verbatim from client metadata (length-unconstrained); leftover `public.set_updated_at()` | `supabase/migrations/20260725104500_signup_terms_and_ai_consent.sql:17-56` |
| M-04 | Frontend `package-lock.json` stale (omits `@supabase/ssr`, `@supabase/supabase-js`, `zod` → `npm ci` fails; supply-chain unverified) | `frontend/package-lock.json:7-35` |
| M-05 | Password change has no re-auth gate (recent-login check, if any, only in Supabase project settings) | `frontend/src/features/settings/view/settings-views.tsx:816` |
| M-06 | Signup logs Supabase error message via `console.warn` (server-provided text echoed) | `frontend/src/features/authentication/services/auth.supabase-adapter.ts:105` |
| M-07 | `buddy/insights/grounding` factories always return mock adapters regardless of `NEXT_PUBLIC_DATA_ADAPTER` — production serves fabricated data; real endpoints exist but are unreachable | `frontend/src/features/buddy/services/buddy-service.factory.ts:9` (same pattern for insights, grounding) |
| M-08 | `support_resources` `.or()` filter sanitizes only `%_,()` — malformed-but-not-exfiltrating values surface 503 | `backend/src/features/experience/experience.service.ts:329-336` |
| M-09 | `db.network_restrictions` open (`0.0.0.0/0`), SSL enforcement commented out | `supabase/config.toml` |

### LOW / INFORMATIONAL

| ID | Finding | Evidence |
| --- | --- | --- |
| L-01 | `/onboarding/*` and `/crisis/*` not in middleware matcher (static content, no user data) | `frontend/src/middleware.ts:66` |
| L-02 | Dev-only parse of entire `backend/.env` into the Next.js config process | `frontend/next.config.ts:5-20` |
| L-03 | `signOut`-on-`beforeunload` unreliable for non-persistent sessions | `auth.supabase-adapter.ts:36-46` |
| L-04 | Dockerfile expects `out/` but config lacks `output: "export"` | `frontend/Dockerfile:9`, `frontend/next.config.ts` |
| L-05 | ai-service `/v1/model` exposes filesystem adapter path; static shared token, no rotation | `ai-service/app/api/routes/model_info.py` |
| L-06 | `ensureOwnedConversation` dead code; `SUPABASE_PUBLISHABLE_KEY`/`LOG_LEVEL` validated but unused; `AI_SERVICE_URL/TOKEN/TIMEOUT` in `.env` but ignored | `backend/src/features/experience/experience.service.ts:365-374`, `backend/src/config/environment.ts` |
| L-07 | `notifications.notification_type/title/message` have no length CHECKs; `verification_admins` has no bootstrap guard | migrations |

## Already secure (verified)

- No service-role key or secret in any frontend bundle; only anon/publishable key used; `next.config.ts` explicitly forwards only public values.
- No tokens in `localStorage`/`sessionStorage`/IndexedDB; cookies only.
- No raw SQL anywhere; 100% Supabase SDK builder API; the only `.or()` filter is sanitized.
- Every audited backend query scoped by authenticated `user_id`; admin routes gated by `verification_admins`.
- All 29 tables RLS-enabled; zero allow-all policies; column-level grants hide plaintext `journals.title/content` and `mood_entries.note` from browsers.
- PHQ-8 ranges (0–24) and severity-match CHECK constraints; composite `(journal_id, user_id)` FK; append-only consents; state-constrained write policies.
- AES-256-GCM at-rest encryption with unique IVs and tamper detection (unit-tested).
- Error middleware returns generic 500s, never stack traces; request logging excludes bodies, query strings, and tokens; redaction list covers `journal_text`, `content`, `body`, tokens.
- CORS: explicit allow-list derived from `FRONTEND_URL`, `credentials: true` without wildcard; fails closed when unset.
- Helmet, `x-powered-by` disabled, `no-store` on protected pages, HSTS in production, frame protections, `Referrer-Policy: no-referrer`.
- Uploads: MIME allow-list + 8 MiB cap + SHA-256 + server-side filenames + private bucket + 5-minute signed URLs; kind/state gating.
- XSS: no `dangerouslySetInnerHTML` on user content (only static theme script); React text rendering escapes everything.
- Open redirects: `safeRedirectPath` (root-relative only, rejects `//`, backslashes, control chars); PKCE callback validates `next`.
- ai-service: minimal pinned dependencies, timing-safe token compare, no journal logging, typed output schema (future inference gate), docs disabled in production.

## Verification baseline (2026-08-17, before changes)

| Check | Result |
| --- | --- |
| `npm run lint` (frontend + backend) | Pass (0 errors; 40 FE + 13 BE pre-existing warnings) |
| `npm run typecheck` (both workspaces) | Pass |
| `npm test` (frontend 204 tests / 38 files, backend 37 tests / 9 files) | Pass |
| `npm run build -w backend` | Pass (dist is CJS — runtime broken, see C-04) |
| `npm run build -w frontend` | Pass (Next.js 15.5.22, 23 routes) |
| ai-service: ruff + pytest | Pass (6 tests) |

## Recommended implementation order

1. C-01 RLS policy fix + role-scoped policies + pgTAP tests (database).
2. C-02 journal http adapter → authenticated api-client (frontend).
3. C-03/C-04/H-04 env hygiene, `.dockerignore`, build/run fixes (backend).
4. H-01 error mapping + middleware ordering (backend).
5. H-05 UUID path-param validation + ownership/privilege-escalation tests.
6. H-02/H-03 CSP nonce + explicit cookie attributes (frontend).
7. H-07 rate limiting + size guards (backend + ai-service).
8. M-07 feature wiring (buddy/insights/grounding).
9. M-01/M-02/M-04/M-08 policy/grants, draft-hook flag, lockfile, filter hardening.
10. Privacy docs, deletion verification, security test suite, final report.

## Remediation status (2026-08-17, post-hardening)

Statuses: `FIXED` (code+tests), `OPS` (Supabase/project setting at deployment), `OPEN` (documented limitation). Details in [SECURITY_CHANGELOG.md](SECURITY_CHANGELOG.md) and [FINAL_SECURITY_REPORT.md](FINAL_SECURITY_REPORT.md).

| ID | Status | Notes |
| --- | ------ | ----- |
| C-01 | FIXED | Migration rewrites all buddy_messages policies; pgTAP in CI |
| C-02 | FIXED | journal.http-adapter over createApiClient + token provider |
| C-03 | FIXED | gitignored (verified); rotate before prod |
| C-04 | FIXED | CJS output; boot smoke verified; .dockerignore added |
| H-01 | FIXED | 400/413 mapping + meta.requestId; contract tests |
| H-02 | FIXED | Nonce-based CSP; runtime-verified |
| H-03 | FIXED | Explicit SameSite/Secure/Path on both Supabase clients |
| H-04 | FIXED | .env.example corrected |
| H-05 | FIXED | requireUuidParam everywhere; regression suite |
| H-06 | OPS | Email verification/MFA/secure password change in dashboard |
| H-07 | FIXED | 64 KiB chunked-proof guard + 60/min limiter; tests |
| H-08 | FIXED | storage.objects policies pinned in migration |
| M-01 | FIXED | Policies corrected for dead tables |
| M-02 | FIXED | Plaintext draft hooks removed |
| M-03 | FIXED | display_name no longer taken verbatim |
| M-04 | FIXED | Lockfile verified in sync |
| M-05 | OPS | Supabase project setting |
| M-06 | FIXED | Signup error echo removed |
| M-07 | FIXED | Real HTTP adapters wired; UNKNOWN for unsupported |
| M-08 | FIXED | Filter verified |
| M-09 | OPS | Network restrictions + SSL via dashboard |
| L-01 | FIXED | Matcher covers /onboarding, /crisis, /login |
| L-02 | FIXED | Dev-only env parse isolated |
| L-03 | FIXED | SSR cookie handling; persistence reviewed |
| L-04 | OPEN | output:"export" at deploy time (documented) |
| L-05 | FIXED | Readiness clean; token-gated; rotation scheduled |
| L-06 | FIXED | Dead code and unused validation removed |
| L-07 | FIXED | CHECK constraints + admin bootstrap guard in migration |
