# ECHO — Mental Wellness Companion

ECHO is a full-stack mental-wellness application built as independently runnable microservices around a Next.js frontend, an application API gateway, Supabase Auth/PostgreSQL, and a separate Python ML runtime.

## Architecture

The browser talks only to NGINX and `/api/v1`. The gateway validates Supabase access tokens and routes requests to the owning service. Domain services use role-scoped server credentials and explicit HTTP APIs; they do not import one another or query one another's tables.

Services:

- API Gateway
- User Service
- Journal Service
- Assessment Service
- Analysis Service
- ML Inference Service
- Recommendation Service
- Wellness Service
- Insights Service
- Next.js frontend

See [the implemented architecture](docs/architecture/microservices.md), [deployment guide](docs/deployment.md), and [API description](docs/api.yaml).

## Local validation

```bash
npm ci
npm run architecture:check
npm run environment:check
npm run typecheck
npm run lint
npm run test
npm run build
```

Python services use Python 3.12 and `uv`:

```bash
cd ai-service && uv sync --all-groups && uv run ruff check . && uv run pytest
cd ../ml && uv sync --all-groups && uv run ruff check . && uv run pytest
```

Database checks require Supabase CLI and Docker:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db
```

For the complete stack, copy `.env.example` to `.env`, provision the documented custom-role database keys, mount validated model artifacts if available, and run `docker compose up --build`.

Real model inference remains unavailable until reviewed model artifacts, loader dependencies, and an evaluation manifest are supplied. The ML service reports this truthfully with readiness/inference `503` responses.

## License

MIT
