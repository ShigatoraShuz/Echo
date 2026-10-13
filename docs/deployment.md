# Render deployment

ECHO's Next.js frontend and Express API are separate **Node web services**. Create both from the monorepo root. This guide prepares staging and production configuration; it does not deploy anything.

## API web service

- Root directory: repository root
- Runtime: Node 24 (`.nvmrc`)
- Build command: `npm ci && npm run build -w @echo/contracts && npm run build -w @echo/backend`
- Start command: `npm run start -w @echo/backend`
- Health check path: `/api/v1/health`

Set the required values from `backend/.env.example` in Render's environment settings. In production use `NODE_ENV=production`, `FRONTEND_URL=https://<frontend-host>`, and the Supabase URL, publishable key, server-only service-role key, encryption keys, and idempotency keys. Set `SIGNUP_DRAFT_SECRET` to a 32+ character secret. Do not copy `backend/.env` into the service. Render supplies `PORT`; the API listens on that port on all interfaces.

## Frontend web service

- Root directory: repository root
- Runtime: Node 24 (`.nvmrc`)
- Build command: `npm ci && npm run build -w @echo/contracts && npm run build -w frontend`
- Start command: `npm run start -w frontend`

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_BASE_URL=https://<api-host>/api/v1`, and `NEXT_PUBLIC_DATA_ADAPTER=http` **before building**. Add the feature flags and Google client ID from `frontend/.env.example` as needed. These `NEXT_PUBLIC_*` values are embedded in the browser build; after changing them, rebuild and redeploy the frontend. Never set the Supabase service-role key or encryption keys on the frontend.

The frontend start script binds to `0.0.0.0` and uses Render's `PORT`. A full Next.js app with server routes and dynamic protected pages requires a web service, not a static site.

## External configuration and staging check

Add the frontend origin and callback URL to Supabase Auth redirect settings. Register that exact frontend origin in Google OAuth if Google sign-in is enabled. Apply reviewed Supabase migrations before traffic reaches the new services. Set backend `FRONTEND_URL` to the same frontend origin for CORS.

On a staging deployment, check `/api/v1/health`, sign-in, journal pagination and search, journal-to-settings/Buddy/grounding navigation, and sign-out/sign-in between different accounts. Measure cold starts separately from warm navigation; a sleeping free Render service can dominate latency. See [Render web services](https://render.com/docs/web-services) and [Render's Next.js guide](https://render.com/docs/deploy-nextjs-app).
