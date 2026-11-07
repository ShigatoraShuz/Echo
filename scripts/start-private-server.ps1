param([switch]$EnableBuddy, [switch]$DevelopmentUI)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskTailscale = Join-Path $env:ProgramFiles 'Tailscale/tailscale.exe'
if (!(Test-Path -LiteralPath $taskTailscale)) { throw 'Install and sign in to Tailscale on this main PC first.' }
$taskStateText = & $taskTailscale status --json
if ($LASTEXITCODE) { throw 'Tailscale status failed. Open Tailscale and check the connection.' }
$taskState = $taskStateText | ConvertFrom-Json
if ($taskState.BackendState -ne 'Running' -or !$taskState.Self.Online) {
    throw 'Sign in to Tailscale and wait for this computer to be online before starting the private server.'
}
$taskHostName = ([string]$taskState.Self.DNSName).TrimEnd('.')
if ($taskHostName -notmatch '^[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$') { throw 'Tailscale did not return a valid private DNS name.' }
$taskConfigFile = Join-Path $taskRoot 'backend/.local-development/private-server.json'
$taskConfig = if (Test-Path -LiteralPath $taskConfigFile) { Get-Content -LiteralPath $taskConfigFile -Raw | ConvertFrom-Json } else { $null }
$taskModels = if ($taskConfig.modelsRoot) { [string]$taskConfig.modelsRoot } elseif (Test-Path -LiteralPath (Join-Path $taskRoot 'models/manifest.json')) { Join-Path $taskRoot 'models' } else { Join-Path (Split-Path $taskRoot -Parent) 'models' }
if (!(Test-Path -LiteralPath (Join-Path $taskModels 'manifest.json'))) { throw 'The configured model bundle is not installed.' }
$taskEnvironment = @{
    ECHO_REMOTE_API_BASE_URL = "https://$taskHostName/api/v1"
    ECHO_FRONTEND_MODE = $(if ($DevelopmentUI) { 'development' } else { 'production' })
    ECHO_AI_LOCAL_JSON = 'false'
    ECHO_BUDDY_ENABLED = $(if ($EnableBuddy -or $taskConfig.enableBuddy) { 'true' } else { 'false' })
    MODELS_ROOT = [IO.Path]::GetFullPath($taskModels)
}
foreach ($taskKey in @('BUDDY_CBT_PYTHON','BUDDY_CBT_ADAPTER','BUDDY_NANO_ROOT','BUDDY_NANO_PYTHON','BUDDY_WHISPER_PYTHON','BUDDY_WHISPER_DIR','FACE_PYTHON','FACE_MODEL_DIR','BUDDY_MOSS_PYTHON','BUDDY_MOSS_NATIVE_ROOT')) {
    if ($taskConfig.$taskKey) { $taskEnvironment[$taskKey] = [string]$taskConfig.$taskKey }
}
$taskPrevious = @{}
foreach ($taskKey in $taskEnvironment.Keys) { $taskPrevious[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process') }
$taskPidFile = Join-Path $taskRoot 'backend/.local-development/private-server-process.json'
New-Item -ItemType Directory -Force -Path (Split-Path $taskPidFile -Parent) | Out-Null
@{ pid = $PID; startedAt = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $taskPidFile -Encoding utf8
try {
    foreach ($taskKey in $taskEnvironment.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskEnvironment[$taskKey], 'Process') }
    Write-Host "Echo private URL: https://$taskHostName"
    Write-Host 'Use this HTTPS address on this PC and on the authorized laptop. Ctrl+C stops the owned app services.'
    Push-Location $taskRoot
    try { & node scripts/run-integrated-dev.mjs; if ($LASTEXITCODE) { throw 'Echo startup stopped; see the preceding diagnostic.' } }
    finally { Pop-Location }
} finally {
    foreach ($taskKey in $taskPrevious.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskPrevious[$taskKey], 'Process') }
    if (Test-Path -LiteralPath $taskPidFile) {
        $taskRecorded = Get-Content -LiteralPath $taskPidFile -Raw | ConvertFrom-Json
        if ($taskRecorded.pid -eq $PID) { Remove-Item -LiteralPath $taskPidFile }
    }
}
