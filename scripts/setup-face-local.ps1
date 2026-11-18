param([string]$ThesisVenv='E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV')
$ErrorActionPreference='Stop';$root=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent));$python=Join-Path ([IO.Path]::GetFullPath($ThesisVenv)) 'python.exe';$target=Join-Path $root 'ai-service/.venv-face';$source='E:\Python Project\PROJECTS\Thesis2\FACE\final model with ineference\model-final\model';
if(!(Test-Path -LiteralPath $python -PathType Leaf)){throw 'Thesis2 Python is unavailable.'}
New-Item -ItemType Directory -Force -Path (Join-Path $root 'models/face_model') | Out-Null
Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination (Join-Path $root 'models/face_model') -Force
$item=Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue;if($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){[IO.Directory]::Delete($target,$false)}
$facePython=Join-Path $target 'Scripts/python.exe';if(!(Test-Path -LiteralPath $facePython -PathType Leaf)){& $python -m venv $target;if($LASTEXITCODE){throw 'Face venv creation failed.'}}
$installTemp=Join-Path $root 'runtime-cache/face-install';New-Item -ItemType Directory -Force -Path $installTemp | Out-Null;$oldTemp=$env:TEMP;$oldTmp=$env:TMP;try{$env:TEMP=$installTemp;$env:TMP=$installTemp;& $facePython -m ensurepip --upgrade --default-pip;& $facePython -m pip install --disable-pip-version-check -r (Join-Path $root 'ai-service/requirements-face.lock');if($LASTEXITCODE){throw 'Face dependency installation failed.'}& $facePython -m pip check;if($LASTEXITCODE){throw 'Face dependency check failed.'}}finally{$env:TEMP=$oldTemp;$env:TMP=$oldTmp}
Write-Host "Face model and local environment restored."
