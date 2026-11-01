param([string]$Python, [string]$ModelsRoot = $env:MODELS_ROOT, [switch]$AIOnly,
    [string]$LocalDatabaseWorkspace, [ValidateRange(1024,65535)][int]$AIPort = 8000)
$ErrorActionPreference = 'Stop'
$echoRoot = Split-Path $PSScriptRoot -Parent
if (!$Python) { $Python = Join-Path $echoRoot 'ai-service/.venv-core/Scripts/python.exe' }
if (!$ModelsRoot) { $ModelsRoot = Join-Path $echoRoot 'backend/models' }
if (!(Test-Path -LiteralPath $Python) -or !(Test-Path -LiteralPath (Join-Path $ModelsRoot 'manifest.json'))) {
    throw 'Prepare the isolated core environment and verified installed manifest first.'
}
# Read only the required configuration values. Never print credentials or copy files.
function Read-ConfigValue([string]$File, [string]$Name) {
    $line = Get-Content -LiteralPath $File | Where-Object { $_ -match ('^' + [regex]::Escape($Name) + '=') } | Select-Object -Last 1
    if (!$line) { throw "Missing $Name in local configuration." }
    return ($line.Substring($Name.Length + 1)).Trim().Trim('"', "'")
}
$localValues = @{}
if ($LocalDatabaseWorkspace) {
    if ($AIOnly) { throw 'Local database configuration is unnecessary in AI-only mode.' }
    Push-Location $echoRoot
    try {
        $privateJson = & node --import tsx (Join-Path $PSScriptRoot 'local-core-environment.mts') $LocalDatabaseWorkspace
        if ($LASTEXITCODE) { throw 'The local database identity or private settings could not be verified.' }
        $privateConfig = $privateJson | ConvertFrom-Json
        foreach ($property in $privateConfig.PSObject.Properties) { $localValues[$property.Name] = [string]$property.Value }
    } finally { Pop-Location }
}
if (!$AIOnly -and !$LocalDatabaseWorkspace) {
    $backendFile = Join-Path $echoRoot 'backend/.env'
    $frontendFile = @('.env.development.local','.env.local','.env.development','.env') |
        ForEach-Object { Join-Path $echoRoot ('frontend/' + $_) } |
        Where-Object { (Test-Path -LiteralPath $_) -and ((Get-Content -LiteralPath $_) -match '^NEXT_PUBLIC_SUPABASE_URL=') } |
        Select-Object -First 1
    if (!(Test-Path $backendFile) -or (!$frontendFile -and !$env:NEXT_PUBLIC_SUPABASE_URL)) {
        throw 'Full application mode requires owner-supplied local-only backend/.env and frontend configuration. Use -AIOnly for stateless model checks.'
    }
    $database = Read-ConfigValue $backendFile 'SUPABASE_URL'
    $browserDatabase = if ($env:NEXT_PUBLIC_SUPABASE_URL) { $env:NEXT_PUBLIC_SUPABASE_URL } else { Read-ConfigValue $frontendFile 'NEXT_PUBLIC_SUPABASE_URL' }
    if ($env:SUPABASE_URL) { $database = $env:SUPABASE_URL }
    if ($env:NEXT_PUBLIC_SUPABASE_URL) { $browserDatabase = $env:NEXT_PUBLIC_SUPABASE_URL }
    foreach ($value in @($database, $browserDatabase)) {
        $uri = [Uri]$value
        if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('localhost', '127.0.0.1') -or $uri.UserInfo) {
            throw 'Full model startup requires a confirmed loopback local Supabase target. Hosted projects are refused.'
        }
    }
    if ($database.TrimEnd('/') -ne $browserDatabase.TrimEnd('/')) { throw 'Frontend and backend must use the SAME local Supabase URL.' }
    # Next can override .env. Refuse any competing hosted/public configuration.
    foreach ($file in @('.env', '.env.local', '.env.development', '.env.development.local')) {
        $candidate = Join-Path $echoRoot ('frontend/' + $file)
        if (!(Test-Path -LiteralPath $candidate)) { continue }
        foreach ($line in Get-Content -LiteralPath $candidate) {
            if ($line -match '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_API_BASE_URL|GATEWAY_API_BASE_URL)=(.+)$') {
                $key = $Matches[1]; $configured = $Matches[2].Trim().Trim('"', "'")
                $target = [Uri]$configured
                if (!$target.IsAbsoluteUri -or $target.Scheme -ne 'http' -or $target.Host -notin @('localhost','127.0.0.1') -or $target.UserInfo) {
                    throw 'A frontend configuration points outside the local stack. No service was started.'
                }
                if ($key -eq 'NEXT_PUBLIC_SUPABASE_URL' -and $configured.TrimEnd('/') -ne $database.TrimEnd('/')) {
                    throw 'Competing frontend Supabase configuration does not match the local backend.'
                }
            }
        }
    }
    foreach ($key in @('NEXT_PUBLIC_API_BASE_URL', 'GATEWAY_API_BASE_URL')) {
        $configured = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($configured) {
            $target = [Uri]$configured
            if ($target.Scheme -ne 'http' -or $target.Host -notin @('localhost','127.0.0.1') -or $target.UserInfo) {
                throw 'An API process override points outside the local stack.'
            }
        }
    }

    # Avoid background maintenance unrelated to model verification, even locally.
}
$ports = if ($AIOnly) { @($AIPort) } else { @(3000,4200,$AIPort) }
foreach ($port in $ports) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is occupied; stop its known development terminal yourself. No process was killed."
    }
}
function New-RuntimeToken {
    $bytes = New-Object byte[] 48
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$values = @{
    NODE_ENV='development'; APP_ENV='development'; HOST='127.0.0.1'; CORE_MODELS_ENABLED='true'; CORE_TRANSPORT='text_memory';
    MODELS_ROOT=[IO.Path]::GetFullPath($ModelsRoot); WORKER_ENABLED=($(if ($AIOnly) {'false'} else {'true'}));
    AI_SERVICE_TOKEN=($(if ($env:AI_SERVICE_TOKEN -and $env:AI_SERVICE_TOKEN.Length -ge 32) { $env:AI_SERVICE_TOKEN } else { New-RuntimeToken }));
    AI_WORKER_TOKEN=($(if ($env:AI_WORKER_TOKEN -and $env:AI_WORKER_TOKEN.Length -ge 32) { $env:AI_WORKER_TOKEN } else { New-RuntimeToken }));
    BACKEND_URL='http://127.0.0.1:4200/api/v1/internal/ai'; AI_SERVICE_URL="http://127.0.0.1:$AIPort";
    AI_CORE_PROFILE='local_encrypted_worker'; AI_ANALYSIS_MODE='local_worker'; AI_JOB_TIMEOUT_MS='300000';
    REALTIME_TALK_ENABLED='false'; ECHO_REALTIME_TALK='false'; NEXT_PUBLIC_REALTIME_TALK='false';
    ECHO_ACTIVE_MODELS='{}'; HF_HUB_OFFLINE='1'; TRANSFORMERS_OFFLINE='1'; HF_DATASETS_OFFLINE='1';
    HF_HUB_DISABLE_TELEMETRY='1'; ECHO_HTTP_ONLY_MODE='1'; PROFESSIONAL_EVENTS_ENABLED='false';
    NO_PROXY='localhost,127.0.0.1,::1'
}
# PowerShell has case-insensitive hashtables; NO_PROXY also covers no_proxy on Windows.
foreach ($name in $localValues.Keys) { $values[$name] = $localValues[$name] }
$previous = @{}
$process = $null
try {
    foreach ($name in $values.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
    Push-Location $echoRoot
    try {
        $process = Start-Process -FilePath $Python -ArgumentList @('-B','-m','uvicorn','app.main:app','--host','127.0.0.1','--port',[string]$AIPort,'--workers','1','--no-access-log') -WorkingDirectory (Join-Path $echoRoot 'ai-service') -WindowStyle Hidden -PassThru
        $deadline = (Get-Date).AddSeconds(100)
        $ready = $false
        while ((Get-Date) -lt $deadline -and !$process.HasExited) {
            try { $ready = (Invoke-WebRequest "http://127.0.0.1:$AIPort/ready" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $ready = $false }
            if ($ready) { break }
            Start-Sleep -Milliseconds 500
        }
        if (!$ready) { throw 'The bounded text worker did not initialize. No application was started.' }
        Write-Host "AI ready at http://127.0.0.1:$AIPort. Text models load lazily. PHQ-8/speech/Talk/face remain unavailable in this profile."
        if ($AIOnly) {
            Write-Host 'Stateless AI-only mode. No database worker or browser account flow. Ctrl+C stops the owned model process tree.'
            while (!$process.HasExited) { Start-Sleep -Milliseconds 500 }
        } else {
            node scripts/run-local-dev.mjs all
            if ($LASTEXITCODE) { throw 'Application launcher failed.' }
        }
    } finally { Pop-Location }
} finally {
    if ($process -and !$process.HasExited) {
        # Target only this invocation's owned tree, including the GPU child.
        & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
        $process.WaitForExit()
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
