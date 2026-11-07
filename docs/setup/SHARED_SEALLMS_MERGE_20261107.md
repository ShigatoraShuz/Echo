# Shared SeaLLMs merge validation — 2026-11-07

Merged origin/With-SEALLMs-PRE-LOADER (077d2cf) into review/journal-dashboard-insights-performance-20261102, preserving the existing UI and journal-save work.

## Active architecture

- Startup warms one SeaLLMs-v3-7B-Chat Transformers/PEFT NF4 base, pinned resident until shutdown or recovery. The original checkpoint and adapter files are unchanged.
- Serialized PHQ-8 requests select the PHQ adapter/tokenizer; finally restores CBT even after invalid PHQ output. Buddy Chat and Talk use the same CBT adapter and base worker.
- Chat does not load speech workers. Talk loads Nano and Whisper on demand, and closing Talk releases speech workers while retaining the startup base.
- MODELS_ROOT supports the sibling C:/1Thesis/models directory; no model download, conversion or implicit GGUF fallback is required for this path.
- Optional MOSS v1.5 implementation was merged, but its bundle is not installed on this PC. Nano is the verified active voice.

## Conflict resolutions and preservation

Retained portable per-service interpreter paths, explicit final-face paths, encrypted hosted worker profile, emotion filters, saved-reflection read-only UI, inline analysis progress, and snapshot-bound journal idempotency/draft behavior. No account gates, consent checks, database migrations, model weights, UI design assets or user records were removed. Incoming generated runtime-cache records were excluded from the commit without deleting working files.

The existing model virtual environments pointed to a Microsoft Store alias that broke Windows child-process resource-limit inheritance. Their local pyvenv.cfg home entries now point to uv-managed CPython 3.12.10, with original configurations backed up in the project workspace. Packages and model files were retained; no PATH change was made. This machine-local repair is not a Git-tracked dependency change.

## Validation

- Contracts build, backend build and frontend typecheck passed; optimized private frontend build served successfully.
- Frontend: 201 files, 1345 tests passed.
- Backend: 156 files passed, 5 skipped; 1197 tests passed, 5 skipped.
- Focused Python inference/lifecycle/resource checks: 123 passed. After adding the sibling-root regression, all 26 buddy integration tests passed. This does not claim the entire historical Python suite passed.
- Real GPU standalone smoke: shared engine transformers-peft-shared-nf4-v1 ready in 34.870 s; PHQ pass 20.961 s and approved CBT reply 9.615 s on the same worker PID. Nano coexisted with 8,722,350,080 free GPU bytes. These are single synthetic fixtures, not general latency benchmarks.
- Running app background startup preload: ready in 38.297 s.
- Real Talk service: warm ready in 51.094 s; Nano returned 583,680 PCM bytes at 48 kHz/stereo; generated WAV transcribed nonempty with Whisper; Talk CBT reply approved using the same shared HF engine. Speech workers disappeared after closing Talk; original CBT wrapper PID 25284 / child 20984 remained resident.
- Tailscale browser: saved a clearly marked synthetic reflection, saw inline model progress, then reopened its persisted completed PHQ-8 and emotion report. No placeholder photo appeared in the saved reflection.
- Tailscale browser: sent a synthetic Buddy message after journal analysis and received a visible reply. Chat/Talk mode switching retained the conversation.
- Final service status: ready/baseReady true; talkActive, talkBusy, journalBusy, talkReady false after Talk closed.

## Limits

Physical microphone and webcam capture were not verified in this run. The journal correctly reported no valid mesh while browser camera permission remained pending. MOSS v1.5 is not operational until its bundle is installed and tested. No broad clinical-quality claim follows from these synthetic smoke cases. A PHQ result with missing evidence remains nullable; it must not be replaced by a fabricated zero. The standalone fixture had zero coverage, whereas the separate browser fixture returned a complete model estimate of 0/24.

The app remains available through the existing private Tailscale HTTPS address. No public Funnel or database/auth-policy change was made. This merge is committed locally; pushing was not requested in this task.
