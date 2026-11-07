# Startup residency, optional native speech and maximum-context qualification

Date: 2026-11-06. Local follow-on on `echo-tailscale-remote`; no push/merge or deployment. Restart the coordinated application to activate source changes. The main running stack was not restarted by these isolated checks.

## Current selection

- One startup-owned Transformers/PEFT NF4 SeaLLMs base with the exact mixed_epochs_2 CBT and PHQ adapters; shared PID and serialized adapter/generation operations.
- Fast Talk remains the original CUDA/PyTorch MOSS Nano with its codec/reference. The user declined audio.cpp and ONNX. Nano was not converted to llama.cpp.
- Optional Expressive Talk uses the exact MOSS-TTS-v1.5 model with the pinned OpenMOSS llama.cpp fork, Q4_K_M backbone and F16 encoder/decoder. It does not use another speech model silently.
- Original generated Buddy WAV unchanged. Native code uses a verified derived 24 kHz mono reference. Delivery remains 48 kHz stereo. Human quality/expressiveness and cross-engine voice consistency are unverified.
- 28,000,000,000-byte committed-memory and 60% CPU limits apply to controlled process trees, not total machine consumption. Global GPU reserve remains 2 GiB.

## Native defect found and fixed

Initial simple synthetic speech succeeded, but distinct-phrase checks exposed intermittent Windows C0000374 heap corruption. Crashed-process audio was rejected and the native selection was gated off during investigation.

MSVC AddressSanitizer identified a heap-buffer-overflow in `llama_context::decode`: output-index storage was sized to the number of returned logits, while mapping used original input-batch indices. The pinned setup patch now reserves at least the configured input-batch size and asserts the index bound. Five repeated sanitizer runs then completed without the reported error. The accepted binaries were rebuilt in Release with sanitizer instrumentation OFF; diagnostic binaries were not activated.

Three release phrase checks passed without a crash. CPU Whisper expected-word coverage was 92.3%, 100%, 92.3%, with recognized-word precision 100% for these fixtures. Combined synthesis/transcription took 13.58–14.80 seconds for 4.08–4.16-second samples. These are synthetic ASR consistency checks, not a human listening verdict or pure synthesis latency benchmark.

The setup pins fork `b785003ba497794ecfa337c3e47f01af79489888`, MOSS v1.5 revision `cdd3b911b1585e3f2dbc7775ef10f9926f58850a` and codec revision `3cd226ba2947efa357ef453bcad111b6eafba782`. Artifact/DLL/executable/source-patch hashes were refreshed after the repair; the tracked source lock identifies the accepted local manifest. After activation, normal preflight also passed without the diagnostic bypass. Normal inference does not download anything. New model files and build products remain ignored.

## Real private-IPC startup and Expressive check: passed

- Initial base state was unloaded; explicit background startup preload took 62.784 seconds, with 585 successful status polls during preparation. This excludes transport-construction/import/inventory time.
- Automatic page release retained the startup-owned base PID.
- Expressive/Whisper preparation took 80.823 seconds.
- A distinct phrase, unrelated to the reference script, produced 4.16 seconds of audio; synthesis plus CPU Whisper verification took 14.055 seconds with 100% expected-word coverage.
- Stop Talk and automatic page unload preserved the same base PID; explicit Unload released it.
- Minimum 100-ms sampled global free GPU memory: 3,226,365,952 bytes (3.00 GiB), above the 2 GiB reserve. Owned test workers were released.

Local ignored evidence: `models/startup-expressive-test.json`, `.git/startup-expressive-final.log`, `.git/moss-release-diagnostics.log`, `.git/moss-asan-fixed.log`. No microphone recording, account history or rejected response was saved by these checks.

## Real maximum-context and long Nano speech: passed after capacity repairs

The first all-resident 4096-token run fell below the GPU reserve; the next exposed an insufficient reservation for a three-sentence Nano batch. Both failed checks remained failures. The fixes reserve context/generation capacity, yield optional emotion/safety GPU workers at operation boundaries when necessary, return unused CUDA allocator cache, and reserve Nano capacity for the actual batch size. They do not reduce context limits, change models/devices, evict the startup base or weaken approval checks.

The final run passed:

- 3,196 input + 900 generated = 4,096 tokens, 106.573 seconds, using diagnostic synthetic output that was never delivered as an approved reply.
- Long-input XLM-R and E4 inference succeeded; E4 was reloaded/inferred successfully after yielding for context and speech capacity.
- PHQ retained its existing 1,700-token input policy (9.787 seconds); no PHQ policy reduction was introduced.
- An oversized latest user message was rejected with a specific context-limit error. The next approved CBT reply used the same shared PID.
- Twenty Nano sentence segments completed with schedule `[1,1,3,3,3,3,3,3]`; original voice/reference and sentence order were retained.
- Minimum 100-ms sampled global free GPU memory: 3,849,555,968 bytes (3.59 GiB). Owned workers were released.

Evidence: `models/maximum-context-test.json`, `.git/maximum-context-final.log`. This run does not prove sustained real-user journal scheduling, browser timing or speech listening quality. The final stress report does not contain an isolated long-synthesis duration, so none is claimed.

## Automated checks and remaining failures

- Focused Python regression suite: 157 tests passed, including startup readiness/redaction, shared ownership, native setup bounds/idempotence, qualification gating, transport, lifecycle and V3 checks.
- Backend Talk/ownership suites: 40 passed. Frontend Buddy/Talk suites: 29 passed.
- Shared contracts build, frontend/backend type checks, backend build and architecture audit passed. `git diff --check` passed.
- The broader Python run before the final two small native-regression additions: 476 passed, 33 failed, 5 skipped. The remaining failure identities match the previously compared baseline: optional media imports absent from the core test environment and existing synthetic tokenizer/checkpoint/research fixtures. Environments were not modified to conceal them. The full suite is not green.
- Production frontend build is blocked by the existing production Supabase/API configuration guard. Development settings were not replaced with fabricated production settings. No successful production frontend build is claimed.

## Unfinished acceptance

Authenticated browser/multi-tab/navigation/autoplay/retry flows, physical microphone/webcam, echo and human English listening review remain unverified. Filipino/Taglish remain experimental. No claim of end-to-end deployment readiness follows from the synthetic tests. Earlier broader storage/export/deletion and full product acceptance work remains unfinished; this substage does not complete it.

Native encoder/backbone/decoder weights currently load sequentially inside each sentence subprocess; only verified assets/reference state stay in the native Python worker. This mode is intentionally slower and is not claimed to be fully resident native speech across sentences.

Start instructions: [current runtime guide](../setup/BUDDY_STARTUP_AND_VOICES.md). Source rollback checkpoints exclude model files/environments/private records; no remote publication occurred.

## Rollback

Pre-change source checkpoint: `Echo-recovery/C5-20261105T194613Z`. A new verified C6 source archive is saved after final validation. Stop services and compare/preserve later edits before restoring selected source files using the archive manifest. Checkpoints are local source archives, not Git commits; model weights, ignored runtime manifests, environments and private data are excluded. Restoring an older native lock against different native artifacts must fail integrity checks rather than silently use a different backend. The former checkpoint has no activated optional native speech path.
