# ECHO — Security Changelog

> Historical hardening record. Current microservice credential ownership is defined by the root and per-service `.env.example` contracts.

Chronological record of security-hardening changes (references `SECURITY_AUDIT.md` finding IDs and `THREAT_MODEL.md` threat IDs).

## 2026-08-17 — Full hardening pass (`plan/task5.md`)

### Critical (P0)
- **C-01 / T-02 — RLS policy OR bypass.** Rewrote `supabase/migrations/20260817000000_security_hardening_rls.sql`: tightened `buddy_messages` policies to require `auth.uid() = user_id` on every `message_role` branch (dropped permissive buddy-role branch); added `USING` + `WITH CHECK` to all INSERT/UPDATE policies.
- **C-02 / T-03 — Unauthenticated journal CRUD.** `journal.http-adapter.ts` rewritten over `createApiClient` with `supabaseAuthTokenProvider` (Authorization header always attached); adapter paths are `/api/v1/...` absolute via `env.apiBaseUrl`.
- **C-03 / T-04 — Secret handling.** `backend/.env` git-ignored (verified); `.env.example` updated (H-04); secrets never in browser bundles (service-role key is server-only).
- **C-04 — Production runtime.** Backend compiled to CommonJS, `package.json` ESM mismatch fixed; production `node dist/...` boot smoke verified.

### High (P1)
- **H-01 — Malformed/oversized bodies.** `PayloadTooLargeError` (413) added; `backend/src/app.ts` reordered (request-id + logger above `express.json`) with body-parser error mapper (malformed → 400, oversized → 413, both with `meta.requestId`); contract tests added.
- **H-02 — CSP.** Nonce-based CSP in `frontend/src/middleware.ts` (`crypto.getRandomValues` + `btoa`); prod `script-src 'self' 'nonce-…'`; nonce applied to theme script and all inline scripts via async `RootLayout`; CSP removed from `next.config.ts` (duplicate-header risk); matcher covers `/login` (fixed prod redirect loop); verified at runtime.
- **H-03 — Cookie attributes.** Explicit `sameSite: "lax"`, `secure` (prod), `path: "/"` on Supabase middleware and server clients (`middleware-client.ts`, `server-client.ts`).
- **H-05 — UUID validation.** `requireUuidParam` (zod UUID) in `backend/src/shared/utils/uuid-param.ts`; applied to all journal/contact/deletion-cancel/verification path params; 400 `ValidationError` before service call; regression suite added.
- **H-07 — AI service limits.** 64 KiB body guard made chunked-encoding-proof (capped streaming receive, `http.disconnect`); in-memory sliding-window rate limiter (60/min/IP, `retry-after` + `x-request-id`); registered after request-id middleware; tests added.
- **H-08 — Storage RLS.** `storage.objects` policies pinned in the migration (private bucket, ownership-validated).

### Medium (P2)
- **M-01 — Dead tables.** RLS policies fixed for `grounding_sessions`, `export_requests`, `deletion_requests`, `user_preferences` (kept per decision).
- **M-02 — Plaintext draft persistence.** Dead plaintext localStorage autosave hooks removed from the codebase (no journal content in browser storage).
- **M-03 — `SECURITY DEFINER` display_name.** `private.handle_new_user()` no longer trusts client metadata verbatim.
- **M-04 — Stale lockfile.** `frontend/package-lock.json` verified in sync with `package.json`.
- **M-06 — Signup logging.** Supabase error text no longer echoed via `console.warn` on signup.
- **M-07 — Factory wiring.** Buddy/insights/grounding factories now return real HTTP adapters when `NEXT_PUBLIC_DATA_ADAPTER_MODE` is http; unsupported backend features return explicit UNKNOWN errors (no fabricated data).
- **M-08 — Support-resources filter.** Sanitization verified for the RPC-style `.or()` filter.
- **M-09 — Network restrictions/SSL.** Noted in config.toml; deployment-time dashboard change required (open item).

### Low / Hardening (P3)
- **L-01 — Middleware matcher** extended to cover `/onboarding/*`, `/crisis/*`, `/login` (CSP on all responses).
- **L-02 — Dev-only env parse** isolated to development configuration path.
- **L-04 — Dockerfile/export config** discrepancy documented; `.dockerignore` updated.
- **L-05 — AI model endpoint.** Path disclosure removed from readiness; endpoint remains token-gated; token rotation scheduled (open item).
- **L-06 — Dead code** (`ensureOwnedConversation`) and unused-validated env vars cleaned up.
- **L-07 — Notification length CHECKs / admin table constraints** added to migration.
- **P3 — Request IDs** on every response (backend + ai-service 429s); additional audit context via `x-request-id`.

### Dependency & Defense-in-Depth
- **T-22 — npm audit:** fixed `ip-address` (SSRF class, high) and `nanoid` (high) via `npm audit fix`; remaining postcss/sharp require `next@16` (breaking; pinned-major limitation, build-time risk only).
- **Rate limits:** global 120/min/IP; stricter 20/min on POST `/buddy/messages` and `/grounding/sessions` (`experience.routes.ts`).
- **Mass-assignment suite:** `backend/tests/security/mass-assignment.test.ts` (ECHO-012) — privileged fields stripped across journals/settings/admin decisions.
- **UUID suite:** `backend/tests/uuid-validation.test.ts` (ECHO-H05).
- **Contract suite:** `backend/tests/contract.test.ts` (ECHO-009).
- **pgTAP:** `supabase/tests/database/ownership-isolation.test.sql` (CI-executed).

### Verification gates passed
Backend: typecheck, lint (0 errors), 53/53 tests, build, boot smoke, live malformed-JSON → 400. Frontend: typecheck, lint (0 errors), 212/212 tests, production build + runtime CSP/nonce/redirect verification. AI service: 9/9 pytest, ruff clean.
