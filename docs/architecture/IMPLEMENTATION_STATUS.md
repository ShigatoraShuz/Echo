# ECHO Implementation Status

## Audit Phase

- Phase: Gate 1 documentation audit
- Status: in progress, documentation only
- Date range: 2026-08-24

## Completed Evidence

- Read repository baseline and existing architecture documentation.
- Confirmed backend entrypoints and route composition.
- Confirmed installed Supabase client versions in `backend/package.json` and `frontend/package.json`.
- Reviewed current backend services for schema access patterns.
- Reviewed the live integration test to document its write behavior and cleanup behavior.
- Reviewed local Supabase config to separate local exposure from live exposure.
- Reviewed the `ai_analysis` migration and target schema objects.
- Confirmed that the recent compatibility commit `1a8478e` rewired several service calls from schema-qualified names back to unqualified names.

## Query Counts By Classification

Observed during repository audit of application query call sites:

| Classification | Count |
|---|---:|
| Proper explicit schema selection | 0 |
| Default/public access | 53 |
| Incorrect dotted table syntax | 1 |
| Cross-module access | 4 |
| Shared infrastructure | 3 |
| Unresolved | 2 |

Notes:

- `database.from("user_service.user_consents")` is counted under incorrect dotted table syntax, not proper schema selection.
- The counts are audit findings from repository inspection, not runtime telemetry.

## Confirmed Decisions

- The three deliverables for Gate 1 are documentation-only files under `docs/architecture/`.
- Local Supabase exposure cannot be assumed to match staging or production.
- `ai_analysis` is part of the target audit scope and must be treated as a first-class schema.
- Production data, migrations, configuration, tests, and Git history must remain unchanged in this phase.
- The current compatibility commit should stay in place until each domain cutover is proven.

## Unresolved Questions

- Whether the live Supabase project exposes `user_service`, `journal_service`, `buddy_service`, `verification_service`, `notification_service`, `grounding_service`, `insights_service`, and `ai_analysis`.
- Whether the deployed backend is pointing at the same Supabase project as Studio and the local CLI configuration.
- Whether any current data still lives only in legacy `public.*` tables.
- Whether `journal_service.journal_analyses` is a permanent journal-owned read model or should be replaced by `ai_analysis.analysis_results`.
- Whether `experience` should be split into multiple internal backend modules before data cutover begins.

## Blockers

- Live schema exposure is not proven by repository evidence alone.
- The repository still contains mixed schema-access styles.
- The backend currently relies on compatibility behavior that may fail once the legacy public-schema cutover is removed.

## Risk Level

- Overall risk: high
- Main risk drivers:
  - legacy/public and service-schema ownership may overlap,
  - some features may appear functional while persisting to the wrong schema,
  - AI-analysis boundaries are still blurred between journal, experience, and infrastructure layers,
  - live project configuration may differ from local CLI configuration.

## Next Milestone

- Milestone 1: architecture and environment baseline
- Exit criteria:
  - final ownership matrix,
  - live schema availability evidence,
  - local-vs-live exposure comparison,
  - full query classification,
  - and legacy table classification.

## Validation Status

- Documentation files created: yes
- Application code changed: no
- Migrations changed: no
- Configuration changed: no
- Tests changed: no
- Database state changed: no
- Git commit created: no

## Current Source-of-Truth Assessment

- Current working source of truth for most backend data: legacy/default-schema access via unqualified `from(...)` calls.
- Intended target source of truth: service-owned schemas in the migration history, especially `user_service`, `journal_service`, `buddy_service`, `verification_service`, `notification_service`, `grounding_service`, `insights_service`, and `ai_analysis`.
- The repository does not yet prove that the live project has fully completed the cutover.

## Gate 1.5 Result

- Project alignment: backend and live integration target the same masked Supabase project ref `wfoq...supabase.co`
- Migration history: local and remote match through `20260824030000`
- Live exposure: `public` is exposed; `user_service` and `ai_analysis` are blocked by `PGRST106`
- Recommended first controlled cutover: user module exposure and contract cutover
- Blocker: the live Data API does not yet expose the target service schemas

## Milestone 2A Status

- Status: blocked
- Blocker: no local or confirmed non-production staging Supabase environment is available for safe validation
- Evidence: `supabase status` could not inspect container health because `docker` is not installed on this machine
- Result: no local reset, schema probe, type generation, or contract test was executed

## New Project Status Update

- Audit phase: remote preflight and migration application completed for the new Supabase project
- Linked project ref: `lruciislmmqvcwweqjop`
- Migration application: repository migration chain and `supabase/seed.sql` were applied to the new project
- Query counts by classification:
  - proper explicit schema selection: pending full code audit
  - default/public access: pending full code audit
  - incorrect dotted table syntax: pending full code audit
  - cross-module access: pending full code audit
  - shared infrastructure: pending full code audit
  - unresolved: pending full code audit
- Confirmed decisions:
  - do not target the old `wfoq...` project
  - keep production untouched
  - continue using the new non-production project only
- Unresolved questions:
  - Data API exposure for `user_service` and `ai_analysis` still needs project-side configuration or verification
  - backend `.from(...)` audit and schema-qualified alignment are not yet complete
- Blockers:
  - REST exposure still returns `406` for `user_service` and `ai_analysis`
  - backend code has not yet been fully rewritten to explicit schema access
- Risk level: medium
- Next milestone: backend schema-qualified access audit and targeted module alignment
- Validation status: migrations and read-only schema verification passed; REST exposure validation partially failed for service schemas
