# ECHO — Security Testing

## Backend (`backend/tests`)

Run: `npm test -w backend` (53 tests)

| Suite | Coverage |
| ----- | -------- |
| `auth.fail-closed.test.ts` | Missing/non-Bearer/empty/invalid/expired/wrong-audience tokens → 401; verifier failure → 401; whitespace trimming; every protected route covered; public endpoint stays open |
| `contract.test.ts` | Envelope shape; 200/401/400/413 mapping; malformed JSON → 400; oversized body → 413; per-request `meta.requestId`; no stack leaks; unknown routes → envelope 404 |
| `uuid-validation.test.ts` | All path params validated as UUIDs (journals ×3 verbs, contacts ×2, deletion-cancel, verification ×3); malformed → 400 before service call |
| `health.test.ts` | Standardized health; safe 404; no request data in error responses; global rate limit |
| `verification.routes.test.ts` | Auth required; protected document payloads; adult-application contract |
| `experience.routes.test.ts` | Dashboard auth-gated; support-resources public; Buddy message validation; verified-AI gate (403); grounding recording |
| `unit/encryption.service.test.ts` | AES-256-GCM round-trip, unique IVs, tamper/invalid-key rejection |
| `unit/verification.service.test.ts` | Age rules; guardian vs adult evidence |
| `unit/environment.test.ts` | Config validation; production rejects mock analysis and invalid keys |
| `unit/mock-analysis.provider.test.ts` | Explicit dev markers; deterministic failures |
| `security/mass-assignment.test.ts` | `user_id`/`role`/`verification_status`/`reviewed_by` stripped from journal, settings, and admin-decision payloads; owner always session-derived (ECHO-012) |

## Frontend (`frontend` vitest, 212 tests)

Run: `npm test -w frontend`

Journal, buddy, insights, grounding feature tests (view models + adapters, incl. error mapping and `canAccessAi` fallback), auth adapter, middleware behavior, CSP nonce application, and all pre-existing component/utility suites.

## AI Service (`ai-service/tests`)

Run: `ai-service\.venv\Scripts\python.exe -m pytest tests -q` (9 tests)

- Health/readiness returns no device or environment details (leak regression).
- Oversized body via chunked encoding → 413 (bypass-proof guard).
- >60 requests/min per IP → 429 with `retry-after` + `x-request-id`.
- Model endpoint token-gated; prompt-output contract.

## Database (pgTAP — CI only)

Run in CI: `supabase test db` (no local Docker/supabase CLI in dev environment)

`supabase/tests/database/ownership-isolation.test.sql` asserts per-table RLS isolation for journals, buddy conversations/messages, journal analyses, PHQ-8 results, emotion results, risk information, trusted contacts, export requests, deletion requests, and profile settings.

## Live Smoke Checks (manual, documented in gates)

- Backend boot: `GET /api/v1/health` → 200 envelope.
- Malformed JSON POST → 400 with `requestId`; oversized → 413.
- Frontend prod build: `/` 200 with strict CSP; every inline script carries the nonce; `/dashboard` unauthenticated → 307; `/login` with no config → 200 (no redirect loop).

## Tooling

| Check | Command |
| ----- | ------- |
| Backend typecheck | `npm run typecheck -w backend` |
| Backend lint | `npm run lint -w backend` |
| Backend build | `npm run build -w backend` |
| Frontend typecheck | `npm run typecheck -w frontend` |
| Frontend lint | `npm run lint -w frontend` |
| Frontend build | `npm run build -w frontend` |
| AI lint | `ai-service\.venv\Scripts\ruff.exe check .` |
| Dependency audit | `npm audit --omit=dev`; `uv audit` (ai-service, CI) |