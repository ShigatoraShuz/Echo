param([string]$Python = 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe', [switch]$EnableWorker)
$ErrorActionPreference = 'Stop'
$echoRoot = Split-Path $PSScriptRoot -Parent
$codexRoot = Split-Path $echoRoot -Parent
$aiRoot = Join-Path $echoRoot 'ai-service'
foreach ($port in @(3000,4200,8000)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Stop the existing development instance before running this launcher." }
}
$localConfig = Join-Path $codexRoot 'runtime-cache/core-secrets.json'
New-Item -ItemType Directory -Force (Split-Path $localConfig) | Out-Null
if (!(Test-Path $localConfig)) {
    function New-CoreToken {
        $bytes = New-Object byte[] 32
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
        return [BitConverter]::ToString($bytes).Replace('-', '')
    }
    $secrets = @{ serviceToken = (New-CoreToken); workerToken = (New-CoreToken) }
    $secrets | ConvertTo-Json | Set-Content -LiteralPath $localConfig
}
$secrets = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
$backendEnvironment = Get-Content (Join-Path $echoRoot 'backend/.env')
if ($EnableWorker) {
    $databaseUrl = ($backendEnvironment | Where-Object { $_ -match '^SUPABASE_URL=' }) -replace '^SUPABASE_URL=', ''
    if (([Uri]$databaseUrl.Trim('"', "'")).Host -notin @('localhost','127.0.0.1','[::1]')) { throw 'Worker startup is restricted to a disposable local Supabase project.' }
}
$env:SPEECH_PYTHON = Join-Path $codexRoot 'speech-venv/Scripts/python.exe'
$env:CORE_MODELS_ENABLED = 'true'
$env:MODELS_ROOT = Join-Path $codexRoot 'models'
$env:AI_SERVICE_TOKEN = $secrets.serviceToken
$env:AI_WORKER_TOKEN = $secrets.workerToken
$env:AI_SERVICE_URL = 'http://127.0.0.1:8000'
$env:WORKER_ENABLED = if ($EnableWorker) { 'true' } else { 'false' }
$env:AI_ANALYSIS_MODE = if ($EnableWorker) { 'local_worker' } else { 'local_json' }
$env:BACKEND_URL = 'http://127.0.0.1:4200/api/v1/internal/ai'
$env:LOCAL_DATA_DIR = Join-Path $codexRoot 'local-data/Echo'
$env:AI_JOB_TIMEOUT_MS = '300000'
$env:HF_HUB_OFFLINE = '1'; $env:TRANSFORMERS_OFFLINE = '1'; $env:HF_DATASETS_OFFLINE = '1'
foreach ($entry in @(@('HF_HOME','hf'),@('HF_HUB_CACHE','hf/hub'),@('HF_XET_CACHE','hf/xet'),@('TRITON_CACHE_DIR','triton'))) {
    $cache = Join-Path $codexRoot ('runtime-cache/' + $entry[1]); New-Item -ItemType Directory -Force $cache | Out-Null
    [Environment]::SetEnvironmentVariable($entry[0], $cache, 'Process')
}
Push-Location $echoRoot
try {
    npm run check:contracts
    if ($LASTEXITCODE) { throw 'Contracts build failed.' }
    $process = Start-Process -FilePath $Python -ArgumentList @('-B','-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--workers','1') -WorkingDirectory $aiRoot -WindowStyle Hidden -PassThru
    try {
        $deadline = (Get-Date).AddSeconds(600)
        $ready = $false
        while ((Get-Date) -lt $deadline -and !$process.HasExited) {
            try { $response = Invoke-WebRequest 'http://127.0.0.1:8000/ready' -UseBasicParsing -TimeoutSec 2; $ready = $response.StatusCode -eq 200 } catch { $ready = $false }
            if ($ready) { break }
            Start-Sleep -Seconds 1
        }
        if (!$ready) { throw 'Core models did not become ready; the application was not started.' }
        npm run dev
    } finally { if (!$process.HasExited) { Stop-Process -Id $process.Id } }
} finally { Pop-Location }
