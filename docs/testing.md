# Testing guide

Run the repository checks from the root with Node.js 24 and npm 11:

```bash
npm ci
npm run architecture:check
npm run environment:check
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test` covers the frontend, API Gateway, and every Node domain service. To run a narrower suite, use its workspace name, for example:

```bash
npm run test -w frontend
npm run test -w @echo/api-gateway
npm run test -w @echo/journal-service
```

The active microservice regression coverage replaces the removed monolith suites. It includes fail-closed user and internal authentication, mass-assignment filtering, UUID validation, onboarding against canonical `profiles.id`, settings and verification boundaries, journal CRUD/drafts/encryption, gateway routing and request-ID propagation, canonical success/error envelopes, unavailable-dependency mapping, and executable architecture/database-ownership rules. Historical `backend/tests` references under archived reports are not runnable current tests.

Run both Python projects independently with Python 3.12 and `uv`:

```bash
cd ai-service
uv sync --all-groups --locked
uv run ruff check .
uv run pytest

cd ../ml
uv sync --all-groups --locked
uv run ruff check .
uv run pytest
```

Database ownership, RLS, and migration checks require a local Supabase stack and Docker:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db
```

The database suite includes `ownership-isolation.test.sql`, `service-role-ownership.test.sql`, and `rls-policy.test.sql`. The service-role suite executes effective-access checks for the non-BYPASS `user_storage_role`: allowed private verification/avatar bucket operations succeed, unrelated bucket access is denied or filtered by RLS, and browser/app-table roles cannot read verification objects. It also proves Recommendation has read-only `support_resources` access. Never point these reset/test commands at production.

Container validation:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

ML liveness should return `200` without model artifacts. ML readiness and inference should return controlled `503` responses until a reviewed loader, artifacts, and evaluation manifest are supplied. A `503` in that state is the expected truthful result, not a test bypass.
