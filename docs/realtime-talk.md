# Real-time local Buddy Talk

Implementation and validation: 2026-10-31. Hands-free Talk is **experimental and disabled by default**. Its measured first-audio latency has not passed the 10-second release gate. Chat and the existing record/stop Talk flow remain available.

## Start

Run the complete application from one terminal:

```powershell
& 'E:\Python Project\CODEX\Echo\scripts\start-local-core.ps1' -EnableRealtimeTalk
```

The launcher starts Python on loopback 8000, Express on 4200, and Next on 3000, builds contracts first, uses local JSON, and does not enable the database worker. Do not start another `npm run dev`. Occupied ports are rejected; no existing process is killed. Omitting `-EnableRealtimeTalk` restores the existing manual Talk flow. The three flags `ECHO_REALTIME_TALK`, `REALTIME_TALK_ENABLED`, and `NEXT_PUBLIC_REALTIME_TALK` must agree; the launcher sets them together for its child processes. Localhost proxy exclusions stay process-local.

Choose Buddy > Talk > Start Talk. No microphone is opened until that explicit action and the models report ready. Preparation is a cold load and can take minutes on this installation. Silence ends a turn; a final transcript is accepted once. Provisional transcripts never become chat messages. Buddy's complete CBT response must pass the existing policy before speech starts. Voice interruption or Interrupt Buddy stops local playback, cancels pending output, and permits the next turn. Stop Talk, changing conversations/modes, hiding the tab, navigation, or disconnect releases capture/playback. Disable voice interruption or use headphones if speaker echo causes false interruptions. Speech failures retain approved text. Unsupported browsers or blocked playback show an explicit error; use Chat/manual Talk or restart with the user-gesture Start button.

## Local models and dependencies

| Function | Assets/runtime |
| --- | --- |
| Speech recognition | Existing Faster-Whisper large-v3-turbo copy, revision `0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf` |
| English base voice | `facebook/mms-tts-eng`, revision `c71de0fe7204c83f1c10820a7d696d0b450048ba` |
| Filipino base voice | `facebook/mms-tts-tgl`, revision `79182edde3d60484a9e7a666240917f454138a0b` |
| Browser endpointing | Local Silero V6 ONNX from installed Faster-Whisper 1.2.1; local ONNX Runtime Web 1.31.1 WASM |
| Support and replies | Existing calibrated XLM-R on CPU during Talk; existing selected CBT adapter/base on GPU with unchanged prompt, stopping, rewrite, and review policy |

MMS copies are under `E:\Python Project\CODEX\models\voice\realtime`; `manifest.json` records revisions, SHA-256 and sizes. The existing Whisper manifest remains unchanged. Each speech-worker start verifies the selected model files before loading. Asset verification also checked the browser ONNX/WASM copies (21 manifest entries). The explicit preparation script pins the approved revisions; runtime never downloads. All loaders use local paths/offline settings. No reference recording, cloned voice, speaker adaptation, translation, or cloud/browser speech service is used. Language selection is a versioned application heuristic per phrase; voices can change within a mixed reply. Unsupported tokenizer normalization fails explicitly instead of silently omitting approved words or digits.

The MMS model cards identify **CC-BY-NC-4.0**, consistent with the approved noncommercial thesis/research scope: [English model](https://huggingface.co/facebook/mms-tts-eng), [Tagalog model](https://huggingface.co/facebook/mms-tts-tgl). Silero is MIT; its license is copied beside the browser asset. Models and WASM binaries are outside Git or ignored.

Installed only in this project: backend `ws==8.22.0`, dev `@types/ws==8.18.2`, frontend `onnxruntime-web==1.31.1`. `package-lock.json` records the resolved npm tree. The existing isolated `CODEX/speech-venv` already supplied compatible Python dependencies; no Python packages or Thesis2_VENV versions were changed. `ai-service/requirements-realtime-speech.lock` captures the resolved speech environment: Torch/Torchaudio 2.11.0+cu130, Transformers 4.57.6, Faster-Whisper 1.2.1, CTranslate2 4.8.4, NumPy 2.5.4 and ONNX Runtime 1.31.1. Both Python environments passed `pip check`. No tested runtime dependency remains missing. npm audit reports 15 moderate findings in the development ESLint/minimatch toolchain; no force upgrades were applied. Details are in `CODEX/runtime-cache/realtime-npm-audit.json`.

## Boundaries and lifecycle

The browser sends bounded PCM16 mono 16kHz over `/api/v1/buddy/voice/stream` on Express. Authenticated HTTP creates a short-lived single-use ticket, sent in the first WebSocket message rather than a URL. The upgrade validates Origin. Ownership, verified account access, processing gates, and history preferences are rechecked before inference/publication and between speech phrases. Token refresh cannot extend the 30-minute session cap. One Talk session can own this installation at a time; anonymous sockets, frames, utterances, pending finalizations, provisional transcription, audio buffering, and playback credits are bounded. The idle deadline is 60 seconds. Maximum utterance is 60 seconds / 1.92 MB PCM, with sequence/generation validation. Old generations cannot replay audio or save unchecked drafts.

A single core lock schedules GPU execution. Talk keeps CBT and tested CUDA Whisper resident only if at least 2 GiB remains free; speech synthesis uses CPU MMS. If CUDA Whisper startup/headroom fails it is reaped before trying CPU Whisper. Startup failure remains unavailable. All model execution is serialized, including speech subprocess work. A persistent speech child is killed and waited for on close/failure; cooperative interruption rejects its bounded in-flight result without repeatedly cold-loading it. CPU XLM-R retains the frozen calibration/labels/384-token/stride settings. Talk takes priority between bounded journal stages; interrupted stages remain waiting for the provider. Screening-only retries reject busy Talk before consuming an attempt. Face capture remains volatile, queued only within its existing four-minute TTL, then explicitly unavailable if it expires.

Accepted and approved text follows the existing local JSON repository and account ownership checks. Optional `delivery` metadata records played/interrupted status and acknowledged duration; STT/TTS/model/inference provenance is kept separately. Old conversation files remain readable. Interrupted speech does not replace the full approved text. Chat and Talk use the same saved conversation or bounded temporary context. With history off, no conversation file is created. Raw audio is never included in JSON, exports, logs, Supabase, or public file storage. Supabase still handles existing account/privacy/journal responsibilities; no hosted migrations or real-user submissions were performed.

## Validation and known limits

| Requirement | Status and evidence |
| --- | --- |
| Dependency imports and consistency | Passed: project-local installations; both `pip check` runs clean |
| Hashes and local-only loading | Passed: 21 new manifest entries verified; actual speech/core models loaded with offline flags and copied paths |
| Shared GPU residency/headroom | Passed on RTX 5070 Ti 16 GB, driver 596.49: CUDA Whisper plus CBT, approximately 9.45 GB free at readiness; execution serialized |
| CPU support-check parity | Passed nine synthetic CPU/GPU cases including explicit concerns, quotation, negation, empty input and a 1,103-token journal: categories, flags and routes matched; maximum score difference 0.000003. Empty input stayed indeterminate/review-required. Limited parity evidence, not accuracy validation |
| Exact approved response, cancellation, generation isolation | Passed protocol/unit tests; no speech for cancelled unchecked drafts; malformed/silent audio fails explicitly |
| Local JSON/reopen/temporary context | Passed protocol and synthetic integration checks; database stand-in throws on any attempted cloud data operation |
| Browser capture, VAD, progressive playback and barge-in | Passed in installed headless Edge with fake WAV input, real local ONNX/AudioWorklet and real Express/WebSocket; inference stubbed in this browser test |
| Denial, silence, missing VAD, blocked playback, hidden-tab cleanup | Passed synthetic browser checks; Stop releases tracks/context and stale callbacks do not add messages |
| Session deadline | Passed: the baseline long run closed at its 30-minute cap; the interrupted turn is recorded as a failure, not successful speech |
| Existing application compatibility | Frontend/backend type checks, frontend/backend tests, Python tests and 21 isolated SQL suites passed; final counts and measurements are in the companion report |
| Ten-second warm first-audio target | **Failed. Feature stays experimental/off by default.** Normal CBT/rewrite latency dominates; support-template timing is excluded |
| Real microphone, physical playback, echo quality, listening quality | **Unverified**, per permission to use synthetic tests only |
| Real account login/full launcher against connected configuration | **Unverified in this pass**; synthetic identities only, no protected environment files read or live account operations |
| Forced low-memory/driver-failure CPU fallback under real GPU pressure | **Unverified**; fallback code exists and CPU Whisper smoke passed, but no deliberate resource exhaustion was performed |
| Broad language/safety/clinical accuracy | **Unverified by these tests**; synthetic smoke and speed tests do not establish accuracy. Existing support routing is preserved |

See `realtime-talk-validation.md` for measurements, case counts, source hashes and remaining release blockers. Fast first audio is not the same as full playback, and the actual-model benchmark's playback acknowledgements are simulated. The browser test validates scheduling separately with synthetic audio; real speaker/microphone latency remains unverified.

## Verification and rollback

Use `vitest.local.config.ts` and Python `ECHO_ISOLATED_TEST=true` for synthetic tests without loading environment files. The model benchmark sets this Python opt-out explicitly; it changes only configuration-file loading and preserves token/account checks. Run the gated browser test with `ECHO_VERIFY_TALK_BROWSER=true`; it uses installed Edge and never a hardware microphone. The actual-model benchmark requires `ECHO_BENCHMARK_TALK=true` and a project-local TEMP/NO_PROXY; it creates disposable local JSON plus synthetic auth fixtures, not Supabase records. `BUDDY_TALK_RUN` selects a separate evidence directory and `BUDDY_TALK_COUNTS` can bound cases. Do not run model benchmarks alongside another GPU inference process.

To disable hands-free Talk, stop the launcher and restart without `-EnableRealtimeTalk`; existing manual Talk and JSON history remain available. Pre-change selected-file backup: `E:\Python Project\CODEX\integration-backup\realtime-talk-20261031-130349`. Review files before restoring, because this working tree contains unrelated main-branch reconciliation changes. Node rollback uses the backed-up package manifests/lock and project-local installation; an offline reinstall requires the cached packages. No Python rollback is needed for this task because neither Python environment was modified. New model assets may remain unused. No source checkpoints, thresholds, hosted database, commits or remote branches were changed by this real-time work.
