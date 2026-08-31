## At a glance

AI-assisted journal analysis is optional. You can create an account and keep a private journal without enabling it. Reading or acknowledging this notice is not permission to analyze your entries. ECHO is a reflection and wellbeing-support application, not a medical service, diagnostic tool, or emergency monitoring system.

This notice explains the analysis workflow, the information it uses, its limitations, and the choices available to you. Read it together with the Privacy Notice and Terms of Use. The document version shown above identifies the notice you are reviewing.

## Two separate choices are required

Analysis requires both an active account-level AI-analysis preference and an explicit request for the individual entry. An account-level preference alone is not a request to process every journal. If either choice is absent, the entry is saved privately without an analysis job.

- You can leave optional AI analysis off during registration.
- You can change the account-level preference through the available privacy controls.
- Enabling it later does not automatically analyze older private journals.
- Turning it off does not erase previously completed results. Deletion follows the rules in the Privacy Notice.

If you explicitly request analysis but an analysis-specific eligibility or policy check fails, ECHO returns an error and preserves your draft instead of silently changing your request. To save privately, turn analysis off for that submission and submit again. A failed submission is not confirmation that the journal was saved.

## What is currently available

The application includes analysis infrastructure, but it does not include a working real AI model. Availability depends on the configured processing mode. A running backend, an available API, or a moving status indicator is not proof that a real model is ready.

- Disabled mode keeps eligible requests waiting for a provider; it performs no analysis.
- Development-stub mode produces deterministic simulated outputs for development and testing. These are not an assessment of your writing and must be labeled simulated.
- Local-worker mode requires a separately operated, authenticated worker to claim the job. The backend does not perform real inference itself. A worker's reported model readiness is separate from backend health.

If real processing becomes available, the interface must distinguish it from simulation. Do not interpret a simulated emotion label, score, symptom range, or recommendation as evidence about your mental health. Simulated results are excluded from production weekly aggregates.

## Information used for an analysis

The processing service may access the decrypted text of the entry you selected, together with the identifiers and consent, eligibility, and policy information needed to authorize the job. Authorized backend services decrypt encrypted journal payloads to support requested functions. This is not end-to-end encryption that prevents the service from reading content.

An external worker receives only the work authorized by its authenticated job claim. Private job fields, worker identity, lease credentials, callback receipts, and restricted safety evidence must not be included in browser status updates. See the Privacy Notice for information about account, infrastructure, and operational records.

## What the results mean

The supported result format includes an emotion distribution and dominant emotion, confidence information, a distress band, a depressive-symptom estimate range, and a reviewed recommendation selection. Results record provider, model, schema, and threshold versions so that their origin can be distinguished. Not every deployment will offer every result view.

These outputs are uncertain interpretations of limited text. Confidence values are not a guarantee of accuracy. A symptom estimate is not a diagnosis, a validated clinical screening result, or a prediction of what will happen. Slang, humor, sarcasm, language differences, cultural context, missing information, and model limitations can all change the output. You may disagree with a result or choose not to act on it.

## Processing, waiting, and retries

The backend controls the processing stages. A request may wait for a provider, undergo safety checking, progress through analysis, retry, complete, or fail. Waiting jobs are checked again for current consent, eligibility, policies, and journal availability before they can be queued. A lost connection or unavailable worker can delay processing.

Retries are bounded. Progress is a workflow indicator, not a measure of clinical certainty or an exact estimate of remaining time. A completed result is saved separately from weekly aggregation; a delayed dashboard summary does not mean the result itself failed. Deleting a journal cancels outstanding processing and prevents further result callbacks.

## Safety checks and support

Safety checking precedes ordinary analysis. A safety-support state pauses ordinary processing. User acknowledgement alone cannot resume it; only an authorized backend safety review can approve continuation after current gates are checked, or end analysis. Development safety fixtures may remain paused. Do not wait for a review or analysis result if you need urgent help.

ECHO cannot reliably detect every harmful situation, continuously watch your wellbeing, dispatch emergency assistance, or guarantee a response. Support resources are informational. If you believe there is immediate danger, use your local emergency services or seek help from a trusted person directly rather than relying on this application.

## Recommendations and Buddy

Recommendations use versioned, reviewed CBT-informed rules for optional reflection activities. They are not individualized treatment and do not replace professional assessment. A Buddy handoff is limited to approved features and recommendation or activity identifiers; it must not contain the journal text or restricted safety evidence.

Neither an analysis provider nor a worker may contact a guardian or trusted person on your behalf. A trusted-person request must be initiated by you and pass relationship, permission, consent, and applicable review checks. A request is not a guarantee that anyone has been contacted or will respond.

## Withdrawal, deletion, and acknowledgement

You may stop requesting new analysis and withdraw the account-level preference. That prevents new authorized processing but does not undo information already processed. Journal deletion begins the recoverable deletion period and derived-record cleanup described in the Privacy Notice. Restricted safety and sanitized audit records have separate limited retention rules.

Reaching the end of this notice enables the acknowledgement control; it does not prove understanding or grant analysis consent. Use Close for now if you need more time. Only enable optional analysis if you understand these limitations and want to request it for selected entries. This permission is not permission to publish your journals or use them for separate model-training or research purposes.
