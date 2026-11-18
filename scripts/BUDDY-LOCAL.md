# Local Buddy runtime

Run `npm run dev` or `npm run dev:buddy` from this checkout to preload SEA-LION
and enable Buddy speech. The base remains resident and CBT/PHQ8 requests switch
adapters. Explicitly set `ECHO_BUDDY_ENABLED=false` to opt out. The private launcher
also enables preloading by default; its `enableBuddy: false` configuration opts out.

The ignored `backend/.local-development/buddy-runtime.json` maps the main service and
CBT worker to the existing Thesis2 Python. Whisper, Nano, and expressive MOSS use
local environments under `ai-service`. Thesis2 is a read-only prerequisite.

Recreate the environments with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-buddy-local.ps1 -ThesisVenv 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV'
```

Use `-SkipMossBuild` to install only the Python environments. The complete setup
downloads and compiles the pinned expressive MOSS assets under `models/moss-native`.
The source archive and model revisions are pinned in the setup script. A new native
build is qualified by `scripts/validate-buddy-moss.py`, which records its manifest
hash with synthetic validation false before testing and enables validation only
after the expressive and startup residency smoke tests pass. Listening quality
remains unverified.

The inactive shared SEA-LION llama.cpp bundle was removed. The active runtime uses
one Transformers/PEFT base with CBT and synthetic-only PHQ8 adapters. The separate
CBT GGUF experiment and its rebuild scripts remain available.
