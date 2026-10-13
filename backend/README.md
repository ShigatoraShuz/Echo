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

## Development

```bash
npm run dev
npm run test
npm run build
```
