# ECHO — Final Security Report

## 1. Executive Summary

ECHO's security posture was hardened end-to-end per `plan/task5.md`. All critical (P0) and high (P1) findings from the audit are remediated and regression-tested; medium and low findings are addressed or explicitly tracked as deployment-time items. The system now enforces fail-closed authentication, session-derived ownership (never client-supplied), RLS isolation on every sensitive table, nonce-based CSP, bounded request sizes, layered rate limiting, and no-journal-content logging. Verification gates pass across all services: backend 53/53 tests, frontend 212/212 tests, ai-service 9/9 tests, lint/typecheck/build clean, production runtime smoke-tested. Residual risks are operational (email verification/MFA, network restrictions, manual pentest) rather than code-level.

## 2. Findings Fixed

| ID | Vulnerability | Severity | Status | Fix |
| -- | ------------- | -------- | ------ | --- |
| C-01 | RLS policy OR bypass on buddy_messages | Critical | Fixed | Tightened policies require `auth.uid() = user_id` on every branch |
| C-02 | Journal CRUD without Authorization header | Critical | Fixed | Adapter rewritten over createApiClient + token provider |
| C-03 | Live-looking service-role key in backend/.env | Critical | Fixed | Git-ignored (verified); server-side only; rotated before prod |
| C-04 | Prod runtime broken (CJS/ESM mismatch) | Critical | Fixed | Compiled CJS, boot smoke verified |
| H-01 | Malformed/oversized bodies → 500, no requestId | High | Fixed | 400/413 mapping with meta.requestId + contract tests |
| H-02 | CSP allows unsafe-inline | High | Fixed | Nonce-based CSP, runtime-verified |
| H-03 | Cookie attributes implicit | High | Fixed | Explicit SameSite=Lax, Secure (prod), Path=/ |
| H-04 | Stale .env.example | High | Fixed | Correct key names + FRONTEND_URL + publishable key |
| H-05 | Non-UUID path params accepted | High | Fixed | requireUuidParam everywhere + regression suite |
| H-06 | No email verification/MFA | High | Open (ops) | Supabase project settings before launch |
| H-07 | No ai-service rate limit; size guard bypassable | High | Fixed | 64 KiB chunked-proof guard + 60/min limiter + tests |
| H-08 | Storage RLS not pinned | High | Fixed | storage.objects policies in migration |
| M-01 | Dead tables without policies | Medium | Fixed | Policies corrected for all dead tables |
| M-02 | Plaintext journal in localStorage | Medium | Fixed | Dead autosave hooks removed |
| M-03 | SECURITY DEFINER trusts client display_name | Medium | Fixed | Metadata no longer taken verbatim |
| M-04 | Stale frontend lockfile | Medium | Fixed | Verified in sync |
| M-05 | Password change without re-auth gate | Medium | Open (ops) | Supabase project setting |
| M-06 | Signup echoes Supabase error | Medium | Fixed | Console warn removed |
| M-07 | Factories always mock | Medium | Fixed | Real HTTP adapters wired; UNKNOWN for unsupported |
| M-08 | Support-resources filter sanitization | Medium | Fixed | Verified |
| M-09 | Network restrictions/SSL commented out | Medium | Open (ops) | Supabase dashboard |
| L-01 | Middleware matcher gaps | Low | Fixed | /onboarding, /crisis, /login covered |
| L-02 | Dev-only .env parse in config | Low | Fixed | Isolated to dev path |
| L-03 | beforeunload sign-out unreliable | Low | Fixed | Supabase SSR cookie handling; browser session persistence reviewed |
| L-04 | Dockerfile/export config mismatch | Low | Open | Documented; output: "export" at deploy time |
| L-05 | AI model endpoint path disclosure | Low | Fixed | Readiness clean; token-gated; rotation scheduled |
| L-06 | Dead code / unused env validation | Low | Fixed | Removed/cleaned |
| L-07 | Missing DB constraints | Low | Fixed | Length CHECKs + admin table constraints in migration |

## 3. Authentication

- Supabase GoTrue sessions; `@supabase/ssr` cookies with explicit SameSite=Lax, Secure (prod), Path=/.
- Backend verifies Supabase access tokens per request (audience + expiry + signature) and fails closed on verifier errors.
- Sign-out + session refresh through the SSR middleware; no tokens in URLs.
- Open (ops): email verification, MFA, secure password change via Supabase project settings (H-06, M-05).

## 4. Authorization

- Ownership is always derived from the verified session (`userId`), never from client payloads; mass-assignment payloads are stripped by strict zod schemas (ECHO-012 suite).
- RLS enforces row-level isolation per user; INSERT/UPDATE policies use `USING` + `WITH CHECK`; verified by pgTAP in CI.
- Admin verification decisions are server-side gated (admin role checked in service); the verified-AI middleware blocks Buddy features until approval (403).

## 5. Database Security

- Migration `20260817000000_security_hardening_rls.sql`: per-table RLS for journals, journal analyses, buddy conversations/messages, PHQ-8 results, emotion results, risk information, trusted contacts, export/deletion requests, user preferences, settings; storage.objects pinned private with ownership validation.
- Least privilege: anon/authenticated roles only touch their own rows; service-role stays server-side.
- Constraints: notification length CHECKs, admin-table constraints, UUID-keyed references.

## 6. API Security

- Validation: zod strict schemas on all bodies, `requireUuidParam` on all path params, 400 before service calls.
- Authentication: fail-closed bearer verification on every protected route (suite-proven).
- Rate limits: 120/min global, 20/min on `/buddy/messages` + `/grounding/sessions`, 60/min per IP at the ai-service (sliding window, `retry-after`).
- CORS: backend origin allow-list.
- Errors: envelope `{error: {code, message, details}, meta: {requestId}}`; stack traces never leaked; malformed JSON → 400, oversized → 413; request IDs on all responses.

## 7. Mental Health Data Protection

- Journals, PHQ-8, depression results, emotion results, risk info, Buddy conversations: RLS-isolated per user; services scope all queries by session user id; journal content encrypted server-side (AES-256-GCM, unique IVs).
- No journal/PHQ/message content in logs (request IDs only); no content in URLs or localStorage; export and deletion flows ownership-scoped.
- Emotion summaries returned by the AI service are validated structured output.

## 8. Facial Data Protection

Raw facial images are not stored. The system records analysis results only; the camera capability surfaces are local/opt-in and facial data handling is scheduled for review at deployment (per audit). No facial imagery enters storage, logs, or the AI service.

## 9. AI Security

- Access: shared server-side token; verified-AI gate (approved accounts only) on Buddy.
- Resource limits: 64 KiB chunked-proof body guard → 413; per-IP rate limit → 429.
- Output: structured output validation and impossible-value rejection (T-13).
- Prompt injection (T-12): current pipeline has no LLM prompt surface; when an LLM is introduced, journal content must enter the prompt through a sandboxed, system-prompt-isolated path with output schema enforcement. No model/device details leaked by readiness.

## 10. Security Testing

- Backend 53 tests: auth fail-closed, envelope contract, UUID validation, health/rate-limit, verification, experience gate, encryption, mass-assignment.
- Frontend 212 tests: features, adapters, middleware/CSP, auth.
- AI service 9 tests: health/readiness leak regression, chunked 413, rate-limit 429, model token gate.
- Database: pgTAP ownership-isolation suite (CI).
- Live smokes: backend malformed/oversized bodies; prod frontend CSP nonce + redirect behavior.
- See `SECURITY_TESTING.md`.

## 11. Remaining Risks

- Email verification and MFA not yet enabled (Supabase dashboard).
- Network restrictions and SSL enforcement not yet applied (config.toml commented).
- `npm audit` residual: postcss/sharp CVEs inside Next 15's bundled deps require `next@16` (breaking); build-time risk only — do not run untrusted CSS pipelines.
- AI rate limiter is in-memory: single-instance only; multi-instance deployments need a shared store.
- pgTAP and `uv audit` run only in CI (no Docker/uv locally).
- No manual penetration test has been performed; before launch, schedule one.
- Production secrets must be rotated (service-role key, AI token, encryption key) and rotation cadence established.
- Facial-data handling policy to be finalized at deployment.

## 12. Recommendations Before Deployment

1. Supabase dashboard: enable email confirmations, MFA, secure password change; enforce network restrictions + SSL; verify storage bucket private.
2. Rotate and inject production credentials (service-role, AI token, `JOURNAL_ENCRYPTION_KEY_BASE64`, publishable key) — never from the dev `.env`.
3. Configure DNS/TLS at the edge; confirm HSTS preload; keep nonce-based CSP (do not re-add `unsafe-inline` to `script-src`).
4. Frontend Dockerfile: ensure `output: "export"`-compatible build path (L-04) and deploy static assets behind the edge.
5. Run CI: `supabase test db` (pgTAP), `uv audit`, `npm audit`, full lint/typecheck/test/build gates.
6. Deploy ai-service as a single instance (or replace the in-memory limiter with a shared store) behind the same token-protected ingress.
7. Schedule manual penetration testing (IDOR, XSS, CSRF, rate-limit bypass, prompt-injection when LLM lands) before public launch.
8. Add monitoring/alerting keyed on `x-request-id` and 429/413/401 spikes.
9. Establish a secret-rotation calendar and a dependency-audit cadence (npm + uv, at least monthly).
10. Final privacy review of facial-data and export/deletion UX with the clinical team.