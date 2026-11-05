# PHQ native-loader diagnostic — 2026-11-05

The newest saved local analysis completed with `journalScreening.status=failed` and nullable output. The record does not preserve the underlying PHQ exception. No user's journal was resubmitted, edited or printed.

All seven PHQ adapter/tokenizer/metadata files passed the installed manifest's size and SHA-256 checks. The PHQ tokenizer loaded successfully in the core environment. The current PHQ execution path remains Transformers + PEFT + bitsandbytes NF4, loading the local SeaLLMs base and the separate PHQ adapter. Buddy's Q4_K_M migration does not migrate this path.

Two isolated synthetic diagnostics used the actual CoreRuntime native loader under the existing decimal 25 GB committed-memory job limit, 60% CPU hard cap, and a driver-wide GPU headroom admission check. Both terminated while loading around tensor 209/339 with exit code 3221225477 / 0xC0000005 (Windows access violation), before reaching inference. The second explicitly requested BF16 and low-CPU-memory loading through a diagnostic-only wrapper; it failed similarly.

First run: peak reported job commit 26,569,764,864 bytes; peak sampled resident working set 11,621,269,504 bytes. BF16 run: peak reported commit 26,570,027,008 bytes; sampled resident 11,585,933,312 bytes. These telemetry peaks do not prove an out-of-memory exception: the observed exit is an access violation, and resident physical RAM is different from committed memory. The cap was not raised. No unconstrained comparison was run, so the contribution of the cap versus the native dependency/driver path remains unresolved.

These are concrete load-time failures for the tested resource/runtime profile, not definitive attribution of the saved production job's exception. That job only recorded failed status, and could have failed later in generation/output validation. The previous optional-stage repair preserves other model outputs when a recognized PHQ error occurs; it does not repair this loader or create scores.

No production inference code, model weights/configuration, installed environment, memory/CPU limit, account record or safety/validation policy was changed by this diagnostic. The BF16 override existed only in its isolated test process. Test processes exited and their owned GPU allocations were released; active services were not stopped.

Remaining PHQ work is a bounded runtime migration/repair and real generation validation. It must use the exact separate PHQ adapter and a verified matching base, preserving both adapted and adapter-disabled agreement passes. A CBT-merged GGUF cannot replace the unadapted PHQ-check base. Availability must not be claimed until loading and both validated passes succeed under the resource limits.


## Authorized 28 GB retry — 2026-11-05

Raised the existing controlled-job memory ceilings to 28,000,000,000 bytes; CPU remains 60%. No environments or weights changed. Both resource-control implementations, the native Buddy server request, conversion admission/reporting and their tests now agree. These controls apply to their owned trees, not all machine RAM or all Echo processes combined.

The same isolated native PHQ loader and synthetic inference completed with exit 0. Load: 15.797 seconds. Global GPU free after load: 9,658,630,144 bytes. Peak committed: 26,569,199,616 bytes; peak sampled working set: 16,156,876,800 bytes. Inference status available, coverage 0 (no supported symptom items in synthetic text). This demonstrates successful loading/execution under the higher ceiling; it does not establish scoring accuracy or rewrite previous jobs. It supports a resource-limit explanation for the controlled 25 GB failures; the exact older production-job exception remains unknown.

Validation: 34 affected resource-limit/Buddy llama tests passed, git diff --check passed. Pytest reported a cache-directory permission warning only. Existing workers need restart for changed settings. Authenticated journal UI acceptance has not been rerun. PHQ remains on its existing native HF/PEFT backend; its llama.cpp migration is not part of this change.
