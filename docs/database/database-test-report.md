# Database test report

## Prepared tests

`supabase/tests/database/rls-policy.test.sql` verifies ERD table presence, RLS enablement, protected service-only tables, secure policies, private functions/triggers, and key constraints/indexes.

## Execution status

Unverified locally. The following commands were attempted but could not connect because Docker Desktop's engine is not available on this machine:

```text
npx supabase db reset --local --workdir .
# Docker Desktop is a prerequisite; the Windows Docker pipe was not found.

npx supabase test db --local --workdir .
# failed to connect to local Postgres
```

When Docker is available, run `npx supabase start`, `npx supabase db reset`, and `npx supabase test db`. No remote Supabase project was linked, pushed, or changed.
