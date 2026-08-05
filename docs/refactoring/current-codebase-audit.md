# Current codebase audit

Audit date: 2026-07-24  
Scope: non-generated repository files; `node_modules`, `.next`, Git metadata, and test artefacts excluded.

## Baseline verification

| Check | Result |
| --- | --- |
| `frontend/npm.cmd run typecheck` | Passed |
| `frontend/npm.cmd test` | 18 files, 137 tests passed |
| `frontend/npm.cmd run build` | Passed; 37 routes generated |

The working tree already contains active, uncommitted landing and authentication design changes. This migration adds files around those changes and does not overwrite or move them.

## Repository inventory

| Area | Current state | Migration treatment |
| --- | --- | --- |
| `frontend/` | Next.js 15, React 19, TypeScript, Tailwind, Vitest | Preserve and incrementally connect to the backend |
| `backend/` | Empty directory | Populate with Express application skeleton |
| `frontend/assets/` | Runtime imagery and newly-added landing/auth assets | Audit first; defer moves until all imports are verified |
| `frontend/outputs/`, `frontend/work/` | Empty placeholders | Preserve until ML workspace is active |
| `frontend/src/docs/` | Existing frontend architecture documentation | Keep as frontend-focused reference |
| Root workspace config | Absent | Add npm workspace metadata without replacing frontend configuration |

## Route inventory

All existing Next.js routes are retained. The source-of-truth route table is `frontend/src/docs/ROUTES.md`; it records 30 application routes plus the design-system showcase. Routes are already organised under `(public)`, `(auth)`, `(onboarding)`, and `(protected)` groups.

## Frontend component and responsibility audit

| Area | Current classification | Notes |
| --- | --- | --- |
| `src/app/**/page.tsx` | Route / page shell | Most pages already render a feature View inside a shell |
| `src/features/authentication` | Feature MVVM | View, ViewModel, model, component, service layers exist |
| `src/features/journal` | Feature MVVM | Has mock and placeholder HTTP adapters; connect only after backend CRUD is complete |
| `src/features/dashboard` | Feature MVVM | Uses a mock adapter when no HTTP backend is configured |
| `src/features/landing` | Feature view and components | Static public content; preserve current visual work |
| `src/shared/components` | Shared UI and layout | Feature-independent reusable components; do not import feature code here |
| `src/shared/services/api-client.ts` | Shared API client | Adds bearer tokens and normalizes API errors; can be reused for backend integration |

## Mixed-responsibility findings

| Current file | Current responsibility | Target / action |
| --- | --- | --- |
| `features/journal/services/journal.http-adapter.ts` | HTTP boundary placeholder | Replace only after versioned journal endpoints and contract tests exist |
| `features/authentication/components/google-auth-button.tsx` | UI plus optional OAuth URL lookup | Move authentication provider coordination to Supabase auth helper in a later dedicated migration |
| `shared/services/api-client.ts` | HTTP, token attachment, and error normalization | Retain as shared frontend HTTP foundation; align response parsing with backend envelope |

No React component directly queries Supabase or calls FastAPI. No Supabase client currently exists in the frontend. The API base URL defaults to `http://localhost:8000`, while the target backend is port `4000`; the migration will resolve this through an explicit environment file rather than silently changing runtime behavior.

## Dependency audit

- No backend package or server dependencies existed before this migration.
- The frontend uses `@/*` imports; it already avoids deep relative imports in major features.
- Feature service factories choose mock adapters when an HTTP backend is not configured.
- No circular import was observed in the current source scan.
- No direct browser-to-FastAPI request or service-role key use was found.

## Asset audit

`frontend/assets/` contains active runtime imagery, including the landing gallery and authentication backgrounds. Some names are legacy or misspelled (for example, `iamge 4.jpg`), but they remain in use by current visual work. Asset migration is intentionally deferred until a reference check can prove every new public path works.

## Environment audit

Current frontend environment reads include `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_DATA_ADAPTER`, and feature flags. Existing documentation references Supabase variables, but no configured Supabase browser/server clients are present.

## Safety and privacy findings

- The frontend has no service-role key access.
- Journal HTTP integration is currently a non-functional placeholder rather than an unsafe direct database call.
- The future backend must avoid logging journal bodies, bearer tokens, prompt content, or contact details.
- The model service has no existing implementation or artefact in this repository.
