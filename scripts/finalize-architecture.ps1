$ErrorActionPreference = "Stop"

Write-Host "ECHO microservices verification" -ForegroundColor Cyan

$required = @(
  "services/api-gateway/src/server.ts",
  "services/user-service/src/server.ts",
  "services/journal-service/src/server.ts",
  "services/assessment-service/src/server.ts",
  "services/wellness-service/src/server.ts",
  "ai-service/app/main.py",
  "ml/app/main.py",
  "docker-compose.yml"
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
