$ErrorActionPreference = "Stop"

Write-Host "ECHO microservices verification" -ForegroundColor Cyan

$required = @(
  "services/api-gateway/src/server.ts",
  "services/user-service/src/server.ts",
  "services/journal-service/src/server.ts",
  "services/assessment-service/src/server.ts",
  "services/recommendation-service/src/server.ts",
  "services/wellness-service/src/server.ts",
  "services/insights-service/src/server.ts",
  "ai-service/app/main.py",
  "ml/app/main.py",
  "frontend/Dockerfile",
  "packages/service-core/index.js",
  "docs/architecture/service-map.json",
  "supabase/migrations/20260828000000_canonical_public_service_ownership.sql",
  "supabase/migrations/20260830000000_user_service_verification_storage_access.sql",
  "supabase/tests/database/service-role-ownership.test.sql",
  "docker-compose.yml",
  "nginx.conf"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Required architecture file is missing: $path" }
}

npm run architecture:check
npm run environment:check
npm run typecheck
npm run lint
npm run test
npm run build

Push-Location ai-service
try {
  uv run --isolated --locked ruff check .
  uv run --isolated --locked pytest -p no:cacheprovider
} finally { Pop-Location }

Push-Location ml
try {
  uv run --isolated --locked ruff check .
  uv run --isolated --locked pytest -p no:cacheprovider
} finally { Pop-Location }

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker compose config --quiet
}

Write-Host "Repository-controlled verification passed." -ForegroundColor Green
git status --short
