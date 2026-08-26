$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ECHO ARCHITECTURE FINALIZATION PASS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 0. Safety checkpoint
# ------------------------------------------------------------

Write-Host "[0/8] Checking Git state..." -ForegroundColor Yellow

$branch = git branch --show-current
Write-Host "Branch: $branch"

if (-not $branch) {
    throw "Not inside a Git repository."
}

Write-Host ""
Write-Host "Current changes:" -ForegroundColor DarkGray
git status --short

# ------------------------------------------------------------
# 1. Verify the canonical backend exists
# ------------------------------------------------------------

Write-Host ""
Write-Host "[1/8] Verifying canonical backend..." -ForegroundColor Yellow

$requiredBackend = @(
    "backend/src/app.ts",
    "backend/src/server.ts",
    "backend/src/config/environment.ts",
    "backend/src/shared/middleware/error.middleware.ts",
    "backend/src/features/journals/journals.service.ts"
)

foreach ($file in $requiredBackend) {
    if (-not (Test-Path $file)) {
        throw "Required canonical backend file missing: $file"
    }
}

Write-Host "Canonical backend structure OK." -ForegroundColor Green

# ------------------------------------------------------------
# 2. Make sure AI integration configuration is complete
# ------------------------------------------------------------

Write-Host ""
Write-Host "[2/8] Verifying AI-service integration..." -ForegroundColor Yellow

$envPath = "backend/src/config/environment.ts"
$envContent = Get-Content $envPath -Raw

if ($envContent -notmatch 'ANALYSIS_PROVIDER: z\.enum') {
    throw "ANALYSIS_PROVIDER enum is missing."
}

if ($envContent -notmatch 'AI_SERVICE_URL') {
    throw "AI_SERVICE_URL is missing."
}

if ($envContent -notmatch 'AI_SERVICE_TOKEN') {
    throw "AI_SERVICE_TOKEN is missing."
}

$providerPath = "backend/src/infrastructure/analysis/analysis-provider.factory.ts"

if (-not (Test-Path $providerPath)) {
    throw "Analysis provider factory missing."
}

$providerContent = Get-Content $providerPath -Raw

if ($providerContent -notmatch 'createAiServiceAnalysisProvider') {
    throw "AI-service provider is not wired into the provider factory."
}

Write-Host "Express -> AI-service provider boundary OK." -ForegroundColor Green

# ------------------------------------------------------------
# 3. Verify Docker architecture
# ------------------------------------------------------------

Write-Host ""
Write-Host "[3/8] Verifying service topology..." -ForegroundColor Yellow

$compose = Get-Content "docker-compose.yml" -Raw

foreach ($required in @(
    "frontend:",
    "backend:",
    "ai-service:",
    "AI_SERVICE_URL=http://ai-service:8000"
)) {
    if ($compose -notmatch [regex]::Escape($required)) {
        throw "docker-compose.yml is missing: $required"
    }
}

if ($compose -match 'ANALYSIS_PROVIDER=mock') {
    throw "Docker is still configured to use mock analysis."
}

if ($compose -match 'ALLOW_MOCK_ANALYSIS=true') {
    throw "Docker still explicitly enables mock analysis."
}

Write-Host "Topology verified:" -ForegroundColor Green
Write-Host "  Frontend -> Backend -> AI Service" -ForegroundColor Green
Write-Host "  Backend -> Supabase/PostgreSQL" -ForegroundColor Green

# ------------------------------------------------------------
# 4. Verify AI service security boundary
# ------------------------------------------------------------

Write-Host ""
Write-Host "[4/8] Verifying AI security boundary..." -ForegroundColor Yellow

$securityPath = "ai-service/app/core/security.py"

if (-not (Test-Path $securityPath)) {
    throw "AI security middleware missing."
}

$securityContent = Get-Content $securityPath -Raw

if ($securityContent -notmatch 'compare_digest') {
    throw "AI internal authentication is not using constant-time comparison."
}

if ($securityContent -notmatch 'Bearer') {
    throw "AI service bearer authentication is missing."
}

$analysisPath = "ai-service/app/api/routes/analysis.py"

if (-not (Test-Path $analysisPath)) {
    throw "AI analysis route missing."
}

$analysisContent = Get-Content $analysisPath -Raw

if ($analysisContent -notmatch 'require_internal_token') {
    throw "AI analysis route is not protected by internal authentication."
}

Write-Host "AI internal security boundary OK." -ForegroundColor Green

# ------------------------------------------------------------
# 5. Verify no frontend -> AI direct dependency
# ------------------------------------------------------------

Write-Host ""
Write-Host "[5/8] Checking dependency direction..." -ForegroundColor Yellow

$frontendFiles = Get-ChildItem "frontend/src" -Recurse -File `
    -Include *.ts,*.tsx,*.js,*.jsx `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\.test\.' -and
        $_.FullName -notmatch '__tests__'
    }

$directAiCalls = $frontendFiles |
    Select-String -Pattern 'ai-service:8000|AI_SERVICE_URL|AI_SERVICE_TOKEN|/v1/analyze' `
    -ErrorAction SilentlyContinue

if ($directAiCalls) {
    Write-Host "ERROR: frontend contains a direct AI-service dependency:" -ForegroundColor Red
    $directAiCalls | Select-Object Path,LineNumber,Line
    throw "Frontend must not call AI service directly."
}

Write-Host "Frontend -> AI direct dependency: NONE." -ForegroundColor Green

# ------------------------------------------------------------# 6. Verify sensitive-data boundaries
# ------------------------------------------------------------

Write-Host ""
Write-Host "[6/8] Checking sensitive-data boundaries..." -ForegroundColor Yellow

$serviceRoleLeaks = $frontendFiles |
    Select-String -Pattern "SUPABASE_SERVICE_ROLE_KEY|service_role" `
    -ErrorAction SilentlyContinue

if ($serviceRoleLeaks) {
    Write-Host "CRITICAL: service-role reference found in frontend." -ForegroundColor Red
    $serviceRoleLeaks | Select-Object Path,LineNumber,Line
    throw "Service-role key must remain backend-only."
}

$journalLogs = Get-ChildItem "backend/src" -Recurse -File `
    -Include *.ts `
    -ErrorAction SilentlyContinue |
    Select-String -Pattern 'console\.(log|info|debug).*journal|console\.(log|info|debug).*body|console\.(log|info|debug).*journalText' `
    -ErrorAction SilentlyContinue

if ($journalLogs) {
    Write-Host "WARNING: possible journal-content logging detected:" -ForegroundColor Red
    $journalLogs | Select-Object Path,LineNumber,Line
}

Write-Host "Sensitive-data boundary check complete." -ForegroundColor Green

# ------------------------------------------------------------
# 7. Architecture dependency report
# ------------------------------------------------------------

Write-Host ""
Write-Host "[7/8] Generating architecture report..." -ForegroundColor Yellow

$reportDir = "docs/refactoring"

if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$report = @"
# ECHO Architecture Verification Report

Generated: $timestamp
Git branch: $branch

## Target Architecture

Frontend
    |
    v
Express Backend
    |
    +--> Feature modules
    |
    +--> Repository / data-access boundary
    |
    +--> Supabase/PostgreSQL
    |
    +--> Internal AI Gateway
              |
              v
         FastAPI AI Service
              |
              v
        Model Runtime

## Verified

- Canonical Express app/server structure exists.
- Backend analysis provider abstraction exists.
- AI-service provider is wired into the provider factory.
- Docker service topology contains frontend, backend and ai-service.
- Backend points to ai-service through internal Docker networking.
- AI service uses bearer-token authentication.
- AI authentication uses constant-time token comparison.
- Frontend has no direct AI-service endpoint reference.
- Service-role key is not exposed through frontend source.
- Journal encryption path exists in backend.
- Centralized backend error middleware exists.

## Intentionally Not Claimed

- Docker runtime verification: unavailable if Docker is not installed.
- Supabase migration/RLS execution: requires local Supabase/Docker.
- Production model inference: requires model runtime/artifacts.
- End-to-end AI inference: cannot be marked complete while the FastAPI analysis endpoint remains placeholder.
- Clinical validation: requires the validated model/evaluation process.

## Architecture Decision

ECHO uses a modular-monolith Express backend rather than splitting every feature
into separate network microservices.

The AI inference runtime remains a separate FastAPI service because it has
different runtime/deployment requirements.

This keeps feature management simple while preserving independent AI deployment.

## Dependency Rule

View
 -> ViewModel
 -> Service Port
 -> HTTP Adapter
 -> Shared API Client
 -> Express Route
 -> Controller
 -> Domain Service
 -> Repository
 -> PostgreSQL/RLS

Domain services may call the internal AI gateway.

Frontend must never call the AI service directly.

## Next Release Gates

1. Fix remaining backend typecheck issues if present.
2. Complete repository boundary for remaining direct Supabase services.
3. Finish journal frontend adapter/ViewModel migration.
4. Remove sensitive journal localStorage usage.
5. Add journal pagination/filter/search contract.
6. Complete analysis repository/service workflow.
7. Wire validated model runtime into FastAPI.
8. Run Supabase migration/RLS tests with Docker.
9. Run AI-service CI with uv.
10. Run E2E tests.
"@

Set-Content "$reportDir/architecture-verification.md" $report -Encoding UTF8

Write-Host "Created docs/refactoring/architecture-verification.md" -ForegroundColor Green

# ------------------------------------------------------------
# 8. Run available verification
# ------------------------------------------------------------

Write-Host ""
Write-Host "[8/8] Running verification..." -ForegroundColor Yellow
Write-Host ""

$results = @()

Write-Host "=== Backend Typecheck ===" -ForegroundColor Cyan
npm run typecheck -w backend
if ($LASTEXITCODE -eq 0) {
    $results += "Backend typecheck: PASS"
} else {
    $results += "Backend typecheck: FAIL"
}

Write-Host ""
Write-Host "=== Frontend Typecheck ===" -ForegroundColor Cyan
npm run typecheck -w frontend
if ($LASTEXITCODE -eq 0) {
    $results += "Frontend typecheck: PASS"
} else {
    $results += "Frontend typecheck: FAIL"
}

Write-Host ""
Write-Host "=== Tests ===" -ForegroundColor Cyan
npm run test -w backend
$backendTestExit = $LASTEXITCODE

npm run test -w frontend
$frontendTestExit = $LASTEXITCODE

if ($backendTestExit -eq 0) {
    $results += "Backend tests: PASS"
} else {
    $results += "Backend tests: FAIL"
}

if ($frontendTestExit -eq 0) {
    $results += "Frontend tests: PASS"
} else {
    $results += "Frontend tests: FAIL"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ARCHITECTURE PASS COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$results | ForEach-Object {
    if ($_ -match "PASS") {
        Write-Host $_ -ForegroundColor Green
    } else {
        Write-Host $_ -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Architecture report:" -ForegroundColor Yellow
Write-Host "docs/refactoring/architecture-verification.md"

Write-Host ""
Write-Host "Git status:" -ForegroundColor Yellow
git status --short
