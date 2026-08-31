# Echo Backlog Progress Ledger

> Historical modular-monolith delivery ledger. It is retained as implementation provenance, but current architecture and validation live in [`docs/architecture/microservices.md`](../architecture/microservices.md) and [`docs/testing.md`](../testing.md).

Authoritative backlog: `docs/ECHO_REQUIREMENTS_QA_AND_110_SCRUM_BACKLOG.md` (110 items, ECHO-001..ECHO-110, verified present exactly once on 2026-08-15).

Status legend:
- `NOT_STARTED` — not yet selected.
- `IN_PROGRESS` — selected; work underway.
- `BLOCKED` — cannot proceed without an unavailable prerequisite; exact reason recorded below.
- `VERIFIED` — every acceptance criterion has executable evidence recorded in VERIFICATION_LOG.md.

Session ledger starts at 2026-08-15. Prior docs (`implementation-report.md`, `current-system-audit.md`, `unresolved-items.md`, `file-move-map.md`) are historical inputs, not evidence.

| ID | Pri | Owner | Status | Depends on | Files changed | AC evidence | Tests | Remaining work | Last updated |
|---|---|---|---|---|---|---|---|---|---|
| ECHO-001 | P0 | BE | VERIFIED | — | backend/src/features/journals/journals.routes.ts, backend/src/index.ts (canonical implementation) | Typecheck+build exit 0 after syntax fixes | npm run typecheck, npm run build, npm run test (20/20) | None | 2026-08-15 |
| ECHO-002 | P0 | BE | VERIFIED | 001 | backend/src/ canonical backend structure, backend/tsconfig.json | One entry (server.ts), one app (app.ts), one v1 router; no req.supabase leaks in src; legacy JWT decoder retired | typecheck+build exit 0; vitest 7 files/20 tests pass | None | 2026-08-15 |
| ECHO-003 | P0 | BE | VERIFIED | 002 | docs/backend/canonical-architecture.md created; legacy duplicate implementation removed | One canonical implementation per concern; imports + API paths documented | typecheck+build exit 0; vitest 20/20 | None | 2026-08-15 |
| ECHO-004 | P0 | DB | BLOCKED | — | docs/database/migration-conflict-inventory.md | Static conflict inventory complete; executable shadow reset pending Docker | None run (Docker unavailable) | Run `npx supabase start && npx supabase db reset` + `db lint` when Docker available | 2026-08-15 |
| ECHO-005 | P0 | DX/DevOps | VERIFIED | 001 | backend/eslint.config.js (ESM flat), frontend/eslint.config.mjs (FlatCompat), frontend/package.json lint script, .lintstagedrc.json, removed frontend/.eslintrc.json | FE+BE lint run via ESLint CLI in ESM mode; CI fails on errors | backend lint 0 errors (13 warnings), frontend lint 0 errors (40 warnings), both exit 0 via workspace scripts | Warnings are pre-existing unused imports owned by ECHO-021/031/042/051 | 2026-08-15 |
| ECHO-006 | P1 | DX/DevOps | VERIFIED | 005 | .nvmrc, package.json engines, docs/devops/runtime-version-policy.md, package-lock.json | One version policy; npm ci + lockfile reproduce all builds | npm ci clean; FE typecheck+tests 195/195; BE typecheck+tests 20/20 | None | 2026-08-15 |
| ECHO-007 | P1 | BE/FE | VERIFIED | 002 | docs/implementation/DECISIONS.md (ADR-001..011), docs/backend/canonical-architecture.md | ADRs reference executable composition roots; MVVM layering verified via page imports | grep page imports (views only); backend typecheck/build green | None | 2026-08-15 |
| ECHO-008 | P1 | DX/DevOps | NOT_STARTED | 007 | — | — | — | — | 2026-08-15 |
| ECHO-009 | P0 | FE/BE | VERIFIED | 002 | backend/tests/contract.test.ts (7 tests), frontend api-client.ts envelope guards + CONTRACT_ERROR, experience-api.test.ts (3 tests) | envelope pinned BE + FE; malformed 2xx success:false and bad success flag fail safely; adapters unwrap data | BE contract 7/7; FE client 20/20 + adapter 3/3; full suites green | None | 2026-08-15 |
| ECHO-010 | P1 | QA | NOT_STARTED | 007 | — | — | — | — | 2026-08-15 |
| ECHO-011 | P0 | BE/SEC | VERIFIED | 002,009 | backend/src/shared/middleware/auth.middleware.ts (verifier-outage fail-closed), backend/tests/auth.fail-closed.test.ts (10 tests) | absent/invalid/expired/wrong-audience/verifier-outage rejected 401, consistent across all protected routes | vitest 10/10; full backend suite 30/30; typecheck green | None | 2026-08-15 |
| ECHO-012 | P1 | FE/BE | NOT_STARTED | 011 | — | — | — | — | 2026-08-15 |
| ECHO-013 | P0 | BE/DB | NOT_STARTED | 011,004 | — | — | — | — | 2026-08-15 |
| ECHO-014 | P0 | FE/BE/DB | NOT_STARTED | 009,004 | — | — | — | — | 2026-08-15 |
| ECHO-015 | P1 | FE/BE | NOT_STARTED | 011,014 | — | — | — | — | 2026-08-15 |
| ECHO-016 | P1 | FE/BE | NOT_STARTED | 011 | — | — | — | — | 2026-08-15 |
| ECHO-017 | P1 | FE/BE | NOT_STARTED | 011 | — | — | — | — | 2026-08-15 |
| ECHO-018 | P1 | FE/BE | NOT_STARTED | 012 | — | — | — | — | 2026-08-15 |
| ECHO-019 | P0 | FE/BE/SEC | NOT_STARTED | 013,090 | — | — | — | — | 2026-08-15 |
| ECHO-020 | P0 | BE/DB/UX | NOT_STARTED | 013,014 | — | — | — | — | 2026-08-15 |
| ECHO-021 | P0 | FE/BE | NOT_STARTED | 009,011 | — | — | — | — | 2026-08-15 |
| ECHO-022 | P0 | FE/BE/DB | NOT_STARTED | 021,094 | — | — | — | — | 2026-08-15 |
| ECHO-023 | P1 | FE/UX | NOT_STARTED | 022 | — | — | — | — | 2026-08-15 |
| ECHO-024 | P0 | BE/DB | NOT_STARTED | 022,096 | — | — | — | — | 2026-08-15 |
| ECHO-025 | P0 | FE/BE/SEC | NOT_STARTED | 021,093 | — | — | — | — | 2026-08-15 |
| ECHO-026 | P1 | FE/BE/DB | NOT_STARTED | 021 | — | — | — | — | 2026-08-15 |
| ECHO-027 | P1 | FE/BE/DB | NOT_STARTED | 021,091 | — | — | — | — | 2026-08-15 |
| ECHO-028 | P1 | FE/BE | NOT_STARTED | 068 | — | — | — | — | 2026-08-15 |
| ECHO-029 | P0 | FE/BE/AI | NOT_STARTED | 021,038 | — | — | — | — | 2026-08-15 |
| ECHO-030 | P0 | QA | NOT_STARTED | 022-029 | — | — | — | — | 2026-08-15 |
| ECHO-031 | P0 | FE/BE | NOT_STARTED | 009,011,092 | — | — | — | — | 2026-08-15 |
| ECHO-032 | P0 | BE/DB/SEC | NOT_STARTED | 031,093 | — | — | — | — | 2026-08-15 |
| ECHO-033 | P1 | FE/BE/DB | NOT_STARTED | 032,096 | — | — | — | — | 2026-08-15 |
| ECHO-034 | P1 | FE/BE/AI | NOT_STARTED | 031,084 | — | — | — | — | 2026-08-15 |
| ECHO-035 | P0 | AI/SEC | NOT_STARTED | 031,106 | — | — | — | — | 2026-08-15 |
| ECHO-036 | P0 | FE/BE/UX | NOT_STARTED | 035,055 | — | — | — | — | 2026-08-15 |
| ECHO-037 | P0 | AI/SEC | NOT_STARTED | 035 | — | — | — | — | 2026-08-15 |
| ECHO-038 | P0 | FE/BE/AI | NOT_STARTED | 020,035 | — | — | — | — | 2026-08-15 |
| ECHO-039 | P1 | FE/BE | NOT_STARTED | 032,038 | — | — | — | — | 2026-08-15 |
| ECHO-040 | P0 | AI/QA | NOT_STARTED | 035,106 | — | — | — | — | 2026-08-15 |
| ECHO-041 | P1 | BE/DB | NOT_STARTED | 091,096 | — | — | — | — | 2026-08-15 |
| ECHO-042 | P1 | FE | NOT_STARTED | 041,009 | — | — | — | — | 2026-08-15 |
| ECHO-043 | P1 | FE/BE/DB | NOT_STARTED | 091,093 | — | — | — | — | 2026-08-15 |
| ECHO-044 | P1 | BE/DB | NOT_STARTED | 043,096 | — | — | — | — | 2026-08-15 |
| ECHO-045 | P1 | AI/UX | NOT_STARTED | 044,040 | — | — | — | — | 2026-08-15 |
| ECHO-046 | P0 | FE/AI/SEC | NOT_STARTED | 014,106 | — | — | — | — | 2026-08-15 |
| ECHO-047 | P0 | FE/UX | NOT_STARTED | 046 | — | — | — | — | 2026-08-15 |
| ECHO-048 | P2 | FE/BE | NOT_STARTED | 041,064 | — | — | — | — | 2026-08-15 |
| ECHO-049 | P1 | FE/UX | NOT_STARTED | 042,044 | — | — | — | — | 2026-08-15 |
| ECHO-050 | P1 | FE/BE | NOT_STARTED | 041,079 | — | — | — | — | 2026-08-15 |
| ECHO-051 | P1 | FE/BE | NOT_STARTED | 009,011 | — | — | — | — | 2026-08-15 |
| ECHO-052 | P0 | FE/QA | NOT_STARTED | 051 | — | — | — | — | 2026-08-15 |
| ECHO-053 | P1 | FE/BE/UX | NOT_STARTED | 051 | — | — | — | — | 2026-08-15 |
| ECHO-054 | P2 | FE/BE | NOT_STARTED | 053,045 | — | — | — | — | 2026-08-15 |
| ECHO-055 | P0 | BE/UX | NOT_STARTED | 091 | — | — | — | — | 2026-08-15 |
| ECHO-056 | P0 | FE | NOT_STARTED | 055,080 | — | — | — | — | 2026-08-15 |
| ECHO-057 | P1 | FE/BE/DB | NOT_STARTED | 093,094 | — | — | — | — | 2026-08-15 |
| ECHO-058 | P1 | FE/BE/UX | NOT_STARTED | 066,057 | — | — | — | — | 2026-08-15 |
| ECHO-059 | P1 | FE/UX | NOT_STARTED | 052,073 | — | — | — | — | 2026-08-15 |
| ECHO-060 | P0 | UX/QA | NOT_STARTED | 035,055 | — | — | — | — | 2026-08-15 |
| ECHO-061 | P0 | FE | NOT_STARTED | 008,009 | — | — | — | — | 2026-08-15 |
| ECHO-062 | P1 | FE/BE | NOT_STARTED | 061,009 | — | — | — | — | 2026-08-15 |
| ECHO-063 | P1 | FE/BE/DB | NOT_STARTED | 062,090 | — | — | — | — | 2026-08-15 |
| ECHO-064 | P1 | FE/BE/DB | NOT_STARTED | 092,097 | — | — | — | — | 2026-08-15 |
| ECHO-065 | P1 | FE/BE | NOT_STARTED | 064 | — | — | — | — | 2026-08-15 |
| ECHO-066 | P0 | FE/BE/DB | NOT_STARTED | 092,094 | — | — | — | — | 2026-08-15 |
| ECHO-067 | P1 | FE/BE/DB | NOT_STARTED | 014,038 | — | — | — | — | 2026-08-15 |
| ECHO-068 | P0 | BE/DB/SEC | NOT_STARTED | 084,097 | — | — | — | — | 2026-08-15 |
| ECHO-069 | P0 | BE/DB/SEC | NOT_STARTED | 068,100 | — | — | — | — | 2026-08-15 |
| ECHO-070 | P1 | FE/BE | NOT_STARTED | 012,018,061 | — | — | — | — | 2026-08-15 |
| ECHO-071 | P1 | FE | NOT_STARTED | 061,079 | — | — | — | — | 2026-08-15 |
| ECHO-072 | P1 | UX/FE | NOT_STARTED | 071 | — | — | — | — | 2026-08-15 |
| ECHO-073 | P1 | UX/FE | NOT_STARTED | 072 | — | — | — | — | 2026-08-15 |
| ECHO-074 | P1 | FE/UX | NOT_STARTED | 073 | — | — | — | — | 2026-08-15 |
| ECHO-075 | P1 | FE/UX | NOT_STARTED | 061,071 | — | — | — | — | 2026-08-15 |
| ECHO-076 | P1 | FE/QA | NOT_STARTED | 071,072 | — | — | — | — | 2026-08-15 |
| ECHO-077 | P0 | FE/QA | NOT_STARTED | 071 | — | — | — | — | 2026-08-15 |
| ECHO-078 | P0 | UX/QA | NOT_STARTED | 072,074,077 | — | — | — | — | 2026-08-15 |
| ECHO-079 | P1 | FE/DX | NOT_STARTED | 071 | — | — | — | — | 2026-08-15 |
| ECHO-080 | P0 | FE/SEC | NOT_STARTED | 025,056 | — | — | — | — | 2026-08-15 |
| ECHO-081 | P0 | BE | NOT_STARTED | 009 | — | — | — | — | 2026-08-15 |
| ECHO-082 | P0 | BE/SEC | NOT_STARTED | 081 | — | — | — | — | 2026-08-15 |
| ECHO-083 | P0 | BE/SEC | NOT_STARTED | 011,082 | — | — | — | — | 2026-08-15 |
| ECHO-084 | P0 | BE/DB | NOT_STARTED | 097 | — | — | — | — | 2026-08-15 |
| ECHO-085 | P0 | SEC/QA | NOT_STARTED | 013,082,094 | — | — | — | — | 2026-08-15 |
| ECHO-086 | P0 | BE/DB | NOT_STARTED | 002,004 | — | — | — | — | 2026-08-15 |
| ECHO-087 | P1 | BE/SEC | NOT_STARTED | 086 | — | — | — | — | 2026-08-15 |
| ECHO-088 | P0 | FE/BE/SEC | NOT_STARTED | 002,009 | — | — | — | — | 2026-08-15 |
| ECHO-089 | P0 | DX/SEC | NOT_STARTED | 006 | — | — | — | — | 2026-08-15 |
| ECHO-090 | P0 | BE/SEC | NOT_STARTED | 083,097 | — | — | — | — | 2026-08-15 |
| ECHO-091 | P0 | DB | NOT_STARTED | 004 | — | — | — | — | 2026-08-15 |
| ECHO-092 | P0 | DB/BE | NOT_STARTED | 091 | — | — | — | — | 2026-08-15 |
| ECHO-093 | P0 | DB/SEC | NOT_STARTED | 091 | — | — | — | — | 2026-08-15 |
| ECHO-094 | P0 | DB/SEC/QA | NOT_STARTED | 091,092 | — | — | — | — | 2026-08-15 |
| ECHO-095 | P0 | DB | NOT_STARTED | 092 | — | — | — | — | 2026-08-15 |
| ECHO-096 | P1 | DB/BE | NOT_STARTED | 092,095 | — | — | — | — | 2026-08-15 |
| ECHO-097 | P0 | DB/BE | NOT_STARTED | 095 | — | — | — | — | 2026-08-15 |
| ECHO-098 | P1 | DB/SEC | NOT_STARTED | 097 | — | — | — | — | 2026-08-15 |
| ECHO-099 | P0 | DB/DX | NOT_STARTED | 091 | — | — | — | — | 2026-08-15 |
| ECHO-100 | P0 | DB/SEC | NOT_STARTED | 092,098 | — | — | — | — | 2026-08-15 |
| ECHO-101 | P0 | DX/DevOps | NOT_STARTED | 005,006 | — | — | — | — | 2026-08-15 |
| ECHO-102 | P1 | QA/FE/BE | NOT_STARTED | 008,101 | — | — | — | — | 2026-08-15 |
| ECHO-103 | P0 | QA/FE/BE | NOT_STARTED | 009,081 | — | — | — | — | 2026-08-15 |
| ECHO-104 | P0 | QA | NOT_STARTED | 030,070,103 | — | — | — | — | 2026-08-15 |
| ECHO-105 | P0 | QA/DB | NOT_STARTED | 091,094,101 | — | — | — | — | 2026-08-15 |
| ECHO-106 | P0 | AI/QA | NOT_STARTED | 101 | — | — | — | — | 2026-08-15 |
| ECHO-107 | P0 | SEC/DX | NOT_STARTED | 089,101 | — | — | — | — | 2026-08-15 |
| ECHO-108 | P1 | DX/BE/FE | NOT_STARTED | 087,040 | — | — | — | — | 2026-08-15 |
| ECHO-109 | P0 | QA/DX | NOT_STARTED | 083,096,108 | — | — | — | — | 2026-08-15 |
| ECHO-110 | P0 | QA/Product | NOT_STARTED | 078,099,104-109 | — | — | — | — | 2026-08-15 |

## Blocked items (exact reasons)

| ID | Blocker | Required command when available |
|---|---|---|
| ECHO-004 | Docker not installed on this machine (`docker` command not recognized). Shadow DB reset and `db lint` cannot run. | From repo root: `npx supabase start`, then `npx supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres`, then `npx supabase db lint` |

## Session history

- 2026-08-15: Session 1 started. Baseline recorded: BE typecheck FAIL (syntax in journal.routes.ts + index.ts), BE lint FAIL (CommonJS eslint.config.js in ESM package), FE lint FAIL (`next lint` deprecated), BE tests 20/20 pass, FE tests 195/195 pass, FE typecheck pass. Selected ECHO-001 first.
- 2026-08-15: Session 1 continued. VERIFIED ECHO-001 (syntax fixes), ECHO-002 (legacy quarantine), ECHO-003 (canonical architecture docs), ECHO-005 (ESM lint migration), ECHO-006 (version policy), ECHO-007 (ADRs), ECHO-009 (API envelope contract tests + FE fail-safe parsing), ECHO-011 (auth fail-closed + verifier-outage hardening). BLOCKED ECHO-004 (Docker). Backend suite now 9 files/37 tests; frontend suite now 38 files/204 tests. AUDIT NOTE for ECHO-089: 5 high-severity deps (PostCSS x3 via next, sharp x2) recorded in VERIFICATION_LOG.md.
