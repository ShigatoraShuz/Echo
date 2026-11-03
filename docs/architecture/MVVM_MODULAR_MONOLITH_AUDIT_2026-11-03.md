# MVVM and modular monolith boundary audit — 2026-11-03

## Decision

The repository has the intended feature, service, infrastructure, and database-schema structure, but it is **not yet strict** end to end. A large one-shot relocation would affect authenticated journal, professional, settings, and onboarding flows without proving behavior. Refactor one feature slice at a time, keep its existing contract and user behavior, and require targeted regression tests before the next slice.

Run `npm run audit:architecture` to refresh the static import/schema inventory. Run `node scripts/audit-architecture.mjs --strict` as the eventual acceptance gate. The audit reports static import/export edges and literal `.schema("...")` references; it does not prove runtime authorization, RLS, data ownership, or absence of dynamic imports.

## Current local source inventory

| Boundary | Remaining edges after this slice | Meaning |
| --- | ---: | --- |
| Frontend feature Views/components → services or infrastructure | 54 | Runtime presentation dependencies remain in several features; type-only imports are excluded. |
| Frontend route/layout → services or infrastructure | 24 | Some are framework/auth composition points; others contain application workflows and need extraction. Includes the later Find Help review merge. |
| Frontend shared → feature or service | 14 | Shared code still knows domain-specific behavior. Includes the later navigation review merge. |
| Frontend infrastructure → feature or service | 0 | No static reverse imports detected. |
| Backend feature → another feature implementation | 0 | No runtime cross-feature imports remain; type-only dependencies and cross-schema reads still need review. |
| Required domain schemas absent from migration declarations | 0 | All nine target schema names are declared locally. |

### Follow-up after Wine's resident-model and journal merge

The static audit now excludes type-only imports, which do not create runtime dependencies. On the merged source it reports **54 frontend View/component runtime edges**, **24 route/layout edges**, **14 shared edges**, **0 infrastructure reverse edges**, and **0 backend runtime cross-feature imports**. The backend count fell after moving the reusable AI access middleware to `shared/middleware` and the trusted-contact database access to `infrastructure/supabase`. Type-only cross-module references and direct cross-schema queries still need contract and ownership review. The strict audit still fails because frontend data access remains in presentation code; no end-to-end MVVM or modular-monolith compliance is claimed.

The merged journal detail ViewModel now clears stale failure availability when a saved analysis arrives. Its regression test passes. The full frontend suite passed 1,266 tests, and the full backend suite passed 1,078 tests (four skipped), including a rerun after the backend import relocation. Frontend and backend typechecks and the compile-only production build passed. The broader local AI test subset passed 28 of 33 tests; five need PyTorch, which is absent from this checkout's `ai-service/.venv`. Live GPU and database behavior were not reverified here.

### Browser and AI test follow-up

The Playwright suite passed 229 checks and exposed four identical `/dashboard-preview` failures across mobile and tablet projects. The route intentionally requires `NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW=true` in development; the mobile test server did not set it. The test server now sets that flag, and all four failed cases pass on rerun. The route remains unavailable in production.

An isolated Python 3.12 QA environment with Transformers 4.57.6 and safetensors 0.8.0 passed the complete AI suite: **223 passed, 6 skipped**. Two test harness corrections were needed: cloning tensors before rewriting a memory-mapped safetensors fixture on Windows, and stubbing the model runtime for an HTTP input-validation test so it asserts no inference without launching a real worker. This QA environment uses inherited Torch 2.10 and PEFT 0.19 rather than the declared `core` stack. It does not prove live model loading or predictions on the installed 8 GB RTX 3050; Wine's optimization benchmark used a 16 GB RTX 5060 Ti.

The linked Supabase migration list still has seven local-only and three remote-only IDs described below. No migration was applied. The strict architecture audit still fails on the frontend dependencies in the table above. These remain release checks before pushing this work as complete.

Backend services still access multiple schema owners directly. The largest current examples are journals (`journal_service`, `ai_analysis`, and seven other schemas) and experience (`buddy_service`, `grounding_service`, `insights_service`, `user_service`, `ai_analysis`). The schema inventory alone cannot distinguish authorized read contracts from unauthorized reach-through; each call must be classified before moving it.

## Changes completed in this slice

- Journal draft loading now lives in one ViewModel used by the list and drafts Views. It retains retry, stale-response protection, and pending-request reuse.
- Saved journal photo upload/validation moved from the detail View into its ViewModel.
- Facial history fetching and contract validation moved from the Insights View into a service and ViewModel.
- The journal support check-in API call and state lifecycle moved from its component into a service and ViewModel. Its required-choice behavior remains covered by existing tests.
- Trusted-support contact selection and reviewed-request submission moved from a journal component into a service and ViewModel; consent and failure behavior remain explicit.
- The adult eligibility rule version is shared by registration and access without a direct feature-to-feature import.
- `scripts/audit-architecture.mjs` exposes the remaining boundary work rather than declaring compliance based on folder names.

## Database verification limit

The local isolated SQL validation passes, but local Supabase/Postgres is not running. A read-only `supabase migration list` against the linked project shows **seven local-only migration IDs** (`20261029010000`, `20261029011000`, `20261029012000`, `20261030010000`, `20261101070000`, `20261101120000`, `20261101220000`) and **three remote-only IDs** (`20261101065244`, `20261101113529`, `20261101131604`). Do not apply or repair migration history by guessing: inspect the remote-only SQL, reconcile order and effects, then verify live schemas, grants, RLS, and data before a cutover. No remote database change was made in this work.

## Next safe cutovers

1. Move the remaining journal editor/media and analysis components behind ViewModels and services, preserving consent, photo persistence, and safety-support tests.
2. Extract professional, settings, and onboarding route/View workflows into feature ViewModels. Keep server-side authentication in explicit framework composition layouts and document that exception.
3. Move feature-specific logic from `shared/` to owning features, or make shared components accept data and callbacks through props.
4. Publish backend cross-module interfaces at module entry points; inject dependencies at `server.ts`. Begin with trusted-contact eligibility and verification access, then split `experience` by owner.
5. Reconcile remote migration history and validate schema ownership before changing database access paths. Remove legacy `public` paths only after data parity and rollback are proven.

The acceptance condition for claiming strict architecture is a passing strict import audit, reviewed cross-schema access contracts, green frontend/backend tests and builds, and a real database check on the target environment.

## Verification of this slice

- `npm test`: 1,262 frontend tests and 1,078 backend tests passed after merging the latest review branch; four backend tests were skipped by the suite.
- `npm run typecheck -w frontend` and `npm run typecheck -w backend`: passed.
- `npm run lint`: no errors; existing warnings remain. Targeted lint on newly added frontend modules passed without warnings.
- `npm run build`: passed with temporary placeholder public Supabase/API URLs for compilation only. This is not a live integration or deployment test.
- `npm run test:sql:isolated`: passed, including security and ownership SQL checks. Local Postgres was unavailable; no live RLS or migration replay was performed.
- `node scripts/audit-architecture.mjs --strict`: still fails by design because the remaining edges above have not yet been migrated.
