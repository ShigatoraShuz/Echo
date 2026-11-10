# Voice cleanup and validation — November 10, 2026

## MMS retirement

Removed the legacy MMS Talk runtime, Whisper/MMS worker, its dedicated tests, unused environment freeze, and MMS asset downloader. Disabled Buddy now returns a clear unavailable response instead of selecting a legacy voice. Kept current Talk ownership, cancellation, safety, and authentication tests. Historical Talk notes are labeled as retired implementation records.

The downloader's still-needed browser VAD preparation is retained separately as `scripts/prepare-buddy-vad.mjs`, with paths corrected for this checkout. Current microphone detection assets remain in place. No UI layout, music, navigation optimization, or AI journal result features were removed.

## Main voice: MOSS Nano

- Default Fast voice remains MOSS-TTS-Nano with the existing reference and generation settings.
- Real isolated two-turn Nano/Whisper probe passed: 48 kHz stereo, non-silent finite PCM, 100% expected-word coverage on both synthetic samples, same Nano worker PID.
- Cold model check: 26.72 seconds. Sample synthesis: 4.68 and 4.66 seconds; output durations 3.36 and 4.00 seconds. These are this machine's observations, not latency guarantees.
- Actual signed-in private Tailscale Buddy chat returned the labeled synthetic response. Two initial Speak requests and one final post-restart Speak request delivered audio successfully (`GET /buddy/voice/jobs/:id/result` HTTP 200); UI returned without an error.
- No physical microphone or human listening-quality review was performed.

## Optional expressive voice: MOSS v1.5

The initial installation was absent. After free C: storage increased from 13.3 to about 215 GiB, official Microsoft C++ Build Tools 2022 and the needed CUDA 13.0 compiler/runtime components were installed; no display-driver installation or automatic reboot was requested.

Pinned native source built successfully within the existing 60% CPU / 28 GB process limits. Setup fixes explicitly locate the CUDA toolkit, package required CUDA runtime DLLs, use resumable verified HTTP downloads, and publish conversion outputs only after successful conversion. The expressive adapter now uses the configured Nano voice-reference root instead of a hardcoded checkout path. Missing assets produce a clear instruction to select Fast / MOSS Nano, retaining the approved answer.

The backbone conversion completed: 15.82 GiB F16 to 4.84 GiB Q4_K_M (120.69 seconds quantization on this machine). Codec conversion and real inference qualification also passed. Both voices keep the original reference hash.

The initial shared-residency check correctly rejected insufficient capacity. The native-only MOSS wrapper no longer imports Torch or creates an otherwise-unused CUDA context just to query memory; it uses NVML directly, with a single-physical-GPU guard for unambiguous device selection. The shared HF loader also releases inactive allocator cache after loading. All parameters and adapters remain resident; full native GPU offload and the 2 GiB guard remain enforced.

Final full private-IPC test with the real shared Buddy base and expressive voice passed:

- Shared base preload: 33.53 seconds; expressive warm-up: 34.36 seconds.
- Speech plus Whisper consistency: 21.73 seconds for 3.68 seconds of audio; 100% expected-word coverage.
- Minimum sampled free GPU memory: 2.86 GiB.
- During native speech, 67 control/heartbeat checks remained responsive; maximum observed duration 21.2 ms.
- The same shared-base PID survived speech, Stop and page release; explicit unload released it. All test workers were cleaned up.
- Normal inference qualification is enabled only for this exact verified native manifest. Human listening review and physical microphone capture remain unverified.

## Automated checks

- Final speech/loading/auth/shared-model/setup regressions: **127 passed**. Includes resumable ranges, corrupt/truncated-file rejection, native memory guards, and shared-worker ownership.
- Frontend voice controls/error mapping: 12 passed.
- Type checks and full frontend lint passed; optimized private frontend rebuilt successfully.
- Localhost and private Tailscale readiness HTTP 200 after the independent launcher restart.

Model assets, build trees, environments, credentials and synthetic test artifacts are not part of the source commit.
