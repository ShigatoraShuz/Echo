# Combined model residency check - 2026-11-06

Passed an isolated synthetic GPU test with shared Transformers/PEFT SeaLLMs (CBT and PHQ adapters), GPU XLM-R, GPU RoBERTa-large/E4-C, GPU Nano/codec/reference and CPU INT8 Whisper resident together. Existing application services were not stopped or reconfigured.

| Check | Seconds | Free GPU GiB after check |
|---|---:|---:|
| seallms_ready | 36.754 | 8.59 |
| xlmr_loaded | 12.252 | 7.31 |
| e4_loaded | 9.673 | 5.79 |
| nano_codec_ready | 9.887 | 5.09 |
| whisper_cpu_ready | 0.000 | 5.10 |
| xlmr_inference | 0.322 | 5.02 |
| e4_inference | 0.344 | 4.92 |
| phq_inference | 9.512 | 4.72 |
| cbt_approved | 19.735 | 4.42 |
| nano_synthesis | 3.517 | 4.40 |

XLM-R and E4-C inference succeeded; E4-C returned eight Plutchik values. PHQ preserved coverage 0 for the neutral fixture; CBT passed V3 approval on the same shared PID; Nano produced one speech segment. All test workers remained alive through the sequence and were released afterward. GPU use returned to the original approximately 877 MiB.

Minimum observed stage-boundary free memory: 4,729,344,000 bytes (~4.40 GiB), above the 2 GiB reserve. This is not continuous peak-memory or maximum-context stress validation.

Reproduce from Echo using the existing core interpreter: `ai-service/.venv-core/Scripts/python.exe ai-service/tests/smoke_stack_residency.py`. The script loads real models only when invoked explicitly, writes ignored synthetic diagnostic metadata to models/stack-residency-test.json, and cleans up owned workers. It never changes startup preload policy.

Limitations: synthetic inputs only; no authenticated browser, physical microphone/camera, facial estimator, maximum-context/long-speech stress or human listening review. This supports basic co-residency for the tested stack; it does not establish every application function or a permanently resident startup implementation. No model, environment, credential or database-policy changes; no push.
