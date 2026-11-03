# Journal model loading: verified 2026-11-03

The native text worker now retains PHQ-8 alongside XLM-R and E4-C when GPU memory permits. PHQ-8 and Buddy use the same existing `cbt/base` checkpoint, so their independent LoRA adapters share one quantized base instead of repeatedly unloading and rebuilding it. Each task retains its own tokenizer and chat template, explicitly selects its own adapter in inference mode, and runs under the existing single-owner lock. Both adapters must use independent LoRA deltas without shared bias, extra saved modules, layer replication, or DoRA; otherwise the isolated loader remains the fallback.

Memory-pressure eviction removes all aliases of a shared physical model together. The existing two-GiB headroom policy remains. Runtime metrics expose physical resident count, adapter names, load durations, and load counts. This cache holds model weights only; every submitted text still runs inference. Full checkpoint/vendor integrity checks, safety gates, nullable PHQ consistency pass, prompts, generation limits, quantization settings, and trained files remain unchanged. UI components and persistence logic were not changed.

## Measured on the installed RTX 5060 Ti 16 GB

| Measurement | Original loader | Optimized loader |
| --- | --- | --- |
| Repeated journal analysis, native HTTP model boundary | 25.65–26.68 s | 3.89–4.08 s |
| Mean repeated analysis | about 26 s | about 4 s (~85% faster) |
| First Buddy request after journal analysis | 28.77 s | 8.74 s |
| CBT adapter attachment to resident PHQ base | Full base reload | 1.20 s |

The original measurements came from an already running worker. A separate fresh-worker optimized run took **54.36 seconds for its first journal analysis**, including lazy Python/model initialization. This is not an equal cold-start comparison and does not establish a cold-start improvement. Subsequent requests reuse loaded weights until memory pressure, a model failure, or restart requires loading again. Initial checksum verification at service startup is also retained. Do not promise instant analysis after a restart.

At the end of the benchmark, four logical entries (`xlmr`, `e4`, `phq8`, `cbt`) occupied three physical models, with about 6.2 GiB reported free. Every model/adapter loaded once. Returning from Buddy to PHQ-8 took 4.22 s, produced the original prediction again, and kept all load counts at one.

## Correctness and app validation

- Four before/after journal comparisons using two fictional inputs matched exactly after excluding `generatedAt`. One input explicitly denied all eight symptoms; the other omitted frequency information. Coverage remained eight/total zero versus zero/total null, respectively. Buddy's seeded reply and metadata also matched exactly. These samples verify regression behavior, not clinical accuracy across all inputs.
- A real browser login and journal editor submission reached the account-scoped backend worker and completed with `echo-core`, `is_demo_data: false`, and an available PHQ-8 result. The saved report survived reload; its PHQ-8 tab opened; the dashboard showed the new reflection; insights opened without browser runtime errors. No inference API was mocked. The fictional test journal was deleted afterward. Existing user drafts/settings/journals were preserved.
- The actual UI save-to-completed-result measurement was **19.44 seconds**, including backend/database/queue work. The ~4-second model-boundary measurement is not the full UI latency.
- The persisted UI model predictions matched the direct baseline. Metadata correctly differed only in declared language (`unknown` from the UI versus `en` in the direct benchmark).
- **33 focused tests passed**: `test_shared_adapters.py`, `test_text_residency.py`, `test_text_transport.py`, and `test_screening.py`.
- The broader AI suite is not green in `.venv-core`: 36 failed, 192 passed, one skipped before the final additional guard test. Running the same suite with the original loader, excluding the five new tests then present, reproduced the exact same 36 failed test IDs (187 passed, one skipped). Failures include missing separate speech dependencies (`av`, `faster_whisper`), tokenizer fixture incompatibilities with the core Transformers version, and research runtime-version expectations. Dependencies were not upgraded or changed to mask these failures.

Local fictional benchmark JSON, UI screenshots, and original-loader test logs are under `artifacts/model-integration/loading-optimization-20261103/`. The artifacts remain local and are not required for app startup. The optimization is scoped to the native text-memory runtime; it does not establish new face, speech, or realtime Talk verification.

Restart the integrated development launcher after editing Python code. Use the existing `npm run dev` entry point once; the configured sibling `models` directory and existing account scope are unchanged.
