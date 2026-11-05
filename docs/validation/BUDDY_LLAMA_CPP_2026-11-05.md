# Buddy llama.cpp provider validation — 2026-11-05

Scope: the existing integration branch; shared Buddy Chat/Talk CBT execution. No UI, access policy, journal model, environment, weight, account history or database migration changes. This is a component integration milestone, not full application acceptance.

## Implementation

- The resident CBT worker now uses the prepared mixed_epochs_2-derived Q4_K_M GGUF through an owned private llama.cpp server. Both Chat and Talk retain the same `BuddyRuntime.generate` boundary and safety screening before ordinary generation.
- Exact adapter SHA: `6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e`; GGUF SHA: `04bade07fd81c4a116eb8f2b62da4ad0bb28b74bb15d2ed85e3a9cf70f6d4bb6`; engine `llama-cpp-b12110-q4km-v1`; upstream commit `cd959bae99ff4bed22bef2604f45241c09bbb8c8`.
- Canonical source/runtime inventory hashes and per-file byte hashes prevent another adapter/tokenizer/runtime being selected silently. No runtime downloads or native/CPU fallback.
- V3 execution/formatting files remain unchanged. A minimal generate bridge passes their exact prompt IDs, generation limits, seed and sampling parameters, invokes their completion stopper and returns token IDs to the original approval/rewrite/formatting path. Only approved replies leave the worker. Engine numerical/RNG differences mean output text is not guaranteed identical to HF/NF4.
- One authenticated loopback slot, random per-worker key in environment only, Web UI off, no proxy/redirect handling, no prompt-cache RAM, no context fitting/shifting, no payload/audio files. Raw native logs are discarded; only offload/buffer measurements are retained.
- GPU residency requires post-warm evidence, not HTTP health: 29/29 layers and CUDA model buffer approximately 4,677,120,819 bytes, matching the 4,677,120,000-byte model tensor inventory within log precision. Global headroom checks retain the 2 GiB minimum. A Windows job caps the server tree at decimal 25 GB committed memory and 60% CPU. These are not whole-machine or aggregate-all-Echo limits.
- Native-server loss terminates its disposable Python worker. Parent cancellation closes the owned process tree; an unhealthy worker must be warmed again. Stop Talk/page ownership/scheduler mechanisms remain the existing implementation.

## Automated validation

**158 tests passed** across Buddy bridge/integration/lifecycle, V3 regression, text transport, loading/native loading, Journal lifecycle/priority and resident face suites. Tests include wrong/corrupt model/tokenizer/runtime identities, inventory traversal, equivalent inventory ordering, private HTTP redirect refusal, ordered token handling, full-context bounds, completion callbacks, stream failure isolation, slot draining, native server loss and actual Windows resource-limit queries. Existing support-before-generation, withholding and Chat/Talk context parity regressions pass.

Shared-contract and backend TypeScript builds passed. Affected source diff checks passed. No frontend source changed; frontend production build/browser tests were not run in this substage. The remaining Python warning concerns the installed Starlette/httpx deprecated test-client integration.

## Real configured model checks

All configured CBT/Nano/Whisper interpreters passed import preflight without environment modification. Actual model checks used the configured CBT interpreter as well as an initial core-interpreter probe.

| Check | Observed result |
| --- | --- |
| CBT check/load/warm | 76–79 seconds, excluding runner import preflight; includes source/runtime hashing |
| Ordinary three-turn CBT run | Approved on first attempts; about 2.83, 1.67 and 1.20 seconds; stable worker/native PIDs |
| Explicit numbered-list run | Approved replies in 2.72, 1.50 and 4.03 seconds; second reply had three numbered steps; third passed the existing second attempt |
| Context | Prior approved history passed across turns; no history reductions in these short examples |
| CBT residency | 29/29 GPU layers, complete CUDA model buffer; same Python/native PIDs across ordinary turns |
| Nano residency | TTS and codec parameters on CUDA; cached reference codes on CUDA; original voice SHA `3842d142fe4570197a059261467b806ccc36d2d35d4044255dc0d224be03a08f` |
| Whisper residency | CPU, requested INT8; actual CTranslate2 compute string `int8_float32` |
| Approved speech | Six segments, batch sizes `[1,1,3,1]`; all prepared text submitted in order; 5,145,600 PCM bytes, 48 kHz stereo, about 26.8 seconds audio; synthesis about 29.98 seconds |
| Co-resident global memory | About 9,715,843,072 bytes free after speech and further CBT turns; above 2 GiB minimum |
| Cancellation/recovery | Cancellation observed; old Python/native process exit verified before replacement; new worker/server warmed and produced another approved reply in about 2.92 seconds |
| Cleanup | Temporary test workers/native servers were closed after checks; no inference services were left resident by the probes |

The speech run loaded CBT first, then Nano/codec/reference and CPU Whisper. They remained resident together while CBT and speech ran sequentially. Nano synthesis used approved text and the existing sentence/preparation utilities. No recording or audio output file was retained. First-segment/browser playback latency was not measured.

Cold-load offload verification initially failed because the pinned server reports native model INFO at trace verbosity. Startup-only diagnostics identified this; trace evidence capture fixed the false mismatch. No partial offload/CPU substitution was accepted. Warm-up now also validates effective sampler settings and actual 4096-token context.

## Withholding and quality limitation

The shorter canonical follow-up “List steps that I could do” was withheld after both V3 attempts reported `requested_step_list_missing`. Its drafts never reached history/speech and were not logged. A more explicit numbered-list request passed, and a subsequent turn exercised the original retry successfully. The original case is **not** counted as a passing response test. No baseline HF/NF4 run was performed, so this result does not establish that quantization alone caused the failure. The frozen V3 role parser also does not recognize every phrase with number modifiers; it was preserved rather than silently changing policy.

This remains a response-quality/phrasing limitation requiring review. Checks, retry limits and content-preserving formatting were not relaxed. No fabricated response or unapproved draft was delivered.

## Still unfinished

- Authenticated browser Chat/Talk parity, three actual microphone turns and Whisper transcription quality.
- Browser playback, blocked autoplay, avatar, navigation/logout/multi-tab ownership and physical listening/echo checks.
- Maximum-context and long-speech stress with measured global GPU headroom.
- Real journal work queued during Talk and application-level release/recovery scheduling.
- Filipino/Taglish response and voice consistency review; both remain experimental.
- PHQ base identity, PHQ GGUF conversion and any remaining non-Buddy legacy loader migration.
- Earlier full-plan items such as hard ten-second preemption of a stalled load and broader application acceptance remain tracked separately.

Run using the existing startup configuration in `docs/setup/BUDDY_LLAMA_CPP.md`. Source rollback uses the next verified C6 archive under `E:/Python Project/CODEX/Echo-recovery`; archives do not include ignored models/credentials and are not Git commits. No push, merge or deployment occurred.

Final identity recheck passed against the actual assets without loading models. V3 policy hashes remain unchanged; canonical runtime-inventory SHA-256 is `e27e105fb35d6038ae7d19c6e9886384359027e9bb016264ad830328f13592e9`. Source comparison against the C5 archive found modifications only in Buddy config/job/process/worker and the lifecycle status document, plus the six new provider/test/setup/report/check-script files. Unrelated existing source changes were preserved.
