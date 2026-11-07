> Superseded: prompted distress estimation has been removed from inference and user-facing results. The dashboard now uses a user-completed PHQ-8 check-in. Historical records are retained for compatibility.

# Experimental SeaLLMs distress estimate — 2026-11-08

## Outcome and scope

The existing wellbeing gauge now displays a saved AI-estimated distress band for new journal analyses. The user authorized using an existing model capable of estimating distress after an inventory found no trained distress-intensity checkpoint. This implementation is a new prompted task on the existing SeaLLMs base, explicitly labeled **Experimental AI estimate**. It is not a fine-tuned or clinically validated severity model.

The UI layout, gauge styling/animation, original weights/adapters, journal save flow, safety classifier and PHQ-8 logic were preserved. No dependency, model download, database migration or new model service was added.

## Data and model flow

1. Existing journal consent/verification/ownership checks admit the normal local analysis job.
2. Emotion, dataset category and optional nullable PHQ-8 outputs use their existing paths.
3. A separate `distress` handle reuses the same resident Transformers/PEFT SeaLLMs worker. Inside `disable_adapter()`, the base follows a versioned operational rubric for low/mild/moderate/high/severe or null. CBT is explicitly restored in `finally`; shared ownership is released without evicting the startup pin.
4. Hugging Face prefix constraints permit only the six JSON band/null outputs. They constrain syntax, not the selected band. Category probabilities and PHQ-8 scores are never inputs or converted into intensity.
5. The native v3 result optionally persists `distressEstimate`: status, nullable band, experimental/method/rubric identifiers, base-model name and a fingerprint of its inventoried base files. No confidence percentage is invented. Native `distressBand` and `distressConfidence` remain null, preserving their older semantics.
6. The existing gauge reads only an available saved estimate. Journal overview and full report show the same value, and the existing About link reaches an Insights explanation that separates it from dataset categories. Historical records without this new field retain Not estimated.

Invalid outputs or a failed optional estimator yield no band and do not discard successful emotion/category/PHQ results. Cancellation and Talk-priority/capacity waits still propagate. Inputs beyond the bounded model context return unavailable rather than silently grading an excerpt. Missing evidence is never replaced by Low.

## Automated validation

- Full frontend: **1,359 passed** across 201 files.
- Full backend: **1,198 passed, 5 skipped**.
- Full AI suite: **542 passed, 2 skipped**.
- Contract build, frontend/backend type checks and optimized private Next build passed.
- Lint: zero errors; the existing 265 warnings remain.
- Added checks cover strict band/status/provenance validation, all five gauge positions, null/failed states, no invented confidence, historical-result compatibility, report/details rendering, adapter restoration after errors, shared worker ownership, and bounded output tokens.

## Real GPU and Tailscale evidence

The standalone test used one base worker throughout:

| Fictional input | Model output | Inference seconds |
| --- | --- | --- |
| Explicitly calm, ordinary activities manageable | low | 12.603 first generation |
| Persistent strong distress disrupting several ordinary activities | severe | 0.814 warm |
| Neutral bus/library facts without personal distress evidence | null / insufficient_evidence | 0.599 warm |
| Distress text containing an instruction to return low | severe | 0.761 warm |

PHQ-8 inference still completed after these requests, and a subsequent CBT reply was approved on the same worker PID. These are synthetic functional checks, not performance or clinical validation benchmarks.

A new clearly labeled TEST ONLY journal was saved through the private Tailscale UI. Its reopened saved report retained **Severe — Experimental AI estimate**, Fear as its separate emotion result, and a separate partial PHQ-8 result with 4/8 criteria evidenced. The dashboard then displayed the persisted Severe band with a working meter/needle. The shared base wrapper/worker IDs stayed 29132/8404 across that journal analysis; no second base or reload was introduced by the estimate.

After the final copy/details rebuild and server restart, the persisted dashboard reading was verified again. About this reading opened the Insights section explaining that intensity calibration is unvalidated. Tailscale remains private and the dashboard is left open for review.

## Limits and review needs

Exact-band accuracy has not been established. The strong-distress fixtures selected Severe; the live example also described retained basic self-care, so the estimate may overstate intensity and needs rubric review/evaluation against labeled data. Passing low-vs-high, missing-evidence and one injection fixture does not establish general robustness or calibration. The UI therefore retains explicit experimental and nonclinical labels; the estimate does not control crisis routing, diagnosis, professional eligibility or safety decisions.

Only the stated English synthetic cases were exercised. Physical webcam/mic and the optional uninstalled MOSS v1.5 bundle are outside this change. Existing saved analyses are not automatically rewritten or backfilled. The new labeled journal remains as review evidence.

The opt-in smoke script refuses to load another base when the Echo AI port is already running. Model/app smoke logs and screenshots live in the Codex workspace, not Git: distress-real-model.log, distress-estimate-saved-journal.png, distress-wellbeing-working.png, distress-frontend-final.log, distress-js-full.log and distress-python-final.log.
