# All Echo model environments and installation

Installation reference for the Windows checkout on 2026-11-18. Commands below are instructions, not a record that packages were reinstalled during handover. Run commands from the Echo repository root. Reuse the existing Python; do not download Python 3.12.10 or install packages into Thesis2_VENV.

## Model-to-environment map

| Model / function | Interpreter | Requirements / identity |
| --- | --- | --- |
| Main private AI service, XLM-R distress/safety classifier, E4-C text emotions | `E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe` | Existing read-only core; `ai-service/requirements-core-windows.lock` is the portable dependency reference |
| SEA-LION/SeaLLMs CBT `mixed_epochs_2` and synthetic-only PHQ8 | Same external core Python, one shared resident Transformers/PEFT worker | Same core requirements; pinned CBT adapter and policy checks |
| Whisper / Faster-Whisper STT | `ai-service\.venv-speech\Scripts\python.exe` | `ai-service/requirements-speech-windows.lock` |
| MOSS-TTS-Nano and its audio codec | `ai-service\.venv-nano\Scripts\python.exe` | `ai-service/requirements-nano-windows.lock` |
| Expressive MOSS-TTS v1.5 native synthesis | `ai-service\.venv-moss\Scripts\python.exe` plus native CUDA executable | `ai-service/requirements-moss-windows.lock`, `ai-service/app/buddy/moss-native.lock.json`, pinned native build script |
| Face expression classifier / MediaPipe runtime | `ai-service\.venv-face\Scripts\python.exe` | Full `ai-service/requirements-face.lock`; `requirements-face-windows.lock` is a shorter companion reference |
| Browser STT, browser face mesh, browser VAD/audio UI | Browser and JavaScript workspace | Root `package-lock.json`, VAD preparation assets; no separate Python venv for browser STT |

The facial worker explicitly runs on CPU. Faster-Whisper currently runs CPU/int8. Nano and CBT use CUDA. MOSS v1.5 is a native TTS runtime; its native code dependency is distinct from the removed shared llama.cpp CBT/PHQ bundle. Removing the latter does not remove the expressive-MOSS runtime requirement. The retained CBT GGUF experiment is not the active SEA-LION path and needs no additional active venv.

## Requirements files and important versions

Use the full tracked locks instead of installing only the packages listed here:

- Core: Python 3.12.14 on the supplied machine, Torch `2.12.0+cu130`, Transformers `5.5.0`, PEFT `0.21.0`, bitsandbytes `0.50.2`, Accelerate `1.15.0`, NumPy `1.26.4`, SciPy `1.15.3`, scikit-learn `1.4.0`, FastAPI/Uvicorn and their pinned dependencies.
- Nano: Torch/Torchaudio `2.11.0+cu130`, Transformers `4.57.1`, TorchCodec `0.17.0`, SoundFile `0.14.0`, NumPy `2.5.4`, plus the complete Nano lock. Do not merge this environment with core.
- Speech: Faster-Whisper `1.2.1`, CTranslate2 `4.8.4`, PyAV `19.0.2`, plus the complete speech lock. That lock contains additional pinned dependencies even though the current Whisper worker uses CPU.
- MOSS: a `--system-site-packages` overlay from the existing Thesis2 Python. It inherits core Torch/NumPy/SciPy and adds SoundFile `0.14.0`. Its one-line lock is intentionally not a standalone native runtime installation.
- Face: MediaPipe `0.10.35`, NumPy `2.1.3`, pandas `2.2.3`, scikit-learn `1.6.1`, SciPy `1.15.3`, OpenCV-contrib `4.11.0.86`, Pillow `11.3.0`, joblib `1.5.2`, plus the full face lock.

`requirements-local.lock` is a historical environment inventory with machine-specific `file:///` entries; do not use it as a clean-machine installer. The generic `requirements-speech.lock` and other older lock files are retained references, not substitutes for the current Windows locks above. Existing `docs/handover/installed-packages.md` is an older inventory, not a fresh snapshot of all current local environments.

## Prerequisites and model assets

Before following the install instructions, distinguish the active Echo environments from the research environments inventoried below. The inventory was read without changing any installed package.

### All Thesis2 environments found on 2026-11-18

Paths in this table are relative to `E:\Python Project\PROJECTS\Thesis2`.

| Environment | Python / installed distributions | Analysis |
| --- | --- | --- |
| `Thesis2_VENV` | 3.12.14 / 133 selected package names | Working Conda environment, not a conventional `Scripts/python.exe` venv. Echo's external core/CBT interpreter is its root `python.exe`. |
| `.venv` | 3.13.5 / 1 distribution | Interpreter starts, but no model libraries were detected. This does not meet the supported Echo Python 3.12 setup. |
| `EMOTION_DETECTION\.venv` | 3.10.10 / 61 package names | Working separate research environment. Torch 2.12.0+cu130, Transformers 4.55.0, NumPy 1.26.4, pandas 2.2.3, SciPy 1.14.1, scikit-learn 1.5.2. Do not substitute it for Echo's validated core. |
| `FACE\final model with ineference\EchoFace_Complete_FaceMesh_Testing_App\EchoFace_v3_2_Mesh_Testing_App\.venv` | Configured for 3.12.1 / 29 offline package names | Copied environment cannot start: its base Python points to the absent `C:\Users\ADMIN\AppData\Local\Programs\Python\Python312\python.exe`. Its package files still exist. |

The copied face environment's package files include MediaPipe 0.10.35, NumPy 2.1.3, pandas 2.2.3, SciPy 1.15.3, scikit-learn 1.6.1, joblib 1.5.2, OpenCV-contrib 4.11.0.86, and Pillow 11.3.0. These were read offline; that environment did not pass an execution test. Echo has a separate working `.venv-face` and does not need this copied environment repaired to use its default face configuration.

Complete package-name/version inventories are included:

- [Thesis2 core, 133 selected packages](../handover/thesis2-core-inventory.txt)
- [Thesis2 root venv, 1 distribution](../handover/thesis2-root-venv-inventory.txt)
- [Emotion research venv, 61 packages](../handover/thesis2-emotion-venv-inventory.txt)
- [Copied face venv, 29 offline packages](../handover/thesis2-face-copied-venv-inventory.txt)

These are metadata inventories, not newly validated installation locks. They contain `package==version` entries without private file URLs. They do not reconstruct Conda system libraries, native binaries, local source patches, model files, or duplicate package metadata.

The actual Thesis2 core currently reports pandas **3.0.6** and SciPy **1.17.1**. The reference Windows core lock lists pandas **2.2.3** and SciPy **1.15.3**. Therefore that lock must not be described as an exact freeze of the installed Thesis2 environment. Core also reports Torch **2.12.0+cu130** and Torchaudio **2.11.0+cu130**; declared dependency checks pass, but this inventory alone is not a binary compatibility test for every audio operation.

Duplicate distribution metadata was detected in Thesis2_VENV:

| Package | Metadata versions present |
| --- | --- |
| charset-normalizer | 3.4.7, 3.5.1 |
| filelock | 3.29.4, 4.0.1 |
| fsspec | 2024.3.1, 2026.7.0, 2026.9.0 |
| hf-xet | 1.6.0, 1.7.1 |

The core inventory records the version selected by `importlib.metadata.version` for each name. Do not delete duplicate metadata or upgrade the research environment as part of Echo installation.

All three runnable Thesis2 interpreters passed read-only `pip check`. Echo's four local speech/Nano/MOSS/face interpreters also start on Python 3.12.14 and passed `pip check`. This checks declared requirements, not complete model inference or subjective audio quality.

### How to inspect or reproduce them safely

To inspect existing Thesis2 interpreters without installing anything:

```powershell
$thesisRoot = 'E:\Python Project\PROJECTS\Thesis2'
& "$thesisRoot\Thesis2_VENV\python.exe" -I -B --version
& "$thesisRoot\Thesis2_VENV\python.exe" -I -B -m pip check
& "$thesisRoot\.venv\Scripts\python.exe" -I -B --version
& "$thesisRoot\.venv\Scripts\python.exe" -I -B -m pip check
& "$thesisRoot\EMOTION_DETECTION\.venv\Scripts\python.exe" -I -B --version
& "$thesisRoot\EMOTION_DETECTION\.venv\Scripts\python.exe" -I -B -m pip check
```

For **Echo installation**, use the supported setup/manual steps below and their Windows locks. None of the additional Thesis2 research venvs need to be installed for Echo's model set.

If a researcher separately needs an emotion-environment copy, create it in a new directory using the existing Python 3.10 interpreter and the inventory as a starting point:

```powershell
# From the Echo root; this is an optional research copy, not an Echo runtime.
& "$thesisRoot\EMOTION_DETECTION\.venv\Scripts\python.exe" -m venv 'ai-service/.venv-thesis-emotion-copy'
& 'ai-service/.venv-thesis-emotion-copy/Scripts/python.exe' -m pip install --extra-index-url https://download.pytorch.org/whl/cu130 -r docs/handover/thesis2-emotion-venv-inventory.txt
& 'ai-service/.venv-thesis-emotion-copy/Scripts/python.exe' -m pip check
```

This optional reconstruction has not been executed or qualified. CUDA wheel availability and the original model project's requirements must be checked before using it for research. Do not commit the optional environment directory. Do not use these commands to overwrite the original.

For the **broken copied face environment**, preserve it as a research artifact. Recreate Echo's separate `.venv-face` from the existing Thesis2 Python using the full `requirements-face.lock` commands below. Copying a Windows venv or editing `pyvenv.cfg` is not a dependable environment restoration procedure.

For the **nearly empty Python 3.13 root venv**, there is no trained-model package setup to reproduce. Keep using the supported Python 3.12 core for Echo. For a full **Thesis2 core restoration**, obtain a complete validated Conda/environment backup and native/CUDA dependencies through the researcher; the selected pip inventory alone is not an exact Conda environment backup.

### Installation prerequisites

- Windows x64 and an existing compatible Python 3.12 installation. The supported setup below specifically expects the existing Thesis2 environment, including its exact CUDA Torch/Transformers/PEFT versions.
- A compatible NVIDIA GPU/driver for the pinned CUDA 13 wheels, sufficient VRAM and disk space. Use the startup compatibility probe rather than assuming that any CUDA installation is sufficient.
- Node.js/npm compatible with this repository's installed Next.js version; use the root npm lock/workspaces.
- Restore the private `models/` bundle separately. Git excludes weights, venvs, runtime binaries/cache, and local data. Installing requirements does not install research checkpoints.

Expected model layout:

```text
models/
  manifest.json
  bundle.manifest.json          # if supplied with the copied bundle
  xlmr-v2/
  e4-c/
  cbt/base/ and cbt/adapter/    # existing core bundle identities
  buddy/base/ and buddy/adapter/  # selected mixed_epochs_2
  buddy/models/nano/
  buddy/models/codec/
  buddy/voices/buddy/
  phq8-seallms/                 # synthetic-only adapter/tokenizer/config
  voice/whisper/
  face_model/
  moss-native/                 # pinned native binaries, model, codec, manifest
```

Preserve matching manifests and hashes when restoring assets. Use the selected pinned adapter, not a folder chosen only because its name looks similar. The selected CBT adapter SHA-256 is `6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e`. Models may not be redistributed without their source/license permissions; obtain private research assets through the project owner.

## Supported installation on this machine

```powershell
Set-Location 'E:\Python Project\CODEX\Echo-latest-synthetic-only'
$thesisPython = 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe'
& $thesisPython -I -B -c "import sys,torch,transformers,peft; print(sys.version); print(torch.__version__,transformers.__version__,peft.__version__); assert torch.cuda.is_available()"
npm ci
npm run build -w @echo/contracts
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-buddy-local.ps1 -ThesisVenv 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV'
```

The setup script validates the read-only core, creates physical local speech/Nano/MOSS environments, installs their locks, runs package/import checks, calls face setup, prepares VAD assets, writes ignored `backend/.local-development/buddy-runtime.json`, then builds/validates expressive MOSS. It may remove obsolete local junction entries without traversing their former targets. Do not run it just to inspect a working installation.

Face setup currently copies its trained package from the existing operator-specific directory:

```text
E:\Python Project\PROJECTS\Thesis2\FACE\final model with ineference\model-final\model
```

That source must exist for the bundled face setup script. On a different machine restore the matching face package under `models/face_model/` and use the manual face installation below; do not assume the E: path exists.

The MOSS builder expects Visual Studio 2022 Build Tools with C++/CMake and the CUDA 13.0 compiler (`nvcc`). Its current build target is CUDA architecture 120. Other GPU architectures need a separately reviewed build configuration; the handover does not change that script. If the compiler/native assets are not available yet, use `-SkipMossBuild` for the environment phase, then finish the MOSS steps before selecting expressive speech.

## Manual local-venv installation

Use this only with the existing validated Thesis2 interpreter and restored model assets. These commands install into Echo's local environments, never into the external core:

```powershell
& $thesisPython -m venv ai-service/.venv-speech
& 'ai-service/.venv-speech/Scripts/python.exe' -m pip install -r ai-service/requirements-speech-windows.lock

& $thesisPython -m venv ai-service/.venv-nano
& 'ai-service/.venv-nano/Scripts/python.exe' -m pip install -r ai-service/requirements-nano-windows.lock

& $thesisPython -m venv --system-site-packages ai-service/.venv-moss
& 'ai-service/.venv-moss/Scripts/python.exe' -m pip install -r ai-service/requirements-moss-windows.lock

& $thesisPython -m venv ai-service/.venv-face
& 'ai-service/.venv-face/Scripts/python.exe' -m pip install -r ai-service/requirements-face.lock

node scripts/prepare-buddy-vad.mjs
```

Run the supported setup script afterward with `-SkipMossBuild` to create/validate machine-local runtime configuration when its original face source is available. Otherwise create that ignored JSON locally with schemaVersion 1 and absolute `corePython`, `cbtPython`, `nanoPython`, `whisperPython`, `mossPython`, and `mossRoot` paths, following the mapping above. Face defaults to the local `.venv-face` interpreter; `FACE_PYTHON` can override it.

On another computer, an ordinary Python venv does not necessarily inherit another venv's packages through `--system-site-packages`. The MOSS overlay assumes the existing Thesis2 base environment. Without that environment, provision and validate a compatible core/base first; do not silently install dependencies into an unrelated research environment or claim a one-package MOSS install is sufficient.

Complete expressive MOSS installation separately when necessary:

```powershell
& $thesisPython -B scripts/setup-moss-native.py --setup
& 'ai-service/.venv-moss/Scripts/python.exe' -B scripts/validate-buddy-moss.py
```

This downloads pinned MOSS model/codec/source assets and builds native binaries under the local model root. Validation updates the local MOSS manifest/qualification identity; do not mark qualification successful manually. Review a newly generated tracked source lock before committing it. Native dependencies are not satisfied by `pip install` alone.

## Verify every environment

```powershell
& $thesisPython -m pip check
& 'ai-service/.venv-speech/Scripts/python.exe' -m pip check
& 'ai-service/.venv-nano/Scripts/python.exe' -m pip check
& 'ai-service/.venv-moss/Scripts/python.exe' -m pip check
& 'ai-service/.venv-face/Scripts/python.exe' -m pip check

& 'ai-service/.venv-speech/Scripts/python.exe' -B -c "import faster_whisper,av,numpy; print('Whisper imports ready')"
& 'ai-service/.venv-nano/Scripts/python.exe' -B -c "import torch,torchaudio,torchcodec,transformers,soundfile; assert torch.cuda.is_available(); print('Nano imports/CUDA ready')"
& 'ai-service/.venv-moss/Scripts/python.exe' -B -c "import torch,numpy,scipy,soundfile; assert torch.cuda.is_available(); print('MOSS Python overlay ready')"
& 'ai-service/.venv-face/Scripts/python.exe' -B -c "import mediapipe,numpy,sklearn,cv2,joblib; print('Face imports ready')"
```

Core `pip check` is read-only. If it reports a conflict, investigate compatibility without upgrading the research environment. Do not combine all locks into a single venv; their Torch, Transformers, NumPy and scikit-learn versions intentionally differ.

## Start and test

Provide the existing private backend/frontend environment configuration through a secure channel. `.env.example` is a template, not working credentials. Do not copy credentials into the handover or commit machine-local JSON.

```powershell
npm run dev:buddy
```

The coordinated launcher starts the AI service on 8002, backend on 4200, and frontend at `http://127.0.0.1:3000`. Stop any existing coordinated instance first. Python edits require a coordinated restart. The normal `npm run dev` does not explicitly enable Buddy preload.

For the existing opt-in synthetic Nano/Whisper round-trip check, with adequate free GPU memory:

```powershell
& $thesisPython -B scripts/check-speech-preparation.py
```

This checker uses its own temporary resident workers and saves only a synthetic validation report under ignored `runtime-cache/buddy-audit/`. Avoid a second large model copy when the active app already fills GPU memory. Physical microphone/browser permissions, naturalness, pronunciation, and expressive-MOSS listening quality still require manual checks.
