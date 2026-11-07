> Superseded: prompted distress estimation has been removed from inference and user-facing results. The dashboard now uses a user-completed PHQ-8 check-in. Historical records are retained for compatibility.

# Distress-level model inventory — 2026-11-08

Requested: connect a real distress-intensity output to the existing wellbeing gauge without changing the UI or other model behavior.

## Findings

| Existing asset | Actual output | Supports a trained distress level? |
| --- | --- | --- |
| models/xlmr-v2/best_model/config.json | Others, Anxious, Depressed, Frustrated, Suicidal | No; these are categories, not an ordered intensity scale |
| models/xlmr-v2/calibration/calibration.json | Temperature-scaled class scores and a dataset-label support flag | No; its warning explicitly prohibits inferring severity |
| models/e4-c/e4_config.json | Eight Plutchik and 27 GoEmotions labels | No distress-intensity head declared |
| models/phq8-seallms/adapter + app/model/screening.py | Eight experimental nullable PHQ-8 frequency estimates | Depressive symptoms, not general distress intensity |
| ai-service/app/inference/severity.py | PHQ-8 total-to-symptom-band function | A score mapping, not an independent distress model |
| backend/models/distress-roberta/final | .gitkeep only | No checkpoint installed |
| backend/models/peak-roberta/final | .gitkeep only | No checkpoint installed |
| Buddy/CBT SeaLLMs | General instruction generation with CBT adapter | No trained distress-level head or reviewed intensity rubric supplied |
| Nano, Whisper, final face package | Speech, transcription, facial-expression outputs | Not distress-intensity models |

Checked the active sibling models directory, repository model directories, archived XLM-R export, old checkout/snapshot metadata, Desktop/Downloads model metadata, and Downloads/Compressed/models.zip and models_2.zip. The archives contain the same five-category XLM-R label mapping. Random tiny engineering fixtures have fixture labels and are not research predictors. Archives were inspected without extracting or modifying their weights.

## Existing application behavior

app/model/core.py deliberately emits distressBand=None and distressConfidence=None. Contracts preserve those null values in native v2/v3 results. The current gauge accepts an actual non-simulated legacy distressBand; it intentionally does not turn native categories, their relative scores, or PHQ-8 values into general distress intensity.

The recent labeled synthetic journal completed with Fear as the dominant emotion, Depressed as the classifier category, and six evidenced PHQ-8 criteria. The dashboard updated to that result and correctly retained Not estimated for distress intensity. That test proves persistence/update flow, not a missing intensity model.

## Integration decision

No installed trained distress-level checkpoint was found. After reviewing these findings, the user authorized using any existing model capable of estimating distress. The implemented path is therefore a new explicitly experimental prompted task on the existing shared SeaLLMs base, not a claim that a fine-tuned or validated severity head exists. See PROMPTED_DISTRESS_INTEGRATION_2026-11-08.md. Category scores and PHQ-8 totals are not converted into distress intensity; original checkpoint/adapter files and the gauge layout are retained.

To implement an actual trained distress estimate, supply the checkpoint/tokenizer plus its inference entry point, ordered level definitions or regression scale, preprocessing and any developer-provided thresholds/evaluation fixtures. A separate approved alternative is to relabel the gauge for the existing PHQ-8 symptom estimate, using only complete totals and preserving unavailable/partial states. A new prompted SeaLLMs distress estimate is a different experimental feature and must be explicitly distinguished from a trained or validated intensity model.

Inventory log: Codex project workspace/distress-model-inventory.log. The user chose the existing-model estimation path; the running feature is marked experimental and remains distinct from a trained or validated distress-intensity model.
