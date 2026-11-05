# Journal emotion-stage diagnostic — 2026-11-05

The reported screen shows completed safety/crisis screening and failed emotion-stage progress. XLM-R supplies the safety/distress classification; E4-C/RoBERTa supplies the eight Plutchik emotions. Three recent local records were failed at progress 25, with no saved underlying exception code. Journal bodies/messages were not printed, changed or resubmitted.

## Real checks

The bundled E4 tokenizer loaded successfully. Real E4 weights loaded and inferred on fixed synthetic text on both CPU and CUDA. CPU load measured about 6.55 seconds; GPU about 6.45 seconds. Returned fields included eight-way Plutchik and 27 GoEmotions outputs. The PHQ tokenizer also loaded successfully. No model weights, manifests, environments, classifiers, calibration or label mappings were changed. The GPU diagnostic used an admission headroom check; active application workers were not stopped.

These checks show that the current bundled E4 loader/short-input inference can work. They do not identify the exception in an older failed job, prove every journal/input path works, or establish that XLM-R/E4 failed in that job.

## Confirmed pipeline defect and repair

The local backend sets progress to 25 (emotion analysis), then issues one combined analysis request. The split text transport runs classification, emotion, optional PHQ, then final assembly. Unlike CoreRuntime's existing nullable-PHQ handling, the split transport allowed a PHQ load/inference error to abort the complete request. That path can discard successful E4/XLM-R outputs and leave the UI blaming the coarse emotion progress marker.

The split transport now preserves those completed outputs for recognized PHQ model failures and passes an explicit unavailable/failed, nullable screening object to final assembly. No criteria or totals are fabricated. Busy/cancel/ownership conditions, dead transport, invalid requests and actual emotion failures still propagate. Missing PHQ assets now use a stage-specific safe code. Future backend failures log only an allowlisted code, combined-stage label and numeric progress; no journal text, account IDs, exception messages, prompts or paths.

The prior failed records were not rewritten, automatically retried or deleted. The exact old error remains unknown because it was not retained. This repair addresses a verified failure path, not a claim that PHQ definitely caused the screenshot. Unknown future failures can still show coarse UI progress; richer persisted per-stage diagnostics remain a broader-plan item.

## Verification and operation

47 Python tests and 20 backend tests passed. Backend compilation and diff checks passed. Tests verify preservation of emotion/distress on optional PHQ failure, nullable contract acceptance, no fake screening scores, propagation of real E4/transport/cancel/wait errors, and sanitized logging.

Restart the AI service and backend to load the repair, then use the existing authorized Retry Analysis action. Earlier failed jobs remain failed until manually retried. Authenticated reanalysis of the user's private journal was not performed. Existing consent, ownership, safety and manual retry limits remain unchanged.
