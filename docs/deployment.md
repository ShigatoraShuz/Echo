# Deployment guide

## Prerequisites

- Node.js 24 and npm 11 for local Node development
- Python 3.12 and `uv` for Analysis/ML development
- Docker Engine with Compose for full-stack orchestration
- Supabase CLI plus a Supabase/PostgreSQL project
- A 32-byte base64 journal encryption key
- A distinct random token of at least 32 characters for each service target

## Database provisioning

Apply migrations before starting application services:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db
```

The corrective migration creates/uses custom non-login roles. For each role, create a server-only Supabase JWT/API key signed by the project's JWT signing key and containing that exact `role` claim:

- `user_service_role` → `USER_SERVICE_DATABASE_KEY`
- `journal_service_role` → `JOURNAL_SERVICE_DATABASE_KEY`
- `assessment_service_role` → `ASSESSMENT_SERVICE_DATABASE_KEY`
- `analysis_service_role` → `ANALYSIS_SERVICE_DATABASE_KEY`
- `wellness_service_role` → `WELLNESS_SERVICE_DATABASE_KEY`

Do not put any of these values in `NEXT_PUBLIC_*`. The general Supabase service-role key is used only by API Gateway to validate Supabase Auth sessions.

If the corrective migration reports a non-empty experimental schema or compatibility table, stop and reconcile that data into the documented canonical table. The migration deliberately refuses destructive automatic guessing.

## Environment

Copy `.env.example` to an untracked `.env` and set all blank secrets/keys. Compose supplies internal URLs through Docker DNS. Individual service examples live beside each service.

Important public configuration:

- `NEXT_PUBLIC_API_BASE_URL=/api/v1`
- Supabase URL and publishable key only

Important internal configuration:

- the five service database keys above
- `SUPABASE_SERVICE_ROLE_KEY` for gateway auth validation
- the eight distinct `*_SERVICE_TOKEN` values from the root example; never reuse a value
- `JOURNAL_ENCRYPTION_KEY_BASE64` and version
- optional `MODEL_ARTIFACTS_PATH`

## Startup

All services:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Only NGINX publishes a host port (`http://localhost:3000`). Domain services are exposed only on the Compose network.

Individual Node services can be started with their package scripts, for example `npm run dev -w @echo/journal-service`. Analysis starts from `ai-service/`; ML starts from `ml/` using the commands in the architecture catalog.

## Health and failure behavior

- Public edge/gateway: `GET http://localhost:3000/api/v1/health`
- Every Node domain service: `GET /health`
- Analysis: `GET /health`
- ML liveness: `GET /health`
- ML readiness: `GET /health/ready`

Gateway upstream connections use configured timeouts and map unavailable services to `503` and timeouts to `504`. Analysis marks an already-created analysis request failed when an ML/dependency error occurs. Other services remain healthy when ML is not ready.

ML liveness is expected to pass without model artifacts; readiness and inference are expected to return `503`. Do not route clinical or production analysis traffic until the documented external model blocker is resolved and validated.

## Security notes

- Rotate target-service tokens and custom service JWTs independently through the deployment secret manager.
- API Gateway holds each public destination's token. Analysis holds only User, Journal, ML, and Recommendation target tokens; Wellness holds User; Insights holds User and Journal.
- Keep the existing `JOURNAL_ENCRYPTION_KEY_BASE64` bytes and `JOURNAL_ENCRYPTION_KEY_VERSION=1` when moving encrypted data. Rotation requires an explicit re-encryption procedure.
- Never publish service ports or put role-scoped keys in browser bundles.
- Preserve the same request ID across proxy and service hops.
- Run `npm run architecture:check` in CI to prevent dependency and ownership regressions.
