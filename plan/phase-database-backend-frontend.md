# Non-AI integration plan

## Current state

The UI and frontend MVVM skeleton are operational with mock data. Express has security middleware and token verification but no feature routes. The initial migration covers only part of the ERD and contains plaintext private fields and several overly broad client policies.

## Execution order

1. Document audit, ERD deltas, risks, and this plan.
2. Create an additive Supabase migration for the ERD gaps, encryption-ready fields, RLS policy corrections, private functions, and indexes.
3. Add pgTAP coverage and a database-types package boundary. Do not claim database execution until Docker is available.
4. Replace backend future-AI requirements with a development-only mock analysis provider interface, encryption service, and secure journal workflow.
5. Implement only backend endpoints needed by existing journal/profile flows; preserve mock UI fallbacks for all other screens.
6. Connect the journal HTTP adapter through the existing API client and shared contracts.
7. Run type checks, tests, lint, builds, and available database commands; document blockers.

## Files to create

- One CLI-created corrective Supabase migration and focused pgTAP test files.
- `packages/database-types` boundary and shared journal/analysis contracts.
- Backend encryption, mock analysis, journal, profile/consent/notification-preference modules.
- Frontend route registry and journal HTTP adapter tests.
- Required database, architecture, API, security, testing, and implementation documentation.

## Files moved/deleted

None. The FastAPI scaffold is deferred rather than deleted. Existing UI and assets are out of scope.

## Risks and rollback

The database correction is additive and policy-focused. Rollback consists of applying a follow-up migration to restore an intentionally changed policy or column default; no initial migration will be rewritten. The new backend path is hidden behind existing service factories so mock adapters remain a local fallback while credentials/local Supabase are unavailable.

## Completion criteria

The repository compiles and tests pass. The migration and pgTAP suite are present and reproducible from a clean local stack. Any Docker-dependent work is explicitly marked unverified. Mock analysis is deterministic, development/test only, non-diagnostic, and replaceable by a later FastAPI adapter.
