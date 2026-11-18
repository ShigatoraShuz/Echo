param(
    [string]$ThesisVenv = 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV',
    [switch]$SkipMossBuild
)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$serviceRoot = Join-Path $taskRoot 'ai-service'
$thesisPython = Join-Path ([IO.Path]::GetFullPath($ThesisVenv)) 'python.exe'

if (!(Test-Path -LiteralPath $thesisPython -PathType Leaf)) {
    throw "Thesis2 Python is unavailable: $thesisPython"
}

$identity = & $thesisPython -B -c "import json,torch,transformers,peft,bitsandbytes,sys; print(json.dumps({'version':list(sys.version_info[:3]),'torch':torch.__version__,'cuda':torch.version.cuda,'cudaReady':torch.cuda.is_available(),'transformers':transformers.__version__,'peft':peft.__version__}))"
if ($LASTEXITCODE) { throw 'Thesis2 environment compatibility probe failed.' }
$identity = $identity | Select-Object -Last 1 | ConvertFrom-Json
if ($identity.version[0] -ne 3 -or $identity.version[1] -ne 12 -or !$identity.cudaReady -or
    $identity.torch -ne '2.12.0+cu130' -or $identity.transformers -ne '5.5.0' -or $identity.peft -ne '0.21.0') {
    throw 'Thesis2 environment no longer matches the approved Buddy core runtime.'
}

function Remove-LocalJunction([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if (!$full.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside the Echo workspace: $full"
    }
    $item = Get-Item -LiteralPath $full -Force -ErrorAction SilentlyContinue
    if (!$item) { return }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { return }
    # Windows PowerShell 5 can throw a null-reference error for directory junctions.
    # Directory.Delete removes the verified link entry without traversing its target.
    [IO.Directory]::Delete($full, $false)
}

function Ensure-Venv([string]$Name, [string]$Lock, [switch]$SystemPackages) {
    $target = Join-Path $serviceRoot $Name
    Remove-LocalJunction $target
    $python = Join-Path $target 'Scripts/python.exe'
    if (!(Test-Path -LiteralPath $python -PathType Leaf)) {
        $arguments = @('-m','venv')
        if ($SystemPackages) { $arguments += '--system-site-packages' }
        $arguments += $target
        & $thesisPython @arguments
        if ($LASTEXITCODE) { throw "Failed to create $Name." }
    }
    & $python -m pip install --disable-pip-version-check --requirement (Join-Path $serviceRoot $Lock) | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE) { throw "Failed to install $Name dependencies." }
    & $python -m pip check | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE) { throw "$Name has broken dependencies." }
    Write-Output $python
}

$speechPython = Ensure-Venv '.venv-speech' 'requirements-speech-windows.lock'
$nanoPython = Ensure-Venv '.venv-nano' 'requirements-nano-windows.lock'
$mossPython = Ensure-Venv '.venv-moss' 'requirements-moss-windows.lock' -SystemPackages
Remove-LocalJunction (Join-Path $serviceRoot '.venv-core')
& (Join-Path $PSScriptRoot 'setup-face-local.ps1') -ThesisVenv $ThesisVenv

& $speechPython -B -c "import faster_whisper,numpy; print('Whisper environment ready')"
if ($LASTEXITCODE) { throw 'Whisper import probe failed.' }
& $nanoPython -B -c "import torch,torchaudio,torchcodec,transformers,soundfile; assert torch.cuda.is_available(); print('Nano environment ready')"
if ($LASTEXITCODE) { throw 'Nano import/CUDA probe failed.' }
& $mossPython -B -c "import torch,numpy,scipy,soundfile; assert torch.cuda.is_available(); print('MOSS environment ready')"
if ($LASTEXITCODE) { throw 'MOSS import/CUDA probe failed.' }

$mossRoot = Join-Path $taskRoot 'models/moss-native'
Remove-LocalJunction $mossRoot
$configPath = Join-Path $taskRoot 'backend/.local-development/buddy-runtime.json'
New-Item -ItemType Directory -Force -Path (Split-Path $configPath -Parent) | Out-Null
@{
    schemaVersion = 1
    corePython = $thesisPython
    cbtPython = $thesisPython
    nanoPython = $nanoPython
    whisperPython = $speechPython
    mossPython = $mossPython
    mossRoot = $mossRoot
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8

Push-Location $taskRoot
try {
    & node scripts/prepare-buddy-vad.mjs
    if ($LASTEXITCODE) { throw 'Buddy VAD preparation failed.' }
    if (!$SkipMossBuild) {
        & $thesisPython -B scripts/setup-moss-native.py --setup
        if ($LASTEXITCODE) { throw 'Pinned expressive MOSS setup failed.' }
        & $mossPython -B scripts/validate-buddy-moss.py
        if ($LASTEXITCODE) { throw 'Expressive MOSS qualification failed; validation remains disabled.' }
    }
} finally { Pop-Location }

Write-Host 'Local Buddy interpreters and runtime configuration are ready.'
