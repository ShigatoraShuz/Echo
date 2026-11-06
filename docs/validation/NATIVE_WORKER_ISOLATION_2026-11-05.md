# C4: native model worker isolation — 2026-11-05

## Implemented

Active text-memory mode now keeps Journal safety/XLM-R, emotion/E4-C and PHQ in separate persistent owned subprocesses. Buddy's existing CPU safety screening is also isolated. Shared controller/context and other healthy component workers survive a component load or inference failure. Startup does not instantiate these component workers or load their weights; page preparation and authorized inference trigger them.

Workers run the same local model loaders, inference functions, calibration, tokenization, PHQ adapted/adapter-disabled agreement and output checks. They use the current core interpreter and verified local bundle; no environments, weights, adapter identities, prompts, thresholds, retry-on-generation policy, reference audio or database policies changed. PHQ remains the native HF/PEFT/bitsandbytes path, not a llama.cpp migration. GPU Journal models remain on GPU; Buddy safety remains CPU inference, including its existing initial CUDA-to-CPU movement. No device/model fallback or inference-time download.

Each child verifies all manifest-listed files used by its selected component, including the actual cbt/base files for PHQ, before loading. The parent still verifies the complete bundle at transport startup; source-policy/inference-code checks remain. This avoids rehashing unrelated multi-gigabyte assets in every new child. Missing/corrupt owned assets fail closed. Fixed component/task selection, request IDs, bounded NDJSON and sanitized codes carry only in-memory inputs/results. No prompts, rejected drafts or clinical text are logged or passed on argv. Child environments exclude service/database credentials. Request data is cleared after each worker result.

## Timing, cancellation and ownership

- Safety/emotion: 180 seconds per loading attempt. PHQ: 600 seconds. Five total transient loading attempts, 2/5/10/20-second backoff, worker cleanup before retry. Permanent asset/dependency/access/CUDA failures fail directly. Capacity waiting and cancellation do not consume manual generation retries.
- Actual Journal inference retains its configured deadline (270 seconds by default); Buddy CPU safety and CBT worker inference retain their existing 600-second bounds. Loading retries never replay inference automatically. Ordinary failure removes only the affected worker from residency; a later authorized request may prepare a replacement.
- Owned Windows jobs enforce decimal 28 GB committed-memory and 60% CPU ceilings per component tree, not whole-machine or all-Echo aggregate quotas. Existing global GPU admission and 2 GiB reserve remain. Journal stages cannot evict leased healthy CBT; insufficient capacity waits. Metrics now report driver-wide NVML memory rather than process-local Torch free memory.
- Parent wire and backend HTTP windows include cold loading/retry/cleanup plus inference. Native transport envelopes: safety/emotion 1,317 s, PHQ 3,417 s, Journal entry including face 2,034 s, combined analysis 6,600 s. Chat/support-check transports also admit cold CPU-safety recovery within 6,600 s while actual model generation remains independently bounded. These are worst-case windows, not expected latency or permission to extend model generation. OS launch/teardown overhead and hard GPU/driver faults are not instantaneous-preemption guarantees.
- Request-ID cancellation reaches the component worker supervisor, which terminates its owned process tree. Remaining owners, grace periods and saved-job stage fences remain. Final-page exit during an already-running saved analysis still follows that job's existing safe-stage behavior unless its request has a cancellation signal; this does not claim every job is instantly interruptible at ten seconds.
- Model progress adds emotion/phq and sanitized NATIVE codes. Journal progress uses its own protected status endpoint/cache and cannot overwrite Buddy's status. The Journal lease is rechecked after the status await. No public required fields or Talk audio protocol fields were changed.

## Automated validation

136 Python tests passed across native process fault/recovery, loading policies, Buddy/Journal lifecycle, text transport, request limiting, face cancellation and optional PHQ failure. Fault tests kill stalled owned workers, check all five retries and cleanup order, preserve healthy peers, verify cancellation, reloading only a lost component, explicit CPU screening acknowledgement, no inference replay, model integrity scopes, configured inference bounds, driver-wide metrics and fail-closed output errors.

78 backend tests passed across model loading/status, Journal leases, CoreClient, shared leases, Talk and face. 29 frontend Buddy view/loading/Talk tests passed. Shared-contract build, backend build, frontend type check and git diff --check passed. Existing Vite/Starlette warnings remain. Early synthetic script-quoting and inactive-progress fixture issues were corrected before this final run; no model packages were installed to satisfy tests.

## Installed-model checks

Two successive inferences per worker reused the same PID, and every worker exited on close. Fixed synthetic text only; no accounts, microphone or private journal records.

| Component | Final cold load | Two inference calls | Post-warm global GPU free |
|---|---:|---:|---:|
| Journal safety GPU | 11.626 s | 0.328 s | 14,769,504,256 B |
| Emotion GPU | 9.851 s | 0.345 s | 14,505,263,104 B |
| PHQ GPU | 28.687 s | 17.054 s | 9,684,172,800 B |
| Buddy safety CPU | 12.704 s | 0.085 s | 15,940,304,896 B |

An initial full-bundle-per-child implementation measured roughly 80–91-second loads; component-scoped verification above retained integrity and reduced redundant hashing. Measurements are from this machine/session, not performance guarantees.

## Complete private Journal pipeline

Created an isolated TextRuntime using the real shared-controller IPC, authorized a synthetic owner hash, then ran four requests without account-storage writes. Parent transport startup/whole-bundle checks took 77.465 s; no component weights were loaded until Journal preparation. All four results used echo-journal-analysis-v3 and retained eight emotions.

| Request | PHQ status | Time | Load counts safety/emotion/PHQ |
|---|---|---:|---|
| First fixed synthetic text | available, coverage 0 | 48.005 s | 1 / 1 / 1 |
| Same text again | available, coverage 0 | 7.958 s | 1 / 1 / 1 |
| Different synthetic text | failed, no score fabricated | 8.631 s | 1 / 1 / 1; failed PHQ removed |
| Original text after failure | available, coverage 0 | 40.721 s | 1 / 1 / 2 |

Safety/emotion remained resident through PHQ failure/recovery. Driver-wide free memory with all three healthy was 6,038,687,744 B (about 5.6 GiB), above the 2 GiB reserve. Journal unload then returned an empty resident list and shutdown closed the probe controller/workers. No private records were resubmitted or rewritten.

A separate probe confirmed the different text fails with NATIVE_PHQ_OUTPUT_INVALID and the failed worker exits. This is a real remaining output-quality limitation of the unchanged strict PHQ policy; it is not a load failure, valid zero estimate, or justification to relax validation. Zero coverage on the accepted non-symptom texts also does not validate clinical scoring accuracy.

## Remaining acceptance and operation

No full authenticated browser, physical microphone/camera, listening review or new full CBT/Whisper/Nano spoken conversation was run for this change. Worker-level CPU screening and Journal models were real; broader Chat/Talk and account gates have regression coverage but still require real application acceptance. Maximum-context stress, simultaneous real Buddy/Journal scheduling and all session/export/deletion acceptance remain unfinished. Parent transport startup hashing/imports retain the existing initialization window; this work does not make kernel/filesystem/driver faults universally cancellable.

The main application was not running at the final activation check (no listeners on 3000/4200/8002), and no application was started behind the user. Start normally from Echo:

```powershell
.\scripts\start-local-core.ps1 -LocalJson -EnableBuddy
```

No commit, push or deployment was made for this local substage. Source rollback checkpoint before this work: sibling Echo-recovery/C4-20261105T101605Z. A verified post-validation archive is saved after this report; archives exclude weights, environments, runtime credentials and private data.
