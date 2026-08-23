# Echo Verification Log

Executable evidence per backlog item. Each entry: date, command(s) run with exact output summary (pass/fail counts), and the item(s) it evidences. Historical "complete" claims in other docs are NOT evidence.

## Baseline — 2026-08-15 (before any changes)

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `npm run typecheck -w backend` (cwd backend) | FAIL — TS1109/TS1005 in `src/features/journal/journal.routes.ts:16` and `src/index.ts:36` |
| Backend tests | `npm run test -w backend` | PASS — 7 files, 20/20 tests |
| Backend lint | `npm run lint -w backend` | FAIL — `ReferenceError: module is not defined in ES module scope` (eslint.config.js is CommonJS inside ESM package) |
| Frontend typecheck | `npm run typecheck -w frontend` | PASS |
| Frontend tests | `npm run test -w frontend` | PASS — 37 files, 195/195 tests |
| Frontend lint | `npm run lint -w frontend` | FAIL — `next lint` deprecated; 30 warnings reported (no errors) |

Environment: Node v24.14.0, npm 11.9.0, Windows PowerShell 5.1.

## ECHO-001 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Syntax fix 1 | Fixed `journal.routes.ts:16` (`ilike("content", %%)` -> `ilike("content", \`%${search}%\`)`) | Applied |
| Syntax fix 2 | Fixed `index.ts:36` (`console.log(Echo API server running on port )` -> template literal) | Applied |
| Backend typecheck | `npm run typecheck` (cwd backend) | PASS — exit 0 (after also clearing later-discovered legacy errors via ECHO-002 quarantine) |
| Backend build | `npm run build` | PASS — exit 0 |
| Backend tests | `npm run test` | PASS — 7 files, 20/20 |

Note: after the two targeted fixes, remaining typecheck errors were all in legacy-stack files
(`require-verification` missing module x2, camera-mood query typing, `morgan` not installed).
These were resolved by the ECHO-002 quarantine, which removes the legacy stack from the compiled surface.

## ECHO-002 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Quarantine | Moved 17 legacy files to a temporary legacy quarantine during the migration; the quarantined implementation was subsequently removed | Applied |
| tsconfig | Added the temporary legacy quarantine path to the TypeScript exclusion during migration; the exclusion was subsequently retired after removal | Applied |
| Duplicate routes | `grep router.(get|post|put|patch|delete)` over `src/` — one router per concept, no duplicates | PASS |
| No req.supabase | grep `req.supabase` over `src/` | PASS — no matches |
| Backend typecheck | `npm run typecheck` | PASS — exit 0 |
| Backend build | `npm run build` | PASS — exit 0 |
| Backend tests | `npm run test` | PASS — 7 files, 20/20 |

## ECHO-005 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Backend lint config | `backend/eslint.config.js` rewritten as ESM flat config (`@eslint/js` + `typescript-eslint` + `globals` for `.mjs` scripts) | PASS |
| Frontend lint config | `frontend/eslint.config.mjs` (FlatCompat over `next/core-web-vitals`, `next/typescript`); `package.json` lint -> `eslint .`; `.eslintrc.json` removed | PASS |
| Backend lint | `npm run lint -w @echo/backend` (workspace, as CI does) | PASS — 0 errors, 13 warnings (intentional console in bootstrap) |
| Frontend lint | `npm run lint -w echo-theme-system` | PASS — 0 errors, 40 warnings (pre-existing unused imports, owned by ECHO-021/031/042/051) |
| Lint-staged | `.lintstagedrc.json` now passes per-workspace flat configs to `eslint --fix` | PASS |

## ECHO-011 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Fail-closed hardening | `auth.middleware.ts` catches verifier errors -> 401 (never 500/leak) | Applied |
| Absent/malformed header | supertest no header / Basic / empty Bearer | 401 AUTHENTICATION_REQUIRED |
| Invalid/expired/wrong-audience | verifier returns null | 401 INVALID_ACCESS_TOKEN, service not called |
| Verifier outage | verifier rejects | 401 INVALID_ACCESS_TOKEN (fail closed) |
| Consistency | all 6 protected experience routes unauthenticated | all 401 |
| Public endpoint | `/api/v1/support-resources` | 200 |
| Full suite | `npx vitest run` (backend) | 8 files, 30/30 pass; typecheck green |

## ECHO-006 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Version policy | `.nvmrc` (24), root `engines` (node >=24, npm >=11), `docs/devops/runtime-version-policy.md` | Applied |
| Lockfile sync | `npm install --package-lock-only --ignore-scripts` | PASS — lockfile v3, root engines recorded |
| Clean install | `npm ci` | PASS |
| Frontend reproducibility | `npm run typecheck && npm run test` (frontend) after ci | PASS — 37 files, 195/195 |
| Backend reproducibility | `npm run typecheck && npm run test` (backend) after ci | PASS — 7 files, 20/20 |
| Dependency audit context | `npm audit --omit=dev` | 5 high (PostCSS x3 via next, sharp x2) — recorded for ECHO-089; fix requires breaking Next 16 upgrade |

## ECHO-004 — 2026-08-15 (BLOCKED — Docker unavailable)

Static conflict inventory written to `docs/database/migration-conflict-inventory.md`: 10 migrations,
6 hidden incompatible `IF NOT EXISTS` redefinitions (buddy_conversations, buddy_messages plaintext,
trusted_contacts, notification_preferences, export_requests vs data_export_requests,
deletion_requests vs account_deletion_requests).

Executable commands that must run when Docker is available (from repo root):

```
npx supabase start
npx supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
npx supabase db lint
```

## ECHO-003 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Duplicate errors | Only `shared/errors/app-error.ts` remains (AppError.ts quarantined) | PASS |
| Duplicate auth | Only `shared/middleware/auth.middleware.ts` remains (auth.ts quarantined) | PASS |
| Duplicate middleware | Only `error.middleware.ts` remains (errorHandler.ts quarantined) | PASS |
| Duplicate routers | Only `routes/v1.routes.ts` remains (v1.ts quarantined) | PASS |
| Feature naming | Only `features/journals/` (plural) remains (journal/ quarantined) | PASS |
| Dead schemas | `shared/validation/schemas.ts` was identified as legacy-shaped and unimported; the file was subsequently removed | PASS |
| Documentation | `docs/backend/canonical-architecture.md` documents canonical imports + v1 API paths | PASS |
| Backend typecheck + build + test | `npm run typecheck && npm run build && npm run test` | PASS — exit 0, 20/20 |

## ECHO-007 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| ADRs reference executable composition | `DECISIONS.md` ADR-001..011 (monolith, legacy retirement, ESM, lint, encryption, envelope, auth, env, MVVM, AI boundary, doc precedence) | PASS |
| MVVM layering matches executable state | grep `frontend/src/app/**` imports: pages import only Views/ViewModels from `@/features/...` | PASS — 26 page imports, views only |
| Canonical docs exist | `docs/backend/canonical-architecture.md` | PASS |
| Backend green | typecheck + build | PASS |

## ECHO-009 — 2026-08-15

| Check | Command | Result |
|---|---|---|
| Backend envelope pinned | `tests/contract.test.ts` (7 tests): success envelope, error envelope, validation 400, per-request requestId, no stack leaks, minimal error keys, 404 envelope | PASS 7/7 |
| FE fail-safe on malformed 2xx envelopes | `api-client.ts` guards: `success:false` on 2xx throws parsed/`CONTRACT_ERROR`; non-boolean `success` throws `CONTRACT_ERROR` | Applied |
| FE contract tests | `api-client.test.ts` (6 new): canonical envelope, bare JSON, success:false w/ and w/o error, bad success flag, malformed 5xx | PASS — 20/20 in file |
| Adapter unwrap contract | `experience-api.test.ts` (3 new): unwraps data, throws typed error on 2xx error envelope, missing data | PASS 3/3 |
| ErrorCode union | `CONTRACT_ERROR` added to `error-codes.ts` + `error-messages.ts` | Applied |
| Full suites | BE 9 files/37 tests, FE 38 files/204 tests, both typechecks green | PASS |
