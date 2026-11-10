# Buddy voice latency validation — 2026-11-11

## Scope

Improve Talk responsiveness without changing model weights, GPU quantization, existing UI, typed Chat prompts, PHQ inference, journal recommendations, conversation persistence, authorization, consent or safety approval. Physical microphone testing was explicitly deferred by the user.

## Changes

- Prime the shared Transformers/PEFT CBT model with a two-token, greedy synthetic readiness pass. This moves first-generation kernel setup into model readiness; it does not eliminate cold startup.
- Pass an explicit `deliveryMode: voice` only from live Talk. Ordinary spoken answers use the existing brief response target and stop at complete sentence boundaries. Nothing is truncated after approval. Detailed/professional requests retain longer responses; explicit spoken step requests are recognized and a requested count of two to six steps is checked before delivery. Rejected drafts still require the existing context-preserving rewrite or remain withheld.
- Keep short speech introductions with their following sentence so Nano receives useful context rather than a standalone “Sure!”. Every prepared character remains covered by the speech groups.
- Accept unambiguous generated duration ranges, such as “15–20 minutes”, in spoken preparation. Original strict preparation remains the default; dates, currency, signed values and reversed ranges remain rejected.
- Recognize short utterances after 192 ms of continuous audible input, retaining pre-roll. Endpoint after 768 ms silence instead of 1,024 ms; shorter pauses reset correctly. Interim transcription remains available, at four-second intervals instead of two, reducing duplicate work competing with final transcription.
- Persist `spoken-v1` delivery provenance. Both Chat and Talk use the same CBT adapter and the existing approved-output boundary. No raw token streaming or alternate fallback model was introduced.

## Measurements

Labeled synthetic English audio passes through real Whisper, CBT and Nano. The final probe uses the running app’s authenticated loopback model API. It writes no account history and closes its temporary model reservation afterwards.

| Conversational case | Before, isolated IPC | After, running server |
| --- | ---: | ---: |
| Transcription | 4.08 s | 3.95 s |
| Approved response generation | 19.62 s | 3.01 s |
| First speech synthesis | 3.11 s | 3.50 s |
| Processing until first audio | 26.83 s | 10.49 s |
| Approved answer length | 109 words | 32 words |
| Full spoken-word set coverage versus approved speech text | Not measured | 100% |

This is one controlled conversational case, not a universal latency guarantee. The gain combines warming first-generation work before readiness with a shorter conversational answer; the responses are intentionally different lengths. Browser endpointing, network, user authorization and database persistence are excluded from these model timings. Initial readiness still takes time: the running-server cold Talk preparation measured 96.8 seconds in this run. This is not ChatGPT-style full-duplex streaming.

The final running-server detailed case generated all three requested steps (152 words), successfully normalized and spoke the “15–20 minutes” range, and produced first audio after 17.95 seconds. The speech groups covered 100% of prepared text; Whisper recovered 91.3% of distinct expected words from the synthesized segments, versus 100% in the conversational case. This automatic check is not proof of perfect speech fidelity; physical listening/quality review is still pending. It is not a comparable speed benchmark against the original 100-word answer, which only supplied two of the three requested steps.

The first final probe exposed a real preparation failure on a three-step answer containing “15–20 minutes”; the duration-range normalization above fixes that exact case. Earlier intermediate probes that shortened step requests were rejected during development, not used as final validation.

## Checks

- 131 Buddy/Talk/Nano/MOSS Python tests passed; one optional test skipped.
- 14 frontend microphone lifecycle/endpointing tests passed, using browser API doubles.
- 25 backend WebSocket/hosted-history tests passed, including approved-only audio, cancellation, stored text, shared context and explicit voice profile routing.
- Ten direct original-versus-current default Chat prompt comparisons passed.
- Frontend/backend type checking passed; lint had zero errors (existing warnings remain).
- Production frontend rebuilt by the standard private launcher.
- Localhost and private Tailscale readiness endpoints returned HTTP 200.
- Tailscale login page rendered. The prior user session expired; authenticated UI and physical microphone checks remain pending a new login and the user’s availability. No camera/microphone permission or verification checks were bypassed.

## Evidence

- `artifacts/voice-latency/before.json` — original timings.
- `artifacts/voice-latency/running-server.json` — completed final live model API probe (both cases passed).
- `artifacts/voice-latency/running-server-test.log` — detailed final output, including any failure.
- `artifacts/voice-latency/regression.log`, `typecheck.log`, `lint.log` — automated checks.
- `ai-service/tests/benchmark_voice_turn.py` — repeatable explicit synthetic probe; optional `ECHO_BENCH_URL=http://127.0.0.1:8002` reuses the running server rather than launching competing GPU models.
