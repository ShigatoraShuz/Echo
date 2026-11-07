# User-completed PHQ-8 dashboard — 2026-11-08

## Result

The dashboard signal card now presents a user-completed PHQ-8 check-in. It uses the existing private wellness endpoint, encrypted assessment storage, shared questionnaire scoring, submission IDs, and weekly schedule. No database migration or new model is required.

Eight answers scored 0–3 produce a total of 0–24. Existing application thresholds are retained: 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately severe, 20–24 severe. These describe depressive symptoms over the two weeks before the dated questionnaire, not current distress or immediate safety. Screening is not a diagnosis.

The card shows the latest complete assessment, its date, and its self-reported source. If the latest snapshot is partial, this is stated explicitly; unanswered items are never zero-filled and do not generate a total. With no complete assessment the gauge has no needle or score. Users can open the questionnaire or review saved answers from the card; new check-ins follow the existing schedule. The existing arc, halo, needle sweep, entrance animations, and reduced-motion behavior are preserved.

The experimental prompted SeaLLMs distress estimator, worker request, shared-runtime role, and inference call have been removed. Journal analysis, saved-result views, and Insights no longer render that estimate. Historical optional fields remain readable so existing journals are not broken or rewritten. The original journal PHQ model output remains separate from the user-completed questionnaire. Original model checkpoints and adapters are unchanged.

## Verification

- Frontend: 1,357 tests passed, including thresholds, no-score/partial states, card opening, save-to-card update, remount restoration, and dashboard animation tests.
- Backend: 1,198 tests passed, 5 skipped; includes questionnaire validation, scoring, encrypted owner-scoped saving, and schedule checks.
- AI service: 521 tests passed, 2 skipped after removing the extra inference path.
- Contracts build, frontend/backend type checks, and optimized private frontend build passed.
- Live private HTTPS dashboard renders the PHQ-8 card; the card opens the eight-question form with all answers unselected and the correct two-week instructions.
- Private readiness endpoint returned HTTP 200 after the coordinated restart.
- No completed questionnaire exists on the reviewed live account. No answers were invented or saved for that user; live completed-score verification awaits their own questionnaire. Save/reload behavior was verified using synthetic automated fixtures, not fabricated user records.

## References

- Kroenke et al. (2009), PHQ-8 measure: https://pubmed.ncbi.nlm.nih.gov/18752852/
- CDC questionnaire wording, response scoring, and two-week timeframe: https://www.cdc.gov/nchs/products/databriefs/db379.htm
- Existing application scoring contract: packages/contracts/src/wellness.ts (`scorePhq8`). CDC's cited report groups 15–24 together; Echo retains its existing five-band subdivision and does not attribute that subdivision to CDC's four-group report.
