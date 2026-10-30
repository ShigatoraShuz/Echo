# Echo Backend API

## Architecture

The backend is one Express modular monolith. Feature routers call controllers or services; services currently access Supabase through injected clients. Repository interfaces are not yet a universal layer. See [`canonical-architecture.md`](../docs/backend/canonical-architecture.md) for the intended boundary.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/v1/journals | List journal entries |
| POST   | /api/v1/journals | Create journal entry |
| GET    | /api/v1/buddy/history | Page through conversations |
| POST   | /api/v1/grounding/sessions | Record session |
| GET    | /api/v1/settings | Get settings |
| PATCH  | /api/v1/settings/profile | Update profile |
| GET    | /health | Health check |

## Database

Supabase PostgreSQL with Row-Level Security.
Migrations in `supabase/migrations/`.

## Buddy demo replies

Buddy currently uses fixed, clearly labeled example replies in [`buddy-demo-replies.ts`](src/features/experience/buddy-demo-replies.ts); no CBT response model or FastAPI inference is involved. The examples use simple reflection questions inspired by the [NHS thought-record exercise](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/). They are for testing the conversation flow, not personalized therapy.

To test in the app, sign in with an account that has approved verification and a valid Trusted Support Contact, open Buddy, choose one of the four prompt ideas, and send it. Each idea gets a distinct `Demo reply (not AI-generated)` message. Ordinary messages get a fixed theme response or a generic example. Existing urgent-language handling still takes precedence. History saving and deletion continue to use the existing privacy setting. `AI_ANALYSIS_MODE` controls a separate journal-analysis feature and is not required for these replies.

## Development

```bash
npm run dev
npm run test
npm run build
```
