# Journal PHQ-8 integration

This report covers journal screening. Buddy speech work has since resumed; see [local speech integration](speech-environment.md) for its current status and verification.

## What runs

New reflections with journal-analysis consent enabled run the existing support checks, XLM-R categories, E4 emotions and the selected combined REDSM5 + DAIC SeaLLMs adapter. Results use echo-journal-analysis-v3 and are stored only in local JSON. Questionnaire PHQ-8 answers, scores and dates remain separate. No journal estimate is copied into questionnaire fields, clinical severity, distress bands or automated contact rules.

The selected adapter is CODEX/models/phq8-seallms/adapter and uses the verified CODEX/models/cbt/base. Twelve shared base files matched source hashes. Original model folders, calibration and XLM-R settings were not modified. No model downloads or retraining were performed.

The new journal prompt is versioned journal-nullable-v1 plus the inference-code fingerprint. It allows integer item estimates 0-3 or JSON null. All eight keys must exist; strings, booleans, missing keys and invalid scores are rejected. Missing values are never converted into zero.

- One to seven numeric items: partial subtotal plus coverage; complete total stays null.
- Eight numeric items: computed model-estimated total, kept separate from questionnaire scoring.
- Eight nulls: no subtotal or total; display No criteria evidenced in this entry.
- Model failure: native categories and emotions remain available, with screening explicitly unavailable.

Null is displayed as Not evidenced in this journal, not proof that the person has no symptom. Model generation is experimental. The original comparable interview evaluation had only 20/33 strict-valid outputs; its metrics do not validate this new nullable journal policy or journal-domain accuracy.

## Display and retry

Journal details show all eight criteria, coverage, subtotal or complete total, estimate timestamp, and truncation disclosure. Dashboard estimate history stays separate from questionnaire scores and does not extrapolate incomplete subtotals.

POST /api/v1/journals/:journalId/screening/retry reruns screening only. It verifies ownership, current consent, eligibility and unchanged journal content, prevents concurrent retries and caps retries at three. Successful retries refresh the journal through the existing analysis-completed event. Model failures and revoked consent preserve the existing saved native result.

Older v1/v2 results remain readable. Existing completed journals are not automatically reprocessed. The PHQ prompt keeps at most 1700 tokens, preserving the instruction prefix and the end of long input; truncation and original/retained counts are recorded.

## Startup

From E:\Python Project\CODEX\Echo:

```powershell
.\scripts\start-local-core.ps1
```

Stop an existing development instance first if its ports are occupied. The launcher builds shared contracts before starting the application and uses Thesis2_VENV explicitly. Enable and save Settings / Privacy / Journal analysis consent for new reflections. Do not use -EnableWorker for local JSON operation.

## Verification

- Actual selected-checkpoint inference produced valid nullable outputs for English, Filipino and Taglish synthetic entries. A repeated English entry produced identical item estimates.
- Tests cover legitimate zero, all-null output, partial subtotal arithmetic, missing/string/boolean/out-of-range values, long-input token handling, encrypted v3 compatibility and native-label rendering.
- Screening-only retry tests preserve classification/emotions, enforce the limit and discard results after consent revocation.
- A missing screening adapter is reported as unavailable without preventing the native core runtime from loading.
- The PHQ-only actual-model HTTP test passed in 213.73 seconds: three language cases, disposable encrypted journal saves, local JSON persistence and reopen, screening-only retry, unchanged native scores, and zero database analysis records. No MOSS calls ran in that test.
- Type checks and backend build pass. No hosted migration or real-user test record was created.

Real browser interaction, clinical accuracy, journal-domain accuracy and semantic correctness of individual criterion estimates remain unverified. Synthetic smoke tests demonstrate execution and validation only.
