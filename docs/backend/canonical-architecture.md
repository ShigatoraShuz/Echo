# Echo Backend — Canonical Composition and API Reference

Status: maintained. Updated 2026-08-15 (ECHO-001/002/003). The executable composition root is
`backend/src/server.ts` -> `backend/src/app.ts` -> `backend/src/routes/v1.routes.ts`.

## Layering

`route -> validation/middleware -> controller -> domain service -> repository interface -> Supabase repository/infrastructure`

- Routes declare transport behavior and wire middleware; they do not contain business rules.
- Controllers validate inputs (Zod) and delegate to services; they must not run domain rules or call Supabase directly.
- Services enforce ownership, authorization, consent, eligibility, transactions, and state transitions.
- Repositories (ECHO-086) must require an authenticated user/tenant scope.
- Direct Supabase access is confined to `src/infrastructure/supabase/`; it must not leak into controllers or views.

## Canonical entry points

| Concern | Canonical file | Notes |
|---|---|---|
| Server entry | `backend/src/server.ts` | Loads env, builds services, starts HTTP; graceful shutdown. |
| App factory | `backend/src/app.ts` | Helmet, strict CORS, no-store, JSON limit, request ID, structured logging, global rate limit, v1 router, 404, error envelope. |
| v1 router | `backend/src/routes/v1.routes.ts` | Mounts feature routers; feature options are injected at composition root. |
| Errors | `backend/src/shared/errors/app-error.ts` | `AppError` + typed subclasses (Authentication, Authorization, VerificationRequired, Validation, NotFound, Conflict, ExternalService). |
| Auth middleware | `backend/src/shared/middleware/auth.middleware.ts` | `createAuthMiddleware(verifier)`; fail-closed bearer verification. |
| Access token verifier | `backend/src/infrastructure/supabase/supabase-admin.client.ts` | `createSupabaseAccessTokenVerifier` — validates via Supabase Auth `getUser`. |
| Response helpers | `backend/src/shared/utils/response.ts` | `sendSuccess` standard envelope. |
| Error middleware | `backend/src/shared/middleware/error.middleware.ts` | Standard failure envelope; redacts details. |
| Redaction | `backend/src/shared/utils/redaction.ts` | `redact()` for secrets and wellness content in logs. |
| Environment | `backend/src/config/environment.ts` | Zod-validated env; mock analysis rejected in production. |
| Encryption | `backend/src/infrastructure/encryption/encryption.service.ts` | AES-256-GCM, key versioning. |
| AI provider | `backend/src/infrastructure/analysis/` | `analysis-provider.types.ts`, `analysis-provider.factory.ts`, `mock-analysis.provider.ts` (dev/test only). |
| Supabase admin | `backend/src/infrastructure/supabase/supabase-admin.client.ts` | Server-only service-role client. |

## Feature modules (singular/plural convention)

| Feature | Canonical module path | Status |
|---|---|---|
| Health | `backend/src/features/health/` | Active |
| Journals (plural) | `backend/src/features/journals/` | Active |
| Settings | `backend/src/features/settings/` | Active |
| Experience (dashboard, buddy, insights, grounding, support) | `backend/src/features/experience/` | Active |
| Verification | `backend/src/features/verification/` | Active |

Legacy duplicates (`features/journal`, `features/buddy`, `features/insights`, `features/grounding`,
`features/onboarding`, legacy settings sub-routes) were quarantined to `backend/src-legacy/` on 2026-08-15.
See `backend/src-legacy/README.md`. Nothing under `src/` may import `src-legacy/`.

## v1 API surface

Base path: `/api/v1`. All responses use the standard envelope (`success`, `data`/`error`, `meta.requestId`).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /health | — | Health probe |
| GET | /health/ready | — | Readiness probe |
| GET | /support-resources | — | Human-reviewed public resources |
| GET | /dashboard | Bearer | Aggregated dashboard data |
| GET | /buddy/session | Bearer + verified | Buddy eligibility/session state |
| POST | /buddy/messages | Bearer + verified | Send Buddy message |
| GET | /buddy/history | Bearer + verified | Buddy conversation history |
| GET | /insights/emotions | Bearer | Emotion insights |
| POST | /grounding/sessions | Bearer | Complete grounding session |
| GET | /journals | Bearer | List journal entries |
| POST | /journals | Bearer | Create entry |
| GET | /journals/draft | Bearer | Get draft |
| PUT | /journals/draft | Bearer | Save draft (encrypted) |
| DELETE | /journals/draft | Bearer | Delete draft |
| GET | /journals/:journalId | Bearer | Get entry |
| PATCH | /journals/:journalId | Bearer | Update entry |
| DELETE | /journals/:journalId | Bearer | Soft-delete entry |
| POST | /journals/:journalId/analyze | Bearer + verified | Request analysis (consent-gated) |
| GET | /journals/:journalId/analyses | Bearer + verified | Latest analysis |
| GET | /settings | Bearer | Settings bundle |
| PATCH | /settings/profile | Bearer | Update profile |
| PATCH | /settings/privacy | Bearer | Update privacy/consent toggles |
| PATCH | /settings/notifications | Bearer | Update notification preferences |
| POST | /settings/trusted-contacts | Bearer | Add trusted contact |
| PATCH | /settings/trusted-contacts/:contactId | Bearer | Update contact |
| DELETE | /settings/trusted-contacts/:contactId | Bearer | Remove contact |
| POST | /settings/data-exports | Bearer | Request data export |
| POST | /settings/account-deletion | Bearer | Request account deletion |
| PATCH | /settings/account-deletion/:requestId/cancel | Bearer | Cancel deletion request |
| GET | /verification | Bearer | Verification status |
| PUT | /verification/application | Bearer | Save adult application |
| PUT | /verification/application/guardian | Bearer | Save guardian application |
| POST | /verification/submit | Bearer | Submit application |
| PUT | /verification/documents/:documentType | Bearer | Upload verification document |
| GET | /admin/verifications | Bearer | Admin list (reviewer role) |
| GET | /admin/verifications/:verificationId | Bearer | Admin detail |
| POST | /admin/verifications/:verificationId/claim | Bearer | Claim review |
| POST | /admin/verifications/:verificationId/decision | Bearer | Decide review |

Notes:

- `/api/v1` is the only versioned router; no duplicate runtime routes remain.
- Legacy `/api/v1/journal`, `/api/v1/buddy/*`, `/api/v1/insights/*`, `/api/v1/grounding/*`, `/api/v1/onboarding/*`,
  and legacy `/api/v1/settings/{profile,notifications,data}` paths are retired with the legacy stack.
- Every protected route is covered by `createAuthMiddleware`; AI/Buddy routes additionally use
  `createVerifiedAiAccessMiddleware` (ECHO-020/038 surface).

## Import conventions

- Backend is ESM (`"type": "module"`); relative imports use explicit `.js` specifiers.
- Feature modules import only inward: routes -> controller -> service -> infrastructure.
- Services receive the Supabase client via constructor injection; they may call it directly until
  repository interfaces land (ECHO-086). Controllers and routes must not.