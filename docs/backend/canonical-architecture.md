# ECHO backend canonical architecture

Status: maintained. Updated 2026-08-29.

The removed `backend/` modular monolith is historical. The active request path is:

`browser -> edge (NGINX) -> API Gateway -> owning service -> owned public tables/service APIs`

## Composition roots

| Responsibility | Active entry point |
|---|---|
| Authentication, routing, correlation | `services/api-gateway/src/server.ts` |
| Onboarding, settings, verification | `services/user-service/src/server.ts` |
| Encrypted journal CRUD and drafts | `services/journal-service/src/server.ts` |
| Mood entries and PHQ-8 scoring | `services/assessment-service/src/server.ts` |
| Analysis orchestration | `ai-service/app/main.py` |
| Validated model runtime boundary | `ml/app/main.py` |
| Recommendations | `services/recommendation-service/src/server.ts` |
| Buddy, grounding, support resources | `services/wellness-service/src/server.ts` |
| Derived dashboard/emotion insights | `services/insights-service/src/server.ts` |

All public APIs use `/api/v1`, bearer authentication is verified by the Gateway, and signed user context plus a UUID `X-Request-Id` is propagated to internal services. Public support-resource reads are the only unauthenticated domain route.

Database ownership is defined by `supabase/migrations/20260828000000_canonical_public_service_ownership.sql` and summarized in `docs/architecture/microservices.md`. Services must use `createOwnedDatabase`; Analysis Service's reviewed raw PostgREST access is checked by `scripts/check-architecture.mjs`.

The ML container is live when `/health` succeeds and inference-ready only when `/health/ready` succeeds. Until a validated loader, artifacts, and evaluation manifest exist, inference intentionally returns a controlled 503.

For the complete route catalog, environment contracts, startup sequence, and health checks, see `docs/api.yaml`, `docs/architecture/microservices.md`, and `docs/deployment.md`.
