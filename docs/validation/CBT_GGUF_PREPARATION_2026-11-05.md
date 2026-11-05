# CBT GGUF preparation validation — 2026-11-05

Status: offline CBT artifacts prepared; active Echo inference unchanged. This report does not establish Chat/Talk end-to-end readiness.

## Identity and outputs

- Exact adapter: `mixed_epochs_2/final_adapter` copied into Echo's existing model bundle.
- Base identity: `SeaLLMs/SeaLLMs-v3-7B-Chat`, architecture `Qwen2ForCausalLM` / GGUF `qwen2`.
- Adapter SHA-256: `6bfe92fc0ba316997a18abcb7c79a1fda7cec608bce07baaa7719bfb47c7c04e`.
- Adapter configuration SHA-256: `69ecc08861220cf86bc11d770c2914d3a350c12b9037097900b1fe0787c0efad`.
- Source-inventory identity: `af5e7caf52347e8f43f9780483ef3c67de2cec452b17ae4a78701beeb6891652`.
- llama.cpp: b12110, commit `cd959bae99ff4bed22bef2604f45241c09bbb8c8`.
- Destination: `models/llama/artifacts/cbt-mixed-epochs-2-q4_k_m` (ignored local assets).

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `cbt-mixed-epochs-2-bf16.gguf` | 15,237,851,104 | `ca2293da7f4409e5a430a17e44edb55a3a75b860d85dd226e2b0616e038226fa` |
| `cbt-mixed-epochs-2-q4_k_m.gguf` | 4,683,071,456 | `04bade07fd81c4a116eb8f2b62da4ad0bb28b74bb15d2ed85e3a9cf70f6d4bb6` |

The final manifest records all output-file hashes and source provenance. Source adapters/configurations and original models were not rewritten. Base and adapter model cards accompany the merged weights.

## Automated checks

45 tests pass across `test_cbt_shard_merge.py`, `test_cbt_gguf_preparation.py`, `test_conversion_resource_limits.py` and `test_llama_setup.py`. Tests cover pinned setup, archive integrity/traversal, source identity, capacity admission, partial-output preservation, verified resume, adapter mapping, shard values versus PEFT FP32 safe merge, streamed arithmetic versus a fully FP32 tiny model, cleanup on failure, filtered Windows environments and resource enforcement. Warnings concern installed SWIG and Torch deprecated APIs. Diff checks pass.

Native Windows tests verify actual configured limits, descendant membership/inheritance, allocation denial and RAM-watchdog termination. They do not measure application inference performance. No frontend/backend behavior changed in this substage; their broad suites were not rerun for these setup-only edits.

## Real model checks

The complete 21-file selected source inventory (15,415,755,671 bytes) passed hashing. Four shards were merged using FP32 B@A additions, then stored as BF16. All 196 adapted linear layers and all 339 saved tensors passed coverage/value checks.

A prior full-model BF16 merge failed a smoke threshold, and a whole-model FP32-layer retry exhausted its committed-memory budget. Neither produced a published GGUF. The final path avoids those allocations by merging shards and running separate validation children. It also fixes a filtered Windows environment omission that made Torch's username/cache initialization fail under a misleading Transformers import error. No packages were installed to resolve it.

The final original-versus-merged comparison uses matched FP32 arithmetic with BF16 stored weights and row-bounded linear projections. Maximum absolute logit difference was **0.03273296356201172**, below the unchanged 0.5 threshold; mean absolute difference 0.004800557624548674; RMS difference 0.0059597427025437355; leading token agreed. Original and merged input/template fingerprints agree. This benign fixed probe is a transformation smoke check, not response-quality acceptance. Its arithmetic differs from the earlier BF16 diagnostic, so the two errors must not be presented as a like-for-like benchmark.

Both GGUFs retain Qwen2 architecture, chat template and 339 tensors. The Q4_K_M file contains F32, Q4_K and Q6_K tensors; metadata file type is 15, EOS 151645, BOS/padding 151643. Parsing these artifacts is not the same as generating replies with llama.cpp.

## Resources and boundaries

The conversion tree ran with a decimal 25 GB committed-memory budget (Windows page-rounded ceiling 24,999,997,440 bytes), a 60% CPU hard cap and 100 ms aggregate resident-memory watchdog. Peak sampled resident memory was **18,131,210,240 bytes**; peak committed memory **20,746,113,024 bytes**. CPU percentage was configured/enforced through Windows jobs, not separately benchmarked. Quantizer time: 107.892 seconds.

Physical-memory sampling can miss short peaks; shared pages are counted conservatively. Limits cover the owned conversion tree, not other applications or Windows. Runtime inference quotas are unchanged.

Dependencies observed: Torch 2.12.0+cu130, Transformers 5.5.0, PEFT 0.21.0, safetensors 0.8.0. Existing environments, model configurations, V3 policy/formatting, account/session data and database policies were preserved. No push or merge occurred.

## Unfinished acceptance

- PHQ declared-base identity and its separate conversion.
- Actual llama.cpp generation and tokenizer/template/stop-token parity against the current provider.
- Exact adapter enforcement in the integrated provider and removal of remaining legacy model references.
- V3 approval, retry, withholding, context and internal formatter regression on the new runtime.
- Scheduler ownership, cancellation, unload/reload, GPU residency and real GPU headroom under the new provider.
- Authenticated Chat/Talk, browser microphone/playback, three spoken turns, journal coexistence and restart acceptance.
- English listening/voice review; Filipino/Taglish remain experimental.

Rollback uses verified source archives under `E:/Python Project/CODEX/Echo-recovery`. These archives are not Git commits and do not contain ignored model weights or credentials. New artifacts are separate from the unchanged originals; activation requires a later reviewed runtime integration.

Final offline reuse check passed: all recorded artifact files and selected source files were rehashed successfully using the normal capped command. Existing artifacts were reused, with no merge/conversion rerun and no model loading. The verification tree returned zero with peak sampled working set 59,658,240 bytes.
