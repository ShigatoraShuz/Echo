# ECHO Architecture Verification Report

Generated: 2026-08-26 08:17:59
Git branch: feature/backend-security-hardening

## Target Architecture

Frontend
    |
    v
Express Backend
    |
    +--> Feature modules
    |
    +--> Repository / data-access boundary
    |
    +--> Supabase/PostgreSQL
    |
    +--> Internal AI Gateway
              |
              v
         FastAPI AI Service
              |
              v
        Model Runtime

## Verified

- Canonical Express app/server structure exists.
- Backend analysis provider abstraction exists.
- AI-service provider is wired into the provider factory.
- Docker service topology contains frontend, backend and ai-service.
- Backend points to ai-service through internal Docker networking.
- AI service uses bearer-token authentication.
- AI authentication uses constant-time token comparison.
- Frontend has no direct AI-service endpoint reference.
- Service-role key is not exposed through frontend source.
- Journal encryption path exists in backend.
- Centralized backend error middleware exists.

## Intentionally Not Claimed

- Docker runtime verification: unavailable if Docker is not installed.
- Supabase migration/RLS execution: requires local Supabase/Docker.
- Production model inference: requires model runtime/artifacts.
- End-to-end AI inference: cannot be marked complete while the FastAPI analysis endpoint remains placeholder.
- Clinical validation: requires the validated model/evaluation process.

## Architecture Decision

ECHO uses a modular-monolith Express backend rather than splitting every feature
into separate network microservices.

The AI inference runtime remains a separate FastAPI service because it has
different runtime/deployment requirements.

This keeps feature management simple while preserving independent AI deployment.

## Dependency Rule

View
 -> ViewModel
 -> Service Port
 -> HTTP Adapter
 -> Shared API Client
 -> Express Route
 -> Controller
 -> Domain Service
 -> Repository
 -> PostgreSQL/RLS

Domain services may call the internal AI gateway.

Frontend must never call the AI service directly.

## Next Release Gates

1. Fix remaining backend typecheck issues if present.
2. Complete repository boundary for remaining direct Supabase services.
3. Finish journal frontend adapter/ViewModel migration.
4. Remove sensitive journal localStorage usage.
5. Add journal pagination/filter/search contract.
6. Complete analysis repository/service workflow.
7. Wire validated model runtime into FastAPI.
8. Run Supabase migration/RLS tests with Docker.
9. Run AI-service CI with uv.
10. Run E2E tests.
