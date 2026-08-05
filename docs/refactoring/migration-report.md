# Migration report — foundation increment

Date: 2026-07-24

## Created

- Root npm workspace metadata, environment example, Docker Compose definition, and TypeScript base configuration.
- `backend/` Express TypeScript skeleton with health endpoints, standardized response/error envelopes, request IDs, security headers, CORS, rate limiting, token-verifier abstraction, redaction, and an internal AI client.
- `ai-service/` FastAPI skeleton with health/readiness endpoints, internal-token protection, deterministic score-mapping helper, explicit urgent-language helper, and an intentionally unavailable model runtime.
- `packages/contracts/` with TypeScript/Zod DTOs and JSON schemas for journals, analyses, profiles, consents, notifications, and safe API errors.
- `supabase/` CLI initialization, a CLI-generated initial schema migration, RLS policies, indexes, and pgTAP policy checks.
- Frontend Supabase SSR utilities, a cookie-based OAuth callback route, a public environment template, and a Supabase token provider.
- Architecture, database, audit, migration, risk, and move-map documentation.

## Preserved

- All existing Next.js route groups and page URLs.
- Current landing-page and authentication UI work, including uncommitted changes.
- Current mock adapters; they remain the default until a configured backend and Supabase project are available.
- Existing frontend asset locations; no image was moved or renamed during this increment.

## Verification

| Check | Result |
| --- | --- |
| Root TypeScript check | Passed: frontend, backend, contracts |
| Root tests | Passed: 19 frontend files / 139 tests; 1 backend file / 2 tests |
| Frontend production build | Passed: 38 routes, including `/callback` |
| Backend production build | Passed |
| AI tests | Passed: 4 tests |
| AI lint | Passed: Ruff |
| Local Supabase DB migration test | Not run: Docker is unavailable on this machine |

## Required manual configuration

1. Create/link a Supabase project and place only public URL/key values in `frontend/.env`.
2. Place Supabase service-role and AI service credentials only in `backend/.env`.
3. Run `npx supabase@latest start`, `db reset --local`, and the pgTAP tests before applying the migration to a hosted project.
4. Configure a real OAuth callback URL ending in `/callback` and Google provider credentials in Supabase.
5. Supply validated model artefacts and a reviewed deterministic model loader before enabling `/v1/analyze`.

## Known limitations

- The Express feature endpoints beyond health are intentionally not enabled until repositories and real Supabase types are wired.
- The AI service is intentionally not ready and returns no score without a validated model runtime.
- The security audit reports high-severity advisories in the current Next.js/PostCSS/Sharp dependency chain. No automatic upgrade was applied because the audit fix changes framework/runtime packages and needs a dedicated regression pass.
