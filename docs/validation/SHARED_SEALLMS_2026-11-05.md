# Shared SeaLLMs / PHQ migration — 2026-11-05

Status: implemented behind qualification; NOT selected for normal application use. The urgent reflection retention change is separately complete; see REFLECTION_RETENTION_2026-11-05.md.

## Implementation

Explicit offline setup converts the verified, unmerged SeaLLMs-v3-7B-Chat base and exact mixed_epochs_2 and PHQ LoRA deltas. Originals, adapter configuration bytes, environments, voice and safety policies remain unchanged. Pinned b12110 converters/runtime are verified offline. Staging receipts permit resumption; manifest publication occurs last. Weights/GGUFs/diagnostics remain ignored by Git.

The controller owns one GPU llama.cpp process with both LoRAs. Private bounded IPC grants policy workers a loopback capability; no service credentials are inherited and no text/audio payload files are introduced. Every request supplies both adapter scales explicitly, including both zero for the neutral PHQ check. Global adapter mutation is refused and prompt reuse is disabled. Cancellation drains the server before reuse; failed drain/server death invalidates dependent policy workers. A healthy remaining CBT or PHQ owner retains the base. Existing lease grace, speech-only Stop and scheduler serialization remain authoritative.

PHQ preserves both prompts, greedy generation, 300-token output limit, inherited repetition penalty 1.05, 1700-token truncation, strict eight-key validation and nullable agreement. Its two passes now have separate admitted operations, enabling Buddy priority between them. Ownership is rechecked at each operation. Invalid/failed neutral checks never publish adapted estimates. Runtime identity is separate from PHQ policy provenance through an additive strict contract.

## Actual model evidence

A real configured CBT worker and PHQ policy worker completed CBT → PHQ → CBT against one base PID. Both CBT replies were approved under unchanged V3 checks. Base load 29.640 s; configured CBT worker preparation 81.752 s (includes existing raw-asset/policy checks); PHQ proxy preparation 38.983 s; CBT responses 4.717 and 2.920 s. Global free GPU memory was 9,965,838,336 bytes before speech-stack validation. These are isolated measurements, not authenticated app latency promises.

Neutral/CBT/PHQ/neutral probes reported scales [0,0], [1,0], [0,1], [0,0]; neutral output fingerprint matched before/after. Both LoRA buffers and all base layers were verified on CUDA. Converted base is Q4_K_M (4,683,071,936 bytes); each F32 LoRA is approximately 161.5 MB. BF16 intermediate is retained for explicit future conversion. Conversion peak sampled RSS was 18,141,818,880 bytes; peak committed memory was 6,688,038,912 bytes. Limits remain 28,000,000,000 committed bytes and 60% CPU per controlled process tree, not a machine-wide aggregate cap.

## Failed PHQ gate — do not activate

On the synthetic ordinary-assignment fixture, unchanged native HF PHQ returned coverage 0 (no supported two-week estimates). Shared Q4 returned coverage 8. A separate unselected Q8 candidate (8,098,523,584 bytes) also returned coverage 8. Thus merely increasing precision did not resolve this observed difference; its root cause is not established. Both engines rejected the second malformed synthetic fixture. No grammar repair, null-to-zero conversion, prompt rewrite or validation relaxation was introduced.

Normal operation remains on the current profile (CBT existing GGUF, PHQ existing native worker). Absence of selected-runtime.json means current. Failed/incomplete qualification cannot activate shared-seallms. The explicit selector checks the pinned manifest, exact implementation fingerprint and all required acceptance checks before atomically publishing selection. Current-profile rollback requires no model deletion.

## Reproduction and remaining work

From Echo, use the existing core interpreter:

```powershell
.\ai-service\.venv-core\Scripts\python.exe scripts/prepare-shared-seallms.py --build
.\ai-service\.venv-core\Scripts\python.exe ai-service/tests/smoke_shared_seallms.py --run-models --with-speech
```

The smoke command uses only synthetic fixtures, writes ignored models/llama/shared-diagnostic.json and returns exit 2 when qualification is incomplete/failed. It never selects a profile. Do not set ECHO_SHARED_SEALLMS_VALIDATE for normal startup: it is only an isolated diagnostic bypass. An approved qualification report is required by scripts/select-shared-seallms.py --profile shared-seallms --report <report>; do not create a fabricated pass report. Stop services before selecting and restart afterward. Explicit rollback: scripts/select-shared-seallms.py --profile current.

Unfinished: determine PHQ supported-value regression; broader PHQ/CBT fixtures; actual maximum-context/long-speech stress; process-kill cancellation/recovery qualification; authenticated Chat/Talk/journal scheduler acceptance; physical microphone, echo and listening review. No successful end-to-end application acceptance is claimed. Storage/export/deletion and other previously documented recovery work remain separate unfinished stages. No push, model-source rewrite, environment installation or database change occurred.


## Final follow-through (reported 2026-11-06, Asia/Taipei)

The reproducible speech-inclusive run loaded the shared base in 32.622 s, configured CBT policy worker in 48.253 s, PHQ proxy in 40.812 s, CPU Whisper in 7.159 s and Nano/codec/reference in 34.310 s. CBT replies were approved in 4.805 s and 2.972 s around the PHQ pair (1.388 s). One Nano speech segment completed in 3.158 s; it was not reviewed by listening. Whisper's backend reports `int8_float32`, its CPU INT8 quantized weights with FP32 compute label; the configured request remains `compute_type="int8"`. Nano/codec/reference reported CUDA residency. Global free GPU memory with the speech stack was 9,238,482,944 bytes (~8.6 GiB).

Qualification passed adapter isolation, CBT approval, single-base worker reuse, speech co-residency and the 2 GiB reserve. PHQ nullable agreement failed; actual cancellation/recovery and maximum-context stress remain unqualified. The smoke command returned exit 2 and did not select the shared profile. The unselected Q8 diagnostic file is not part of the activated manifest.

Final unit validation: 462 Python tests passed, 33 failed and 5 skipped. An untouched HEAD source snapshot produced the same 34 failures initially observed in the changed tree (394 passed, 5 skipped); there were no new failure identities. One existing architecture test was corrected to assert both direct architecture rejection and the sanitized outer error; it now passes. The remaining failures include missing optional `av`/`faster_whisper` in the core test environment and synthetic tokenizer/model fixture incompatibilities. No environment was modified to mask them. The full suite is not green.

Affected backend tests: 53 passed. Urgent frontend tests: 28 passed. Shared contract compilation, backend build, frontend type check and diff whitespace checks passed. No authenticated browser, physical microphone/camera or human listening acceptance was performed. All isolated probe workers were released. The normal app was not started by these tests.

A failed documentation encoding write was recovered from the hash-verified C5-20261105T120726Z source archive before adding the current handover section in UTF-8; no earlier handover material was discarded. Checkpoint archives are source rollback artifacts, not commits, and exclude model weights, environments and private local state.
