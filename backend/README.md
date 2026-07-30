# Echo Backend API

## Architecture

The backend follows a layered architecture:
- **Routes**: Define HTTP endpoints per feature
- **Middleware**: Authentication, error handling, request logging
- **Shared**: Validation schemas (Zod), error classes, types

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/v1/journal | List journal entries |
| POST   | /api/v1/journal | Create journal entry |
| GET    | /api/v1/buddy/conversations | List conversations |
| POST   | /api/v1/grounding/sessions | Record session |
| GET    | /api/v1/settings/profile | Get profile |
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
