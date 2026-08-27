# Database test report

## Prepared tests

The database suite includes:

- `rls-policy.test.sql` for canonical table/constraint/RLS structure;
- `service-role-ownership.test.sql` for service grant ownership and duplicate-schema/table removal;
- `ownership-isolation.test.sql` for functional cross-role access denial.

## Execution status

Unverified in the 2026-08-28 migration environment because Docker, Supabase CLI, and a local PostgreSQL engine are unavailable. Static migration and pgTAP review completed, but that does not replace execution.

```text
supabase start
supabase db reset
supabase db lint
supabase test db
```

No remote Supabase project was linked, pushed, or changed. A non-empty abandoned schema/table intentionally blocks the corrective migration until its rows are reconciled, preventing silent loss.
