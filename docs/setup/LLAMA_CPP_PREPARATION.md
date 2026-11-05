# Pinned llama.cpp preparation

This is explicit local setup, not application startup. Echo still uses its existing native inference path. The exact mixed_epochs_2 BF16 and Q4_K_M artifacts have been generated and checked locally; neither is connected to application inference yet.

## Verified tooling

- Official repository: https://github.com/ggml-org/llama.cpp
- Release: `b12110`; commit: `cd959bae99ff4bed22bef2604f45241c09bbb8c8`.
- CUDA 12.4 Windows x64 binary and CUDA runtime archives are SHA-256 pinned in `scripts/llama-runtime.lock.json`.
- The source archive is pinned separately. Converter source and its upstream MIT license are retained together under the ignored model root.
- Model assets, downloaded code and executables are ignored by Git. Only setup code, the public revision/checksum lock and documentation belong in source control.

From the Echo repository root, explicit setup is:

```powershell
.\ai-service\.venv-core\Scripts\python.exe scripts/install-llama-runtime.py --download
.\ai-service\.venv-core\Scripts\python.exe scripts/install-llama-runtime.py --source --download
```

Omit `--download` to verify an existing installation offline. `--source` selects converter source; without it the command selects binaries. Neither command loads model weights, starts a service or switches inference providers. Missing/corrupt assets fail rather than selecting another release. An unverified pre-existing destination is preserved for inspection.

Archives are verified before extraction; traversal and symlink members are rejected. Source files are compared against the pinned archive on reuse, including rejection of unexpected files. Keep `PYTHONDONTWRITEBYTECODE=1` in converter child environments so runtime bytecode does not contaminate the verified source inventory. Setup does not install Python packages or change existing environments.

## Validation performed

The installed server reports build 12110 / commit cd959bae9. Its device-list probe detects the NVIDIA GeForce RTX 5070 Ti. This is a CUDA discovery check, not successful model inference or measured co-residency.

The pinned converter's `--help` succeeds using the existing core interpreter. Its upstream requirement profile specifies Torch 2.11.0; the existing environment differs. CLI import success is not conversion compatibility approval, and dependencies have not been changed.

## Remaining model work

1. Verify the bundled base, tokenizer/template and exact mixed_epochs_2 adapter against the model inventory before conversion. Preserve adapter bytes and provenance.
2. Produce a high-precision merged CBT artifact in an isolated staging area, validating adapter application and output before activation. Do not activate an unadapted base export.
3. Convert that verified artifact to F16/BF16 GGUF, validate it, then use the separate `llama-quantize` executable for Q4_K_M. Q4_K_M is not an HF converter `--outtype`.
4. Verify PHQ's declared base independently. The currently inspected original base directory lacks configuration/tokenizer assets; do not infer full identity from its name or silently replace it with Buddy's base.
5. Compare tokenizer/template behavior, approved generation/withholding and formatter behavior before connecting either GGUF to the application. Existing V3 policy and internal formatting remain authoritative.
6. Implement worker lifecycle, cancellation, scheduling and real memory/latency checks; retain rollback until acceptance passes.

Allow space for staged merged weights, high-precision GGUF, quantized output and verification overhead. Check available RAM and disk again immediately before conversion. Existing tools occupy additional disk space but no resident model memory.

No real CBT/PHQ GGUF conversion, model loading, browser conversation or listening review is established by this tooling milestone.

## Exact CBT conversion command

The offline converter pipeline is `scripts/prepare-cbt-gguf.py`. It verifies the selected source files against Echo's model inventory and additionally pins the exact adapter weights/configuration. It rejects unexpected base shards and does not load from external model folders.

```powershell
# Hash and resource preflight only:
.\ai-service\.venv-core\Scripts\python.exe scripts/prepare-cbt-gguf.py

# Explicit CPU merge, BF16 export and Q4_K_M quantization:
.\ai-service\.venv-core\Scripts\python.exe scripts/prepare-cbt-gguf.py --build
```

The build is offline and excludes GPU use. It uses existing installed packages without changing them. Free RAM must cover base-weight bytes plus 6 GiB; free disk must cover three times base bytes plus 4 GiB. These conservative admission estimates cannot guarantee protection against unrelated applications consuming memory later.

The active conversion path merges one safetensors shard at a time. Each plain-LoRA update is computed as FP32 B@A times alpha/r, added to the FP32 base weight, then stored as BF16. Every saved tensor is hashed against its computed value; unknown/unused adapter keys and unsupported variants fail. Tiny-model tests compare the results against PEFT's FP32 safe merge.

A fixed benign final-token probe compares original and merged weights using FP32 arithmetic, temporarily promoting only the executing module's weights. An embedding lookup casts only its result, avoiding a full FP32 vocabulary allocation. Tests compare this streamed arithmetic against a fully FP32 tiny model and ensure temporary weights restore on failure. The maximum absolute logit tolerance remains 0.5. These are merge correctness/smoke checks, not response-quality acceptance.

Merge, original probe and merged probe execute in separate capped children, releasing their native allocations before the next stage. Adapter-tokenizer text and token-ID rendering must match after serialization. Both GGUFs must retain the chat template, Qwen2 architecture and equal tensor counts; Q4_K tensors must be present in the quantized artifact. Qwen2 is the architecture inside SeaLLMs-v3-7B-Chat, not a substitute base.

Outputs remain under `models/llama/artifacts/cbt-mixed-epochs-2-q4_k_m` and are not connected to application inference by this command. The final manifest includes source identity, adapter hashes, tool commit, dependencies, validation measurements and output hashes. It is published only after conversion checks finish. Keep the staged merged weights and BF16 GGUF until comparison and runtime acceptance are complete.

Verified per-shard progress permits resume after interruption and is checked against source/output hashes. A verified final merge receipt permits reuse after later conversion failure. Unverified committed shards are preserved and refuse automatic overwrite. Incomplete application-owned .writing files may be replaced during a verified stage retry and are never promoted without validation. A single-writer lease prevents concurrent conversions. If a process is killed, confirm the recorded PID has exited before manually removing its conversion lock; never delete an active owner's lock. Inspect and preserve partial outputs before any recovery.

All preparation tests use synthetic data; the tiny Qwen2/PEFT test is separate from the selected production model. Real-model conversion and runtime acceptance must be recorded separately.

## Conversion resource budget

Every conversion/preflight command now starts a Windows-job-controlled worker before source checks or ML imports. Its entire child tree shares a 60% CPU hard cap and a 25,000,000,000-byte (decimal 25 GB) committed-memory limit. Workers verify membership and the actual configured limits before proceeding. If Windows cannot enforce them, execution fails instead of continuing unrestricted. This covers conversion, the HF converter and quantizer, not other applications or Echo inference services.

Windows job memory accounting limits committed memory, which is different from resident physical RAM. A second watchdog samples the owned process tree's aggregate working set every 100 ms, conservatively counts shared pages and terminates the tree at the 25 GB threshold. Brief sampling-interval overshoot is possible; the resident-memory watchdog is not an instantaneous physical-RAM reservation. Whole-machine RAM/CPU includes unrelated applications and Windows.

The supervisor starts its child suspended, attaches the job before Python can spawn further workers, then resumes it. Children inherit the limits. Closing the controller/job kills remaining owned children. No global power settings, processor settings or Python environments are modified.

Microsoft references: [CPU hard caps](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information) and [job committed-memory accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information).

## Completed CBT artifact preparation (2026-11-05)

The real shard-based merge and conversion completed successfully. Outputs are `cbt-mixed-epochs-2-bf16.gguf` (15,237,851,104 bytes) and `cbt-mixed-epochs-2-q4_k_m.gguf` (4,683,071,456 bytes), beside their provenance manifest under the artifact directory. Both retain 339 tensors, Qwen2 architecture and the copied adapter chat template. Q4_K_M file type is 15, EOS is 151645, BOS and padding are 151643.

The streamed-FP32 reference comparison observed maximum absolute logit difference 0.03273296356201172 (threshold 0.5), mean 0.004800557624548674 and matching leading token. This compares original and merged HF weights using matched FP32 arithmetic; it is not directly comparable to the earlier BF16-arithmetic diagnostic and does not measure GGUF generation quality. The original/merged tokenizer input and template hashes agree. Every saved shard tensor was checked.

Peak sampled resident process-tree usage was 18,131,210,240 bytes; peak job committed memory was 20,746,113,024 bytes. The 25 GB budget and 60% CPU hard cap remained configured. Quantizer-reported time was 107.892 seconds. CPU utilization was controlled by Windows, not independently benchmarked as a percentage.

Installed conversion versions were Torch 2.12.0+cu130, Transformers 5.5.0, PEFT 0.21.0 and safetensors 0.8.0. They were not installed or modified by this work. This records a successful conversion profile, not acceptance of all runtime inference behavior.

See `docs/validation/CBT_GGUF_PREPARATION_2026-11-05.md` for hashes, test scope and remaining acceptance. The earlier checklist describes required gates; CBT source/merge/conversion gates are now complete for this artifact. PHQ base verification, llama.cpp provider integration, tokenizer/runtime parity, V3 approval/withholding regressions on the new engine and browser/audio acceptance remain unfinished.


Update 2026-11-05: the configured job memory ceiling is now 28,000,000,000 bytes (decimal 28 GB), authorized by the user. CPU remains capped at 60%. Earlier measurements above describe the original 25 GB runs; they are unchanged historical results. Limits apply to the controlled process trees, not total machine usage. Restart existing workers to apply the new ceiling.
