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

See [the implemented architecture](docs/architecture/microservices.md), [responsibility migration map](docs/architecture/responsibility-migration.md), [deployment guide](docs/deployment.md), and [API description](docs/api.yaml).

## Clean setup

1. Clone the configured GitHub repository and switch to the stabilization branch:

   ```bash
   git clone https://github.com/ShigatoraShuz/Echo.git
   cd Echo
   git switch refactor/backend-architecture-stabilization
   ```
2. Install Node.js 24+, npm 11+, Python 3.12, `uv`, Docker with Compose, and Supabase CLI.
3. Run `npm ci`, then install the locked Python environments with `cd ai-service && uv sync --all-groups --locked` and `cd ../ml && uv sync --all-groups --locked` before returning to the repository root.
4. Run `supabase start`, `supabase db reset`, `supabase db lint`, and `supabase test db`.
5. Copy `.env.example` to the ignored `.env`. Use `supabase status -o env` for the local URL, publishable/anon key, service-role key, and JWT secret. Temporarily export `SUPABASE_JWT_SECRET`, then run `npm run local:secrets` to generate distinct service tokens, custom-role JWTs, and a new local encryption key. Copy the output into `.env`; never commit it.
6. Run `docker compose config`, `docker compose up --build -d`, and `docker compose ps`.
7. Open `http://localhost:3000`; `http://localhost:3000/api/v1/health` must return 200.

The exact PowerShell/Bash commands, native-service startup options, expected health results, and role mapping are in [the deployment guide](docs/deployment.md). Preserve the encryption key when reusing any existing ciphertext.

The frontend uses Supabase directly only for authentication sessions. Secure registration/account gates, profile/onboarding, journals, mood entries, Buddy, grounding, settings, notifications, insights, and analysis requests all use `/api/v1` through the Gateway.

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
