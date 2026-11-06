> Current selection update (2026-11-06): startup-pinned shared Transformers/PEFT SeaLLMs with exact CBT/PHQ adapters; unchanged CUDA Nano Fast Talk; optional repaired OpenMOSS llama.cpp MOSS v1.5 Expressive Talk. This supersedes older no-startup-load/page-exit-base-unload and active-CBT-GGUF descriptions below. See the current startup/voice guide and STARTUP_EXPRESSIVE_STRESS_2026-11-06 validation report. Browser/hardware/listening and broader acceptance remain unfinished. No new push.

# Buddy CBT with resident llama.cpp

Buddy Chat and Talk now share the same resident CBT worker running the exact mixed_epochs_2-derived Q4_K_M artifact. The existing V3 prompt construction, history/token limits, complete-sentence stopping, quality checks, single rewrite attempt, withholding and internal formatter remain authoritative. The V3 source files and their lock hashes were not edited. Historical policy version names do not select model weights; the adapter/GGUF hashes do.

## Start

Use the existing configured application launcher. For the local JSON model profile, from the Echo repository root:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

Existing account/project configuration remains required. Restart existing services after applying the code. Service startup does not load model weights. Enter Buddy/use the existing preparation controls to load its stack. Interpreter choices are retained; no environment is installed or silently substituted.

Prepare the assets first with `docs/setup/LLAMA_CPP_PREPARATION.md` if they are absent. Runtime inference does not download models or tools and has no native/CPU/alternate-model fallback. The verified artifact, tokenizer/source inventory and official runtime binaries must match `app/buddy/cbt-gguf.lock.json` inside `ai-service`. Runtime inventories are canonically hashed so equivalent JSON ordering is harmless; modified binary bytes still fail validation.

## Lifecycle and transport

The private native server binds an ephemeral port on 127.0.0.1. A fresh API key is passed only through its restricted environment, never command arguments, public API results or a token file. Direct loopback HTTP avoids system proxies and redirects. Web UI is disabled, one inference slot is used, prompt cache RAM is disabled and context shifting/automatic fitting are disabled. Model context stays at 4096 tokens. Full HF-generated prompt token IDs are passed directly; the server does not reapply a chat template or insert another BOS token.

Preparation verifies source/adapter/base integrity, the GGUF and native runtime, CUDA, tokenizer parity and effective sampler settings. It warms with zero generated tokens, then requires 29/29 layer offload, a complete CUDA model buffer and at least 2 GiB driver-wide free GPU memory. HTTP health alone is insufficient. The pinned build classifies native model INFO messages as trace-level output; the parser captures that evidence and discards raw native logs. Only allowlisted residency numbers survive.

Sampling preserves the configured temperature, top-k, top-p and repetition penalty with full-context repetition history. Unconfigured samplers are disabled. The engines use different RNG implementations and numerical kernels; identical text to the former HF/NF4 path is not promised. Runtime identity separately records the exact GGUF, engine and unchanged V3 policy/formatter.

The existing page leases, Stop Talk speech-only release, scheduler eviction and explicit unload operate on the same CBT worker. Closing that worker kills its owned native server. Native-server death exits the disposable worker so existing recovery detects it. Cancellation currently terminates the worker tree; replacement preparation is required before using it again. Status/cancellation deadlines remain controlled by the existing parent transport. The existing final-owner grace queues release at a safe operation boundary; it is not hard preemption of a stalled load at exactly ten seconds.

The native server receives a 25 GB committed-memory ceiling and 60% CPU hard cap through a Windows job. These are server-tree limits, not whole-machine limits. Conversion tooling has its separate existing resident-memory watchdog; the runtime server does not add that watchdog to the rest of Echo. Normal short native server working set observed about 5.4 GB. Global GPU headroom continues to use NVML rather than process-local Torch estimates.

## Explicit synthetic checks

These commands load models intentionally; they do not use account sessions or microphone recordings:

```powershell
.\ai-service\.venv-core\Scripts\python.exe scripts/check-buddy-llama.py --configured --speech
.\ai-service\.venv-core\Scripts\python.exe scripts/check-buddy-llama.py --configured --cancel-recover
```

The first prepares configured CBT/Nano/Whisper and synthesizes the first approved response with the existing sentence schedule. The second checks an explicit numbered-list follow-up plus cancellation and replacement warming. Output contains only approved-reply hashes/counts, quality flags, timings and model/residency metadata. No rejected draft or generated audio file is saved.

Worker check/load/warm took approximately 76–79 seconds in these runs, excluding the runner's interpreter-import preflight. Full source hashing is retained. Subsequent short CBT replies took about 1.2–4.1 seconds, including a two-attempt turn. This is not a real-time browser latency guarantee.

## Known limits

One canonical “List steps that I could do” follow-up was withheld after both attempts failed the existing numbered-step check. A more explicit numbered-list request passed; its next turn exercised the existing retry successfully. The failed case remains recorded rather than weakening V3 or injecting a fallback. Broader generation quality and phrasing reliability still need review; no HF/NF4 comparison was run to attribute the failure.

Real browser/authenticated Chat/Talk, microphone transcription, echo, playback/autoplay, listening quality, journal concurrency and maximum-context/long-speech stress remain unverified in this substage. Whisper was loaded on CPU INT8 but no microphone turn was transcribed. Filipino/Taglish remain experimental. Journal PHQ and the remaining legacy non-Buddy loaders have not been migrated here.

See `docs/validation/BUDDY_LLAMA_CPP_2026-11-05.md` for evidence and remaining acceptance.


Update 2026-11-05: the configured job memory ceiling is now 28,000,000,000 bytes (decimal 28 GB), authorized by the user. CPU remains capped at 60%. Earlier measurements above describe the original 25 GB runs; they are unchanged historical results. Limits apply to the controlled process trees, not total machine usage. Restart existing workers to apply the new ceiling.


Speech transport update (2026-11-05): the coordinated launcher now verifies protected transport authentication before starting the app. Local JSON credentials are ephemeral; the hosted native-runtime.json token is not a valid diagnostic credential for that running profile. Status polling has a separate bounded budget and cannot consume inference admission. Speech preparation remains visible; safe transport/Nano failures retain the approved reply for speech-only retry. See ../validation/LOCAL_SPEECH_TRANSPORT_2026-11-05.md for automated and real-model results and remaining browser limitations.


Native worker isolation (2026-11-05): Journal safety/emotion/PHQ and Buddy CPU safety now use bounded owned workers in the existing core environment. Buddy's CBT remains the pinned llama.cpp backend; PHQ is still HF/PEFT with strict adapted/unadapted validation. Journal/Buddy progress is scoped separately. HTTP transport envelopes include cold-loading retries, while actual model generation retains its own deadlines. See ../validation/NATIVE_WORKER_ISOLATION_2026-11-05.md for exact limits, measured reuse/recovery and remaining acceptance.


Shared base / PHQ candidate: see [qualification status](../validation/SHARED_SEALLMS_2026-11-05.md). Offline setup is `scripts/prepare-shared-seallms.py --build`; it does not change active inference. Normal PHQ remains on the current native worker because the shared candidate failed nullable-agreement comparison. Never point PHQ at the existing CBT-merged GGUF. The diagnostic-only `ECHO_SHARED_SEALLMS_VALIDATE` flag must not be enabled in normal startup.


Shared HF selection follow-through (2026-11-06): current Buddy now uses one Transformers/PEFT NF4 SeaLLMs base with exact mixed_epochs_2 CBT and PHQ adapters. This supersedes earlier statements that current CBT remains llama.cpp. The failed shared llama.cpp candidate remains inactive. Real initial switching matched PHQ coverage 0 and approved two CBT replies on one PID, with Nano headroom above 2 GiB. See ../validation/SHARED_HF_2026-11-06.md for checkpoint, configuration, slower CBT timing, final capped validation and remaining browser/hardware acceptance. No push or environment change.
