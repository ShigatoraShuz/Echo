# Supabase database configuration

Supabase Auth owns identities in `auth.*`. ECHO application data uses one canonical `public` schema with table grants partitioned among server-only service roles. Browser `anon` and `authenticated` roles do not query protected application tables; authenticated application data goes through API Gateway and the owning service.

The authoritative ownership migration is `migrations/20260828000000_canonical_public_service_ownership.sql`. It safely refuses to drop any non-empty experimental schema or compatibility table.

## Local validation

Install the Supabase CLI and Docker, then run only against the local development stack:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db
```

`db reset` applies all migrations in timestamp order and loads `seed.sql`. The database tests verify table presence, RLS, browser denial, and role-level ownership isolation.

## Server roles

- `user_service_role`: profiles, consent, preferences, contacts, account requests, notifications, verification, audit
- `journal_service_role`: journals and drafts
- `assessment_service_role`: mood entries
- `analysis_service_role`: analyses, analysis windows/feedback, model versions, safety events/resources
- `wellness_service_role`: Buddy conversations/messages and grounding sessions; read-only support resources
- `recommendation_service_role`: read-only support resources
- `insights_service_role`: no base-table grants; reads through User and Journal APIs

Provision a distinct server-side JWT/API key with the matching role claim for each data-owning service. Never expose these keys through `NEXT_PUBLIC_*`, and never substitute the general Supabase service-role key for a domain service key.

For local development, get the JWT secret from `supabase status -o env`, export
it temporarily as `SUPABASE_JWT_SECRET`, and run `npm run local:secrets` from
the repository root. Copy the five generated `*_SERVICE_DATABASE_KEY` values
to the ignored root `.env`. The generator does not write secrets and the local
role JWTs expire after seven days.

See [database architecture](../docs/architecture/database-architecture.md) and [deployment](../docs/deployment.md) for the complete ownership and provisioning contract.
