# Full-stack security review

> HISTORICAL / SUPERSEDED / PRE-MICROSERVICES. Retained as thesis provenance, not current implementation or deployment guidance. See [microservices architecture](../architecture/microservices.md) and [testing](../testing.md) for the active system.

## Fixed in this phase

| Severity | Finding | Resolution |
|---|---|---|
| High | Initial journal and mood fields permitted plaintext application writes. | Additive encrypted-field schema and AES-256-GCM backend workflow; new writes set legacy plaintext fields to `NULL`. |
| High | Authenticated users could CRUD analysis results. | Corrective migration removes client write/delete policies and grants. |
| High | Notification updates/deletes were unrestricted for owners. | Table privileges now allow only `read_at` updates; delete is revoked. |
| High | Future FastAPI credentials were required during the non-AI phase. | Environment now only allows the isolated mock provider and rejects it in production. |
| Medium | Profile lifecycle could be client-created/deleted. | Private auth trigger provisions profile/preferences; direct insert/delete is revoked. |

## Remaining / verification blockers

- RLS and migration tests require a Docker-backed local Supabase stack and are not yet executed here.
- Existing legacy plaintext rows require a separately approved backfill-and-removal migration before any production deployment.
- `ai-service/` is retained as deferred work but is not started, called, or required in this phase.

## Controls retained

The frontend has no service-role variable. Backend token verification derives the user from the bearer token; journal routes do not accept a request-body user ID. Structured logs avoid request bodies and encryption material. Helmet, CORS, JSON limits, request IDs, and rate limiting remain enabled.
