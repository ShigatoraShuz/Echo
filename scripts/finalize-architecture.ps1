$ErrorActionPreference = "Stop"

Write-Host "ECHO microservices verification" -ForegroundColor Cyan

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

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

Invoke-NativeChecked -Command "npm" -Arguments @("run", "architecture:check")
Invoke-NativeChecked -Command "npm" -Arguments @("run", "environment:check")
Invoke-NativeChecked -Command "npm" -Arguments @("run", "typecheck")
Invoke-NativeChecked -Command "npm" -Arguments @("run", "lint")
Invoke-NativeChecked -Command "npm" -Arguments @("run", "test")
Invoke-NativeChecked -Command "npm" -Arguments @("run", "build")

Push-Location ai-service
try {
  Invoke-NativeChecked -Command "uv" -Arguments @("run", "--isolated", "--locked", "ruff", "check", ".")
  Invoke-NativeChecked -Command "uv" -Arguments @("run", "--isolated", "--locked", "pytest", "-p", "no:cacheprovider")
} finally { Pop-Location }

Push-Location ml
try {
  Invoke-NativeChecked -Command "uv" -Arguments @("run", "--isolated", "--locked", "ruff", "check", ".")
  Invoke-NativeChecked -Command "uv" -Arguments @("run", "--isolated", "--locked", "pytest", "-p", "no:cacheprovider")
} finally { Pop-Location }

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Invoke-NativeChecked -Command "docker" -Arguments @("compose", "config", "--quiet")
}

Write-Host "Repository-controlled verification passed." -ForegroundColor Green
Invoke-NativeChecked -Command "git" -Arguments @("status", "--short")
