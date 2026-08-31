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

- `user_storage_role` -> `USER_STORAGE_KEY` (private `verification-documents` and `avatars` buckets only; no `BYPASSRLS`)
- `recommendation_service_role` -> `RECOMMENDATION_SERVICE_DATABASE_KEY` (read-only `support_resources`)

- `user_service_role` → `USER_SERVICE_DATABASE_KEY`
- `journal_service_role` → `JOURNAL_SERVICE_DATABASE_KEY`
- `assessment_service_role` → `ASSESSMENT_SERVICE_DATABASE_KEY`
- `analysis_service_role` → `ANALYSIS_SERVICE_DATABASE_KEY`
- `wellness_service_role` → `WELLNESS_SERVICE_DATABASE_KEY`

Do not put any of these values in `NEXT_PUBLIC_*`. The general Supabase service-role key is used only by API Gateway to validate Supabase Auth sessions.

For a fresh local stack, `supabase status -o env` reports the local API URL,
anon/publishable key, service-role key, and JWT secret. Export the JWT secret
only in the current shell, then generate seven-day local role JWTs plus all
service HMAC tokens and a new local AES key:

```powershell
Copy-Item .env.example .env
supabase start
supabase status -o env
$env:SUPABASE_JWT_SECRET = "paste-local-JWT-secret"
npm run local:secrets
Remove-Item Env:SUPABASE_JWT_SECRET
```

```bash
cp .env.example .env
supabase start
supabase status -o env
SUPABASE_JWT_SECRET='paste-local-JWT-secret' npm run local:secrets
```

Copy the printed values into `.env`, along with:

- `SUPABASE_URL` from the local API URL (normally `http://127.0.0.1:54321`)
- `SUPABASE_PUBLISHABLE_KEY` from the local anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` from the local service-role key

The generator never writes secrets. Its role JWTs expire after seven days;
rerun it with the same local JWT secret and update only the seven role-key
variables when they expire. Do not rotate `JOURNAL_ENCRYPTION_KEY_BASE64` for
an existing database without a planned re-encryption migration.

If the corrective migration reports a non-empty experimental schema or compatibility table, stop and reconcile that data into the documented canonical table. The migration deliberately refuses destructive automatic guessing.

## Environment

Copy `.env.example` to an untracked `.env` and set all blank secrets/keys. Compose supplies internal URLs through Docker DNS. Individual service examples live beside each service.

For native (non-Docker) development, copy the relevant service's `.env.example` to an ignored `.env` in that service directory. Those examples use `localhost` dependency URLs and distinct ports. In Compose, do not copy those URLs: `docker-compose.yml` supplies service DNS names such as `http://journal-service:4202`.

Important public configuration:

- `NEXT_PUBLIC_API_BASE_URL=/api/v1`
- Supabase URL and publishable key only

Important internal configuration:

- the seven role-scoped database/storage keys above
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

Then verify the edge routes:

```bash
curl --fail http://localhost:3000/
curl --fail http://localhost:3000/api/v1/health
```

Only the edge publishes a host port. To inspect internal health without
publishing ports, use Compose:

```bash
docker compose exec frontend wget --spider -q http://127.0.0.1:3000/
docker compose exec api-gateway wget --spider -q http://127.0.0.1:4200/api/v1/health
docker compose exec analysis-service python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
docker compose exec ml-service python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health')"
```

ML readiness is expected to fail with 503 until validated artifacts and a
reviewed loader exist:

```bash
docker compose exec ml-service python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health/ready')"
```

That single expected 503 does not make the application startup fail.

Only NGINX publishes a host port (`http://localhost:3000`). Domain services are exposed only on the Compose network.

Individual Node services can be started with their package scripts, for example `npm run dev -w @echo/journal-service`. Analysis starts from `ai-service/`; ML starts from `ml/` using the commands in the architecture catalog.

For a clean end-to-end check, open the edge URL and exercise:

1. authentication: signup, login, session restoration, and logout;
2. onboarding and profile creation, then profile/privacy/notification/trusted-contact settings;
3. identity-verification draft, document upload, submission, and the administrator review flow with an explicitly provisioned local verification administrator;
4. journal draft save/reload/delete, followed by journal create/read/update/delete;
5. dashboard mood check-in and the optional PHQ-8 calculation; the direct PHQ-8 result is session-only and no assessment-history endpoint is currently implemented;
6. Buddy messaging and grounding-session completion;
7. dashboard and emotion insights sourced from the saved data.

Analysis additionally requires approved identity verification, active account-level journal-analysis consent, per-entry analysis consent, and an available validated ML runtime. Without validated ML artifacts, confirm the documented controlled unavailable response; do not treat fabricated or placeholder inference as success.

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
