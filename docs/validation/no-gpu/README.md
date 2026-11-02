# ECHO no-GPU pre-validation runbook

This runbook operationalizes the eight items in each of the Software and Guidance Counselor evaluation forms in `C:/Users/ADMIN/Desktop/PAPERS VALIDATIONS/`. It is a **pre-validation** of the local source baseline `d4d77c2` and any documented validation fixes. Reviewers assign the scores. Aim for 4 or 5 on each assessed item and no unresolved safety or privacy concern. Mark unavailable live-model behavior **NT** with a reason. Do not request an “Acceptable for end-user testing” recommendation until the separate GPU-capable model gate is complete.

The current machine's no-GPU preparation outcomes and open blockers are recorded in [RESULTS-2026-11-02.md](RESULTS-2026-11-02.md).

## 1. Freeze before testing

Copy [EVIDENCE.md](EVIDENCE.md) into a dated, private evidence folder and fill in: exact `git rev-parse HEAD`, `git diff --stat`, feature list, browser/version, OS, device/CPU/RAM, display size, network, account roles, and run start time. The initial source baseline is `d4d77c2`; each validation fix must receive a new recorded commit or diff hash. Save redacted configuration and a screen recording. Use fictional adult data only. Preserve the review build and evidence pack until both reviewers finish.

**Frozen feature list:** email/password sign-in; journal creation/edit/reload/delete; stubbed journal analysis with progress and failure; Buddy text and deterministic fallback; dashboard and insights; crisis/support routes; privacy/consent; data export; and authorized professional/admin routes. Camera and microphone permission behavior may be checked on a supported device, but live model predictions, model accuracy, generated Buddy quality/safety, and model latency are NT. Disabled features must be identified as disabled in the review build and cannot receive a functional pass.

Measure three cold starts and five warm navigations on the review device. Record page-ready and stub-complete baselines separately. **Before software item 3 is scored**, reviewers and operator write agreed page and stub time limits in EVIDENCE.md. Never substitute preview animation duration for real stub/API completion. Report live model latency NT.

## 2. Isolated environment

Use a fresh local Supabase project or a separately approved disposable staging project. The currently linked/hosted development project and its existing `backend/.env` and `frontend/.env.local` are **not** isolated validation targets. Do not migrate or create fictional accounts there. After freezing the corrected commit, create a separate clean worktree for validation and put **only isolated-target** values in its ignored `backend/.env` and `frontend/.env.local`. Check the target project ref and applied migration history against `supabase/migrations/` before applying missing migrations. For a local target, run `supabase status` and `supabase migration list --local`; for a separate hosted target, use the guarded [whole-app QA setup](../../qa/whole-app-testing.md) and verify its project ref before `supabase migration list --project-ref <isolated-ref>`. Record the comparison and any additions in the evidence pack.

Create fictional adult account **A** and unrelated adult account **B**, one authorized professional with a real organization and MFA, and an authorized admin with MFA. Record IDs privately; redact tokens, keys, journal contents, and identity details from shared evidence. Use unique synthetic run markers for cleanup. Make account A eligible for the development stub only after normal verification, trusted-contact, and privacy gates. Exercise account B as a denial subject. Confirm fixtures are removed at the end.

For a **local** test environment, configure the ordinary frontend HTTP adapter to `http://127.0.0.1:4200/api/v1` and both services to the same local Supabase URL. Set backend `NODE_ENV=development`, `AI_ANALYSIS_MODE=development_stub`, `AI_CORE_PROFILE=disabled`, `AI_DEVELOPMENT_USER_IDS=<A's UUID>`, and leave `AI_SERVICE_URL` unset. Disable native model and face feature flags. Set frontend `NEXT_PUBLIC_DATA_ADAPTER=http`, `NEXT_PUBLIC_ENABLE_ANALYSIS_FIXTURES=true` for the fixture selector, and `NEXT_PUBLIC_ENABLE_FACIAL_ANALYSIS=false`. Keep server keys only in backend environment files. From the isolated worktree, run `npm.cmd ci`, then start `npm.cmd run dev -w backend` and `npm.cmd run dev -w frontend` in separate terminals, **not** `npm run dev` at the root (that launcher can start native models). The backend script reads its own `backend/.env`; verify that file points to the isolated target before launch. Verify the effective redacted configuration and absence of model-worker traffic before recording a result. The fixture header `X-ECHO-ANALYSIS-FIXTURE` is accepted only for an authenticated allowlisted user in nonproduction stub mode; a second user must be denied fixture selection.

The development-only `/analysis-preview`, `/dashboard-preview`, and `/insights-preview` routes require `NEXT_PUBLIC_ENABLE_ANALYSIS_PREVIEW=true` and development mode. They are fixed interface examples. Keep their “Simulated data” labels in every capture. They do not establish persistence, access control, model output, or latency. The professional browser harness is also mocked; see [its scope](../../../frontend/e2e/README.md).

**Current machine blocker (2026-11-02):** Docker Desktop's Linux engine is unavailable and WSL is not installed, so local Supabase cannot start. Until a separate isolated project or working local Supabase is available, do not mark real-app persistence, ownership, professional access, or complete HTTP analysis as passed. PGlite SQL tests and mocked Playwright journeys are supporting evidence only.

## 3. Execute and record

Run the checks from the repository root, attach command, UTC time, exit code, and logs. A green check is supporting evidence for the stated scope only.

```powershell
npm.cmd run check:contracts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:sql:isolated
npm.cmd run check:auth-policy
npm.cmd run build
npm.cmd run test:e2e:routes -w frontend
npm.cmd run test:e2e:professional -w frontend
```

Run the [manual software scenarios](SOFTWARE_SCENARIOS.md) against the real frontend, backend, and isolated database. Capture before/after records and redacted network evidence for save/edit/export/delete and access denial. Check desktop and mobile, keyboard focus, 200% zoom, empty/error states, and camera/mic permissions on the actual device. Do not use a mocked service response as evidence for the real-app rows. Run the [counselor cases](COUNSELOR_CASES.md) with the actual UI; present deterministic fallback output and curated examples on separate evidence pages. If a case exposes unsafe advice or missed crisis routing, stop that review path, fix it, and rerun before scoring.

For every item, use one of four provenance labels: **real app flow**, **development fixture**, **historical model evidence**, or **untested**. A preview is a development fixture. Use **NT** for a required behavior that was not run, **N/A** only when the form's item truly does not apply, and a 1–5 rating only when the reviewer saw enough to score it. Never convert an NT into a 4 based on unit tests or historical notes.

## 4. Completion gate

Track each correction by item number in EVIDENCE.md. Fix every blocking safety/privacy issue, rerun the affected real flow, and obtain a second review where needed. The pre-validation closes only when both reviewers rate every assessed item 4 or 5, every NT has a reason, and no tested-scope safety/privacy concern remains. Keep the final recommendation pending until live inference, independent model accuracy, generated-response safety, and model latency are evaluated on GPU-capable hardware.
