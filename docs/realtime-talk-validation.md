# Real-time Talk validation report

Date: 2026-10-31 (Asia/Taipei). Implementation is connected in the ECHO project. **Release status: experimental; not approved against the ten-second first-audio gate.** Real microphone, listening quality, and connected-account UI verification remain unverified. Start and rollback instructions: [real-time Talk](realtime-talk.md).

## Actual-model results

Final run: `CODEX/runtime-cache/realtime-acceptance-final/results.json`. 43 turns completed with no turn failures and no support-template substitutions. Synthetic PCM passed through real FastAPI, authenticated Express/WebSocket protocol, frozen support/CBT policy, MMS synthesis, and disposable local JSON. The first repetition in every language acknowledged every generated audio frame, completed speech, and reopened the saved reply from a new JSON repository instance. Remaining turns intentionally interrupted speech after first audio to exercise delivery metadata. Playback acknowledgements in this model benchmark are simulated; the independent browser test exercises actual scheduling using synthetic audio and stubbed inference.

| Synthetic language case | Normal CBT first-audio observations | Support templates | Median seconds | p95 seconds | Ten-second gate |
| --- | ---: | ---: | ---: | ---: | --- |
| eng | 6 | 0 | 10.013 | 16.408 | Failed |
| tgl | 7 | 0 | 20.52 | 21.687 | Failed |
| taglish | 30 | 0 | 13.794 | 18.525 | Failed |

English case: a calm day and planning a small task. Filipino case: a positive day and an activity for tomorrow. Taglish case: enjoying lunch, followed by Filipino wording. These are repeated-input smoke/performance cases, not representative evaluation data. First audio is measured from the last submitted synthetic PCM sample plus the 928 ms endpointing wait to the first audio frame received at the client. It excludes physical speaker startup and human microphone endpoint accuracy. Some other verification ran on the same development host. These figures are not a production latency certification.

Final-run cold process start through readiness took **265.501 seconds** (includes core model preflight, CPU classifier preparation, CBT and Whisper warmup). CUDA Whisper was selected. Free device memory at readiness: **9,457,106,944 bytes**; lowest sampled free memory across turns: **6,974,078,976 bytes**, above the 2 GiB reserve. Core PyTorch high-water allocation was **7,488,279,552 bytes**, including startup preflight. This does not measure the separate CTranslate2 process's allocation peak; whole-device free-memory samples are reported instead. Hardware: RTX 5070 Ti, 16,303 MiB reported VRAM, driver 596.49. Core and speech dependency locks record their separate CUDA/PyTorch versions.

Complete synthesized audio: English 923,648 PCM bytes (28.864 seconds), Filipino 1,075,200 bytes (33.6 seconds), Taglish 716,288 bytes (22.384 seconds). Both language-specific base voices are exercised, with exact approved text supplied phrase by phrase. Manifest and inference fingerprints are stored with results. Audio was transient; model outputs and conversation text remained in disposable local JSON and never entered Supabase.

The baseline run (`CODEX/runtime-cache/realtime-benchmark/baseline-results.json`) produced 24 English normal replies (p95 27.125 s), 23 Filipino normal replies (p95 46.536 s), 23 Taglish support-template replies, and one Filipino turn interrupted by the enforced 30-minute session cap. The original Taglish wording triggered the existing support flag, so its approximately two-second template timings were excluded from normal CBT measurements. No threshold was changed. A separate benign Taglish case supplied the final 30 normal trials. An intervening one-turn run was stopped and is retained at `realtime-final-benchmark/results.json`; it is excluded from the tables.

**Release blocker:** p95 exceeds ten seconds for every final language case. English/Filipino final-build sample counts are only 6/7; earlier same-model baseline observations remain separate rather than being pooled as a 30-trial release approval. Taglish has 30 final normal trials and still fails. No generation policy, support checks, output length, or rewrite/review behavior was weakened to improve speed. The benchmark test passing means the test protocol completed; it does not mean its latency gate passed. All `latencyGate` values are false and the feature remains off by default.

## Functional verification

| Check | Result |
| --- | --- |
| Frontend full suite | Passed: 1,102 tests; JSON evidence `CODEX/runtime-cache/realtime-frontend-tests.json` |
| Frontend focused Buddy/proxy checks | Passed: 81 tests; rerun after callback/lifecycle cleanup |
| Backend full suite | Passed: 922 tests, 4 gated checks skipped in the full run |
| Current Talk protocol/security suite | Passed: 18 tests, including later cancellation-save, disk-failure, replay, origin, expiry and shared-context cases |
| Synthetic browser | Passed: real installed Edge, local ONNX/Silero, AudioWorklet, Express/WebSocket and progressive playback; no hardware microphone |
| Python suite | Passed: 37 tests, 1 gated smoke skipped; existing Starlette/httpx deprecation warning only |
| Type checks/build | Contracts build, frontend/backend type checks and backend build passed |
| Targeted lint | New Talk frontend/transport files pass ESLint; Python Talk runtime/worker and tests pass Ruff |
| SQL compatibility | 21 isolated suites passed; no connected database changes |
| Dependencies | Both project Python environments pass `pip check`; new npm dependencies are locked locally |
| Copied assets | 21 new manifest entries verified by SHA-256/size; `CODEX/runtime-cache/realtime-assets-verification.json` |

Browser cases include voice interruption during playback, Stop cleanup, no stale message after Stop, microphone denial, missing VAD asset, blocked playback, silent input sending nothing, hidden-tab track cleanup, and a congested connection that must still release capture. During barge-in, queued audio nodes stopped before the cancel message was sent; timestamp evidence is in `CODEX/runtime-cache/talk-browser/result.json`. This is a browser scheduling check, not a measured acoustic echo/interruption threshold. Real microphone permission prompts, speaker echo, physical output latency, and listening quality are explicitly **unverified** by user choice.

Protocol checks cover one active owner, mandatory access checks before warmup, wrong/replayed tickets, untrusted Origin, expired claims, account isolation, duplicate accepted IDs, out-of-order PCM, cancelled unchecked drafts, malformed audio, persistence failures, history revocation, and shared Chat/Talk context with history on/off. A database stand-in throws if the test attempts cloud data operations. Existing Supabase identity/privacy services are represented by fixture identities; real account and connected-project end-to-end behavior is **unverified** in this pass.

GPU-priority tests cover both reservation races, waiting rather than fabricating an unavailable screening result, cooperative cancellation without cold-reloading the worker, and restoration of the wrapped generation method. CPU fallback and failure with insufficient headroom pass controlled unit tests; real deliberate GPU exhaustion/driver failure remains **unverified**. CPU Whisper standalone smoke was successful but slower. Negative XLM-R flags never establish safety.

## Dependencies, evidence, and remaining work

Installed project-locally: `ws==8.22.0`, `@types/ws==8.18.2`, `onnxruntime-web==1.31.1`; npm may have re-resolved compatible transitive versions in the existing lock. No Python upgrades or global installs were made. The isolated speech environment already supplied the required packages and is frozen in `ai-service/requirements-realtime-speech.lock`. Initial attempts using an outside-workspace npm cache and Python Hugging Face certificate access failed; installation/preparation subsequently succeeded using a workspace cache and normally verified Node HTTPS downloads. TLS verification was not disabled. There are no remaining missing dependencies for the tested path. The remaining 15 moderate npm audit findings are in development ESLint/minimatch tooling and are recorded separately; no force upgrade was used.

Asset revisions, sizes and hashes: `CODEX/models/voice/realtime/manifest.json`. Source/lock fingerprints: `CODEX/runtime-cache/realtime-implementation-fingerprints.json`. Pre-change selected-file backup: `CODEX/integration-backup/realtime-talk-20261031-130349`. Existing model weights, source adapters and calibration settings were preserved. No real journal/account/audio data, hosted migration, account reset, external message, commit, or push was used.

Before any default enablement: meet the latency gate on at least 30 final-build ordinary replies per language with failures/review outcomes reported separately; perform explicitly authorized hardware/listening tests; verify real-account startup/Chat-to-Talk navigation in the intended local installation; review GPU fallback under relevant resource conditions. This implementation does not establish clinical or language accuracy. The experimental opt-in and manual fallback are available now; the failed release gate is not hidden.

Additional device-parity evidence: `CODEX/runtime-cache/talk-parity.json` passed nine synthetic cases (neutral/distress/explicit concern, quotation, negation, Filipino, Taglish, empty input, and a long journal). Categories, flags and support routes match, with maximum score difference 0.000003. The 1,103-token input was windowed with frozen length 384/stride 64; the tokenizer length warning was nonfatal and no indexing error occurred. Empty input remained indeterminate/review-required. This compares devices only and does not validate the classifications.

Launcher verification is static in this pass. An attempted PowerShell parser check was blocked by this tool session's constrained language mode, so it is not counted as passed. The real launcher/account flow remains unverified; no connected configuration or account data was used.
