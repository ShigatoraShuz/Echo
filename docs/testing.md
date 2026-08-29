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

The database suite includes `ownership-isolation.test.sql`, `service-role-ownership.test.sql`, and `rls-policy.test.sql`. Never point these reset/test commands at production.

Container validation:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

ML liveness should return `200` without model artifacts. ML readiness and inference should return controlled `503` responses until a reviewed loader, artifacts, and evaluation manifest are supplied. A `503` in that state is the expected truthful result, not a test bypass.
