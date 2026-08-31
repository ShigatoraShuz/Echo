# Current system audit

> Historical pre-microservices snapshot. It is not current setup or architecture guidance; use [`docs/architecture/microservices.md`](../architecture/microservices.md) and [`docs/deployment.md`](../deployment.md).

Date: 2026-07-24  
Scope: non-AI integration phase. This audit is based on repository files and migration history. The local Supabase database could not be inspected because Docker is unavailable on this machine.

## Repository

| Area | Current state |
|---|---|
| Package manager | npm workspaces (`package-lock.json`) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind, Vitest/Testing Library |
| Backend | Express 5, TypeScript, Vitest/Supertest, Zod, Helmet, CORS and rate limiting |
| Supabase clients | `@supabase/supabase-js` and `@supabase/ssr` in the frontend; server-only admin client in the backend |
| Local database | Supabase CLI 2.109.1 is initialized; Docker is unavailable, so migrations/tests are unverified locally |
| CI | Frontend, backend, AI-service, and security workflows exist. The AI-service workflow is legacy/deferred for this non-AI phase. |

Root workspace scripts validate the frontend, backend, and shared contracts. Existing environment templates are at the root, `frontend/.env.example`, `backend/.env.example`, and `ai-service/.env.example`.

## Frontend inventory

The App Router contains public marketing pages, authentication pages, onboarding pages, protected dashboard/journal/Buddy/settings pages, support/crisis pages, and a design-system page. The route handler at `app/(auth)/callback/route.ts` is the existing Supabase OAuth callback.

Feature modules already use a mostly MVVM-shaped separation:

- `authentication`: views, hooks, schemas, mock and HTTP adapters.
- `journal`: list/editor/detail views, view-model hooks, models, validation, mock adapter and a placeholder HTTP adapter.
- `dashboard`: a view with mock/HTTP service adapters.
- `landing`, `onboarding`, `settings`, and `public-content`: primarily presentation or static-form flows.

Direct Supabase usage is limited to authentication/session helpers under `frontend/src/lib/supabase` and the OAuth callback. Application-data access is not made directly from a page. The shared API client uses `fetch`; feature adapters should use it rather than call `fetch` from views.

Known gaps before this phase:

- Journal and dashboard factories default to mock adapters; the journal HTTP adapter has not implemented the backend contract.
- Settings/onboarding pages are presentation-first and do not yet persist their fields.
- There is no central `src/routes` registry or route document.
- Protected UI layout is visual; backend authorization remains the security boundary.

## Backend inventory

`backend/src/app.ts` configures Helmet, CORS, request IDs, structured request logging, JSON limits, rate limiting, versioned routes, safe errors, and a health endpoint. Environment validation currently requires the future AI-service values, which conflicts with this non-AI phase.

There is an admin Supabase client and bearer-token verifier. No journal/profile/consent repositories or feature routes exist yet. Only health tests currently exist. The backend must add user-scoped clients, encryption, a mock analysis provider, and feature modules incrementally.

## Supabase inventory

There is one migration: `20260724012900_initial_echo_schema.sql`. It creates `profiles`, `user_consents`, `journals`, `model_versions`, `journal_analyses`, `mood_entries`, `trusted_contacts`, `notification_preferences`, `notifications`, and `audit_events`.

It enables RLS, but several policies are more permissive than the ERD/brief allows: profiles can be inserted/deleted by users, analyses can be fully CRUDed by users, notification preferences can be deleted, and notifications can be deleted or have arbitrary fields changed. The migration uses plaintext `journals.content` and `mood_entries.note`, has no `private` schema/profile trigger, and lacks the ERD's remaining tables.

The current migration history is treated as immutable. Corrections will be additive migrations only.

## Risk assessment

| Risk | Impact | Handling |
|---|---|---|
| Old schema stores plaintext private text | High | Add encrypted columns and backend encryption; retain old columns only for compatibility and do not write new plaintext. |
| Existing RLS policies grant forbidden writes | High | Replace policies in a corrective migration; preserve ownership predicates. |
| Docker unavailable | High verification blocker | Keep reproducible migrations/pgTAP tests; record unverified local commands. |
| No validated model | High safety risk | Use deterministic development-only mock provider; reject it in production. |
| Existing UI uses mock adapters | Medium | Keep UI working while implementing the HTTP adapter behind the existing service interface. |
| Existing uncommitted UI changes | Medium | Avoid unrelated edits, deletes, or moves. |

## Source-of-truth decision

The migration history is authoritative for existing objects. The supplied ERD is the target design, so differences are documented in `docs/database/erd-schema-comparison.md` and reconciled through a new corrective migration rather than edits to the initial migration.
