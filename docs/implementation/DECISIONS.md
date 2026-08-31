# Echo Architecture and Security Decisions (ADR-style ledger)

> Historical decision ledger for the removed modular monolith. The accepted current topology is the microservices architecture in [`docs/architecture/microservices.md`](../architecture/microservices.md); conflicting entries below are superseded.

Rule: record every architectural, security, or product decision that affects backlog items. Each entry: date, decision, rationale, alternatives considered, consequences, status. Backlog ACs and executable code override these notes if they conflict.

## ADR-001 — Modular monolith with canonical Express API (2026-08-15)

- **Status:** Accepted (backlog §1, §3.3).
- **Decision:** Echo remains a modular monolith: Next.js frontend, one Express API (`backend/src/server.ts` + `backend/src/app.ts`), one FastAPI AI service reached only via authenticated internal calls, Supabase/PostgreSQL canonical store.
- **Rationale:** The supplied `Layered_architecture.md` prescribes microservices; the QA review (backlog §3.4) explicitly retains the modular-monolith target. Service extraction only on measured need.
- **Consequences:** ECHO-002 must retire the legacy `backend/src/index.ts`/`v1.ts` stack. Repository boundary (ECHO-086) is required before services can stop calling Supabase directly.

## ADR-002 — Legacy backend stack retirement strategy (2026-08-15)

- **Status:** Accepted (ECHO-002).
- **Decision:** `backend/src/index.ts`, `backend/src/routes/v1.ts`, legacy feature routes (buddy, grounding, insights, onboarding, journal, settings sub-routes), legacy `shared/middleware/auth.ts`, `shared/middleware/errorHandler.ts`, and `shared/errors/AppError.ts` are quarantined (moved out of the compiled `src` tree) rather than hand-edited into the active stack.
- **Rationale:** The legacy files contain syntax errors, reference uninstalled packages (`morgan`, `@jest/globals`), use a decode-and-trust JWT verifier, and duplicate active routes. Quarantine preserves history while making the compiled surface unambiguous.
- **Consequences:** ECHO-001 fixes are applied to the quarantined copies so the syntax errors are documented as resolved; active composition root remains `server.ts` -> `app.ts` -> `v1.routes.ts`.

## ADR-003 — Backend modules use `.js` ESM import specifiers (2026-08-15)

- **Status:** Accepted.
- **Decision:** The backend is `"type": "module"`; source imports use explicit `.js` extensions (already the convention in `app.ts`, `v1.routes.ts`, services, and middleware). New backend code MUST follow this convention.
- **Rationale:** `tsc` + Node ESM resolution require explicit extensions; mixing specifier styles caused the earlier breakage.
- **Consequences:** ESLint config for the backend MUST be an ESM flat config (`eslint.config.js` with `export default`) — see ECHO-005.

## ADR-004 — Frontend lint migrates from `next lint` to ESLint CLI (2026-08-15)

- **Status:** Accepted (ECHO-005).
- **Decision:** Replace the deprecated `next lint` script with `eslint` CLI flat config (`eslint.config.mjs`) based on `eslint-config-next` (flat variant), preserving `next/core-web-vitals` + `next/typescript` rules.
- **Rationale:** Next.js 15.1 warns `next lint` is deprecated and removed in Next 16; `frontend/package.json` will be upgraded at ECHO-006 with pinned runtimes.
- **Consequences:** `.eslintrc.json` is replaced by `eslint.config.mjs`; CI lint command unchanged in name (`npm run lint -w frontend`).

## ADR-005 — Encrypted-at-rest journal/draft storage is the only production path (2026-08-15)

- **Status:** Accepted (from current-system-audit risk table; enforced by ECHO-021/025/032/093).
- **Decision:** Journal `title`/`content` and drafts are stored encrypted (AES-256-GCM via `EncryptionService`) in `content_ciphertext`/`encryption_iv`/`encryption_auth_tag`/`encryption_key_version` bytea columns; plaintext columns are never written. Raw wellness content MUST NOT be persisted in browser storage.
- **Rationale:** Data classification: journal, mood, chat are highly sensitive; encryption at rest is a backlog release gate.
- **Consequences:** List queries must not decrypt every row (ECHO-024); key rotation path required (ECHO-093); any legacy plaintext must be backfilled (ECHO-093).

## ADR-006 — Response envelope and error registry (2026-08-15)

- **Status:** Accepted (backlog §6.1; ECHO-081).
- **Decision:** Success `{success, data, meta:{requestId,...}}`; failure `{success:false, error:{code,message,fieldErrors?}, meta:{requestId}}`. Codes are stable machine strings; production responses never include stack traces, provider errors, or internal paths.
- **Rationale:** Backlog §6.1 mandates the envelope; the active `sendSuccess` and `errorMiddleware` already implement it.
- **Consequences:** Feature controllers must use `sendSuccess` and throw `AppError` subclasses; raw provider errors must be mapped.

## ADR-007 — Authentication: verified bearer tokens via Supabase Auth (2026-08-15)

- **Status:** Accepted (ECHO-011 hardening planned).
- **Decision:** `createAuthMiddleware(verifier)` validates `Bearer` tokens through `supabase.auth.getUser()` (server-side verification); the legacy decode-and-trust path (`shared/middleware/auth.ts`) is retired. Missing/invalid tokens → 401 via `AuthenticationError`.
- **Rationale:** Backlog §5.1 requires short-lived verified access tokens; fail-closed behavior in production is a P0 (ECHO-011).
- **Consequences:** Tests must fake the verifier; ECHO-011 adds audience/expiry/format tests and fail-closed behavior for every protected route.

## ADR-008 — Environment validation is centralized (2026-08-15)

- **Status:** Accepted.
- **Decision:** `backend/src/config/environment.ts` (Zod) is the single source of backend env validation; production rejects the mock analysis provider.
- **Rationale:** Prevents misconfiguration and mock leakage into production.
- **Consequences:** New backend features read env only via `loadEnvironment()`; no ad-hoc `process.env` access.

## ADR-009 — Frontend MVVM layering with enforced ports (2026-08-15)

- **Status:** Accepted (ECHO-007, ECHO-008 enforcement pending).
- **Decision:** Adopt the MVVM_Architecture.md feature layout with the corrected rules from backlog §3.3/§3.4:
  - Page/View -> ViewModel -> service port -> HTTP adapter -> shared authenticated API client.
  - Views MAY import presentation models and ViewModel interfaces; they MUST NOT import concrete services, transport clients, or database code.
  - ViewModels use `useReducer` + AbortController, track `idle/loading/success/empty/error/stale`, and call services only through ports/factories.
  - Request lifecycle (`requestStatus`) is separated from domain status values (the sample `FormState` double-`status` defect from MVVM_Architecture.md §3.4 is rejected).
  - Mock adapters are dev/test-only; factories select adapters from environment (ECHO-062 standardizes this).
- **Rationale:** The QA review (backlog §3.4) confirmed feature-first MVVM is appropriate; the enforceable dependency rule is "no concrete service/transport/database imports in Views".
- **Consequences:** ECHO-008 adds lint/import-enforcement; ECHO-061-062 move remaining orchestration (settings) into ViewModels.

## ADR-010 — AI service boundary: internal, authenticated, fail-safe (2026-08-15)

- **Status:** Accepted (ECHO-035-038, ECHO-106 follow).
- **Decision:** FastAPI (`ai-service/`) is an isolated internal service. The Express backend calls it only through `infrastructure/ai/ai.client.ts` using a server-to-server bearer token; the AI service verifies the token with constant-time comparison, disables API docs in production, and exposes no user-facing routes.
- **Rationale:** Backlog §1 and `docs/architecture/future-ai-integration-boundary.md`: AI must not be reachable from browsers; mock provider remains dev/test-only and is rejected in production (environment.ts).
- **Consequences:** AI eligibility (ECHO-038) is enforced server-side before any request; prompts are constructed by the backend from minimal data; raw content never enters logs (ECHO-087/040).

## ADR-011 — Stale historical documents are not evidence (2026-08-15)

- **Status:** Accepted (ECHO-007).
- **Decision:** The four historical "phase complete" documents and any code examples inside `Layered_architecture.md`/`MVVM_Architecture.md` that contradict executable code are treated as target-direction only. The canonical records are: `docs/backend/canonical-architecture.md`, `docs/implementation/DECISIONS.md`, `BACKLOG_PROGRESS.md`, `VERIFICATION_LOG.md`, and executable CI results.
- **Rationale:** Backlog §3.4 and §1 ("historical 'complete' claims are not evidence").
- **Consequences:** New ADRs reference executable files and CI evidence; stale claims are corrected by the owning stories (ECHO-007 marks this baseline; ECHO-010 links requirement-to-code traceability).
