# Startup repair and read-only Talk inspection

Pre-edit source checkpoint: `Echo-recovery/C6-20261106T102123Z`.

## Startup changes

The restored text transport allowed 90 seconds for a worker that imports native packages, checks CUDA and hashes 35,512,224,616 bytes across 90 inventoried model files before sending readiness. Both launchers allowed about 100 seconds. Worker stderr was discarded, and errors were replaced with the same initialization-failed message. These are confirmed code findings; the original failure cannot be conclusively attributed to a timeout because its underlying exception was discarded.

The private worker now emits fixed, sanitized import/CUDA/asset-verification stages and terminal startup codes over its existing memory-only protocol. The parent logs only those fixed stages, preserves sanitized startup errors and reports a distinct timeout or unexpected worker exit. No raw traceback, credential, prompt or arbitrary path is forwarded. Existing model hashes are still checked; a longer deadline does not bypass failed integrity or CUDA checks.

The worker initialization bound is now 600 seconds. Both integrated and PowerShell launchers allow 630 seconds, covering service overhead. Integrated startup prints a waiting notice every 15 seconds. Normal inference deadlines and the configured 28 GB/60% resource limits were not changed. Restart the coordinated launcher to apply the repair.

No tests, syntax execution, model loads or browser acceptance were run, following the user's instruction. Static inspection cannot establish successful startup; the next ordinary launch will expose a specific startup error if another failure remains.

## Talk findings — inspected, not modified

- In backend speech delivery, cancellation/generation checks occur before several asynchronous provenance writes, but are missing immediately afterward before segment/end events. An interrupted old turn can therefore reach event construction after a newer turn begins. The completed-reply persistence path also assigns session conversation identity before its post-await current-turn check. These should be fenced before state mutation or event emission.
- The speech-retry catch emits a generic speech-unavailable error without preserving the underlying sanitized cause, unlike the initial-turn error path. Retry failures can hide the useful diagnostic.
- Browser microphone onset requires 15 consecutive high-energy 512-sample frames (about 480 ms). Short words, quiet speech or speech with energy dips may never trigger a turn. This is a sensitivity limitation, not proof that it caused a specific reported utterance failure.
- Nano synthesis validates format, audibility, frame budget and duration; it does not compare spoken words with the approved sentence. A successful generation therefore does not establish pronunciation or word completeness. Filipino/Taglish remain experimental.

Existing positive checks in source include ownership/consent before Talk, approved-text-only synthesis, same CBT provider, ordered segment/packet checks, bounded PCM, microphone suspension during processing/playback, speech-only retry, and cleanup on Stop. Their presence in source is not new runtime acceptance evidence.
