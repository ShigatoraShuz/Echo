# Buddy Nano integration validation - 2026-11-03

## Baseline and scope

Verified main: `bc429205dd84148ec5d9cd2e0a8b04b795503738`. Local branch: `buddy-integration`. Repository: `E:\Python Project\CODEX\Echo`. No push or merge performed.

Source changes cover Buddy workers/provider/UI, the versioned protected Talk transport, shared contracts, private GPU scheduler/lifecycle hooks, tests, and startup/documentation. Existing journal, PHQ-8, emotion, account/verification policies, and support resources remain unchanged. Main's support routing precedes ordinary Buddy generation. No weights, environments, recordings, credentials, or private histories are included. The pre-existing package-lock changes were preserved.

## Installation retry

Installed the exact `ai-service/requirements-core-windows.lock` into the isolated ignored `ai-service/.venv-core`. The large Torch download required a longer transfer timeout; the official wheel was checked against SHA-256 `24e75a0c3ea4243067d7560955f2eef6466e9365de7dd4a3a4b8693c9ac4bccf` before installation. Torch 2.12.0+cu130 and Transformers 5.5.0 are installed. `pip check` reports no broken requirements, and a real CUDA kernel returned the expected result. Existing CBT/Nano/Whisper environments were not modified.

The previous CBT DLL denial is specific to restricted execution: imports and inference succeed in the authorized Windows context. No ACL change or alternate environment was used.

Real probes exposed a native import stall when the worker started its stdin reader thread before NumPy/Torch. Model workers now initialize and read requests synchronously; owned Windows jobs retain descendant cleanup. A real subprocess regression test exercises numeric imports through the worker entry point.

The shared installed manifest references obsolete CBT v5 inference sources. The mandatory Buddy provider validates its adopted, byte-identical V3 source inventory instead of those unused vendor CBT entries. All non-Buddy source checks and shared model/base integrity checks remain enforced; shared manifests and weights are unchanged.

## Automated checks

- Focused Buddy/Python/V3/private-transport suite: **75 passed**. Covers identity, provider parity, screening, withholding/retry/formatting, context, cancellation, owned subprocesses, numeric imports, reference corruption, sentence schedule/coverage, global headroom, and transport restrictions.
- Final protected Talk and real-browser synthetic harness: **19 passed**, including repeated automatic turns, one microphone request, capture suspension, stereo sentence playback, blocked autoplay/Play, approved-text speech retry, interrupt, Stop, stale events, logout cleanup, microphone denial, and reduced motion.
- Final sanitized Next production build passed compilation, TypeScript, and all 22 static pages. No private environment files were copied.
- Earlier full frontend suite: 192 files / 1,266 tests passed. Broad backend: 1,077 passed; one proxy-related loopback failure passed on focused rerun, four optional tests skipped.
- Exact adapter/configuration, Nano/codec inventory, generated voice hash, and byte-identical copied V3 source verified.

The full installed-core Python suite is not green: **236 passed, 33 failed, 5 skipped**. Two failures require speech-only dependencies (`av`/`faster_whisper`) intentionally absent from core. Other failures concern legacy research/tokenizer/runtime fixtures. A prior same-environment comparison reproduced all 31 remaining legacy failure identities on untouched main. This comparison does not certify the broad suite in the newly installed environment.

## Real model checks

A two-turn service-component test passed with real Whisper, exact mixed_epochs_2 CBT/V3, and Nano. Synthetic spoken inputs asked about schoolwork and then asked for steps. Whisper recognized both; V3 approved the complete formatted replies, and all prepared text was synthesized in order. Worker identities remained stable across both turns. This is component validation, not an authenticated full-application microphone test.

| Measurement | Turn 1 | Turn 2 |
| --- | ---: | ---: |
| Transcription | 7.74 s | 7.35 s |
| CBT generation/approval | 47.55 s | 47.57 s |
| First speech segment ready | 5.07 s | 8.98 s |
| Total synthesis | 35.66 s | 28.80 s |
| Sentence batches | [1,1,3,3,1] | [1,1,3,3] |

Cold warm-up was 127.27 s. These timings exclude browser acoustic playback and are observations on this machine, not latency guarantees.

Actual device inspection confirmed CBT parameters, Nano parameters, the separate codec, and cached reference codes on `cuda:0`; Whisper remained CPU INT8. The final residency rerun passed with the global NVML guard active: worker identities stayed unchanged after CBT and Nano operations, and warm-up reported 8,297,209,856 free bytes. Independent global nvidia-smi sampling recorded a minimum 7,913 MiB free (~7.73 GiB), with 8,083 MiB peak usage. Final cold load/warm-up took 133.12 s. Process-local CUDA free counters disagreed between workers, so the final guard uses direct global NVML measurements with no process-local fallback.

All generated output checks used 48 kHz stereo and the original reference hash `3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f`. No new voice was generated. Probe input/output audio stayed in memory; ignored local reports contain only synthetic test dialogue and measurements.

## Remaining acceptance work

Listening quality, speech completeness by human review, voice consistency across languages, physical microphone capture/echo, and authenticated full-application account/navigation flows remain unverified. Browser behavior was exercised with synthetic capture and stubbed models. Maximum-context CBT and long-reply GPU stress remain pending. Filipino/Taglish remain experimental and unsupported/unverified.

The integration is installed and has passed real multi-turn component and GPU-residency checks. It is not yet certified for all end-to-end acceptance criteria. Start instructions are in [Buddy integration](buddy-nano-integration.md).
