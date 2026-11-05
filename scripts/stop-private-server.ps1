$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskPidFile = Join-Path $taskRoot 'backend/.local-development/private-server-process.json'
if (!(Test-Path -LiteralPath $taskPidFile)) { Write-Host 'No recorded Echo private-server launcher.'; exit 0 }
$taskRecorded = Get-Content -LiteralPath $taskPidFile -Raw | ConvertFrom-Json
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$taskRecorded.pid)"
if (!$taskProcess) { Remove-Item -LiteralPath $taskPidFile; Write-Host 'Echo private server is already stopped.'; exit 0 }
$taskStart = ([DateTime]$taskRecorded.startedAt).ToUniversalTime()
if ($taskProcess.CommandLine -notmatch 'start-private-server\.ps1' -or
    [Math]::Abs(($taskProcess.CreationDate.ToUniversalTime() - $taskStart).TotalSeconds) -gt 2) {
    throw 'The recorded process no longer matches this Echo launcher. Nothing was stopped.'
}
& taskkill.exe /PID $taskProcess.ProcessId /T /F
if ($LASTEXITCODE) { throw 'Echo could not be stopped.' }
Remove-Item -LiteralPath $taskPidFile
Write-Host 'Echo app services stopped. Tailscale and private Serve remain configured.'
