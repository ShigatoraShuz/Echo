# Echo runtime version policy

Authoritative runtime versions. Local tools and CI MUST use these versions so lockfile
installs reproduce all builds. ECHO-006; updated 2026-08-15.

| Runtime | Version | Enforcement |
|---|---|---|
| Node.js | 24 (LTS line, currently 24.x) | `.nvmrc`, `engines` in `package.json`, CI `actions/setup-node` node-version: 24 |
| npm | 11.x (ships with Node 24) | lockfile `package-lock.json` v3, `npm ci` in CI |
| Python | 3.12 | `ai-service/pyproject.toml` (`requires-python = ">=3.12"`, ruff target py312), CI `python-version: "3.12"` |
| uv | lockfile-managed | `ai-service/uv.lock`; CI `astral-sh/setup-uv@v7` + `uv sync --all-groups --locked` |

## Reproducibility rules

- Frontend and backend: `npm ci` at repo root (workspaces). Never `npm install` for CI builds.
- AI service: `uv sync --all-groups --locked` in `ai-service/`. Never regenerate the lockfile without
  a reviewed dependency change.
- CI caches: `actions/setup-node` npm cache; uv cache via `setup-uv`.
- Any upgrade of Node/npm/Python MUST be a separate reviewed change that updates `.nvmrc`,
  `engines`, pyproject metadata, CI matrix, and this policy together.

## Why

Node 24 matches the CI workflows (`backend-ci.yml`, `frontend-ci.yml`, `security-checks.yml`),
and Python 3.12 matches `pyproject.toml` and the AI CI workflow. Pinning removes
"works on my machine" drift and makes the release gates (backlog §12.2-12.3) executable.