-- Forward-only notice update. Historical text and consent references stay intact.
-- Activation requires users to review the new set; it never enables optional AI.
with content(document_type, title, summary, markdown) as (
  values
  ('terms_of_use', 'Terms of Use', 'Account responsibilities, optional features, safe use, and service limitations.', $policy$
## Purpose and scope

ECHO provides private journaling, reflection, and wellbeing-support features. These terms explain the intended use of the application and important limitations. Read them with the Privacy Notice and AI Analysis Notice. The version displayed in the reader identifies the terms you are reviewing; older acknowledgements remain linked to the version shown at that time.

ECHO is not a healthcare provider, clinical assessment service, emergency-response service, or substitute for professional care. Its content and activities are intended to support reflection, not to diagnose, treat, cure, or predict a health condition. Do not rely on the application to decide whether an urgent situation is safe.

## Eligibility and your account

ECHO accounts are intended for adults aged 18 and over. Provide accurate information for eligibility and account verification. Some features require a verified email, current policies, completed onboarding, and an active eligible account. Attempting to bypass these checks or use another person's identity is not permitted.

Keep your password and sign-in methods secure. Do not share verification codes, access tokens, or private session links. Sign out on shared devices and review persistent-session choices before using them. If you suspect unauthorized access, stop using the affected session and use the available account-recovery or operator-support process.

Google sign-in is an optional authentication method. It does not change the ECHO eligibility requirements or automatically authorize journal analysis. Availability depends on the configured identity provider and its own terms. ECHO cannot guarantee that an external sign-in provider or browser will always be available.

## Journaling and responsibility for content

You decide what to write and save. Avoid unnecessary personal information about other people, especially private health details, credentials, or material you do not have permission to share. Keep an independent copy of information you cannot afford to lose, using available export tools where appropriate.

Use ECHO lawfully and respectfully. Do not use it to harass others, impersonate someone, distribute malicious software, attempt unauthorized access, or disrupt the application. Do not probe or bypass another user's journal permissions, worker credentials, or restricted safety records. Reporting a problem does not require posting sensitive journal content publicly.

Saving, analysis, and deletion are separate operations. A draft, failed network request, or onscreen progress message is not confirmation of a completed save. Check the actual result of the operation before closing an unsaved entry. Repeating an unchanged submission may safely replay its original result, while editing the request creates a new submission.

## Optional analysis and informed choice

You may use private journaling without enabling AI analysis. Analysis requires both the account-level preference and an explicit request for the entry. Reading or acknowledging the AI Analysis Notice does not enable it. Enabling analysis later does not automatically analyze your existing private journals.

The application includes the architecture for analysis but no working real AI model is bundled. Development results are simulated and must be identified as such. A disabled provider or unavailable external worker can leave a request waiting. Backend availability must not be interpreted as proof of model availability or accuracy.

Analysis may be incomplete, misleading, or incorrect. Emotion labels, distress bands, confidence values, and symptom estimate ranges are not clinical findings. Reviewed CBT-informed activity recommendations are optional reflection suggestions, not individualized treatment. You remain free to disregard a result or stop using the feature. The AI Analysis Notice provides the more detailed explanation.

## Safety and support limitations

ECHO is not continuously monitored and does not guarantee identification of risk, a human review, emergency dispatch, or a response within a particular time. A safety-support screen may pause analysis; acknowledging it does not itself authorize processing to resume. Do not wait for a pending job or review when you need immediate assistance.

If there is immediate danger, use local emergency services or seek help directly from a trusted person. Listed resources are informational and their availability can change. Recommendations and Buddy conversations cannot replace professional evaluation, ongoing care, or direct contact with an appropriate service.

Trusted-person actions must be initiated by you and pass the required relationship, permission, consent, and review checks. A provider or worker cannot independently contact a guardian. A submitted request is not proof that another person has been notified, has seen it, or will respond. Do not use ECHO as your sole means of contacting help.

## Privacy, retention, and deletion

The Privacy Notice describes account data, encrypted journal payloads, authorized service access, optional processing, and operational records. Encryption is not a promise that the backend can never read content. Use the available privacy controls and review the notice before storing sensitive information.

Journal deletion begins a 30-day recoverable soft-delete period and stops outstanding processing. Source-derived records are then purged through the cleanup workflow, with separate limits for audit and restricted safety records. Account deletion is distinct from deleting one journal. Exports may create copies outside ECHO's access controls, so store them carefully.

Withdrawing optional analysis consent is not the same as deleting previously saved results. Cleanup tasks, provider infrastructure, and service availability affect when removal completes. Review the actual status of requests; do not assume that a click immediately removes every copy or account record.

## Availability and changes

Features may be unavailable during development, maintenance, service interruptions, or changes in external providers. Analysis can wait, retry within a limit, or fail. A completed journal result and a weekly dashboard aggregate are separate records; a delayed aggregate does not automatically invalidate the result. No uninterrupted availability or error-free output is promised.

Access may be restricted by account status, verification requirements, abuse-prevention controls, or current feature eligibility. Changes to required documents are versioned and may require a new review for gated features. New wording must not be treated as accepted solely because you acknowledged an older version.

## Questions and agreement

If a feature, privacy choice, or term is unclear, close the reader and ask the ECHO operator through the support channel provided for your deployment before proceeding. Do not include passwords, tokens, or unnecessary journal content in a support request. These terms do not claim regulatory certification, clinical approval, or removal of rights that applicable law does not allow to be removed.

Acknowledging this document marks it as reviewed. The final agreement step confirms the required policy choices for the displayed versions. Optional AI permission remains a separate choice and may be left off. Reaching the end of a document is only a reading aid; it is not evidence that you understood every provision or consented to unrelated uses of your information.
$policy$),
  ('privacy_notice', 'Privacy Notice', 'Your data, authorized access, consent choices, retention, and deletion.', $policy$
## Scope of this notice

This notice explains the information used by ECHO's account, journaling, optional analysis, and support workflows. Journal writing can contain sensitive personal information. Share only what you are comfortable storing, and avoid unnecessary identifying information about other people. ECHO is a wellbeing-support application, not a clinical record system or an emergency monitoring service.

The version shown in the reader identifies the notice being acknowledged. Reading this notice does not turn on optional AI analysis. The separate AI Analysis Notice explains its choices and limitations. Interface availability may differ between development and deployed environments.

## Account and eligibility information

ECHO uses account identifiers, email and verification information, profile and onboarding preferences, account status, and versioned policy acknowledgements to provide access. Accounts are intended for adults aged 18 and over. Registration uses a birth date to check eligibility; the temporary encrypted registration value is distinct from the eligibility outcome retained for account checks.

When you choose Google sign-in, Google and the authentication service handle their part of the authentication flow. ECHO receives the identity information needed to validate the sign-in and associate it with an account. A Google button is not permission to read your email inbox or other unrelated Google content. Google and hosting providers also have their own privacy terms.

## Journal, draft, and activity information

Information you choose to save can include journal titles and content, drafts, check-ins, preferences, and activity history. Optional features can produce analysis requests and results, recommendation selections, weekly metric contributions, and Buddy handoffs. Trusted-person features use the relationship and permission information needed to evaluate your request.

The service also maintains limited authentication, security, consent, and operational records. A submission idempotency record helps avoid duplicate saves during retries; it uses a server-protected key digest rather than storing the original request key. Worker leases and callback receipts support controlled processing and duplicate-callback handling.

## Purposes and optional processing

ECHO uses information to authenticate you, display and manage saved content, enforce your choices, operate requested features, protect accounts, and investigate service failures. Journal analysis requires both current account-level permission and a request for the individual entry. Declining optional analysis does not by itself prevent private journaling or account creation.

Enabling analysis later does not automatically process old journals. Where an explicitly requested analysis cannot pass its gates, the service returns an error rather than silently treating it as a private save. You can then explicitly turn analysis off and submit a private entry. Separate research, publication, or model-training use is not authorized merely by acknowledging this notice or requesting a reflection result.

## Encryption and authorized access

Journal payloads use authenticated encryption and authorized services decrypt them for permitted reads and requested processing. Encryption does not mean that only your device can read the content: this is not end-to-end encryption. Account access controls, backend authorization, and database isolation remain important protections.

The journal architecture moves legacy plaintext titles into encrypted payloads and uses a non-sensitive compatibility value for new plaintext-title fields. Legacy migration coverage must be verified; do not assume that every historical record has completed that backfill merely because encryption is supported. API and browser title reads must use the decrypted payload.

Private job fields and restricted safety evidence are backend-only. Browser analysis status is limited to the owner identifiers needed for the subscription, job and journal identifiers, status, progress, and update time. It must not include journal content, results, worker credentials, or restricted evidence. No security measure can eliminate every risk; protect your device and account as well.

## Infrastructure and permitted sharing

ECHO uses its backend and Supabase services for application storage and authentication. Optional Google sign-in involves Google. A separately configured analysis worker may process the journal selected for an authorized job. Describing a worker as locally hosted does not mean that authentication, application storage, or every copy of information remains on your personal device.

Access is limited according to service roles and feature permissions. Authorized safety-review personnel or services may access restricted information where the workflow requires review. Analysis workers cannot independently contact trusted people. User-initiated requests must pass permission and relationship checks; a Buddy handoff excludes raw journal content and safety evidence.

## Journal deletion and derived records

Journal deletion starts a 30-day recoverable soft-delete period. At the deletion request, outstanding leases are revoked, nonterminal analysis is cancelled, public status is removed, and further callbacks and new handoffs are rejected. Recoverable does not necessarily mean a self-service Restore button is available in every interface.

After that period, the cleanup workflow purges the encrypted journal and associated jobs, results, recommendation selections, metric contributions, status records, and related handoffs. Affected weekly aggregates are recomputed. Cleanup requires the service task to run; an unavailable service can delay physical removal. A deletion request is not a promise of instantaneous removal from every infrastructure backup.

## Other retention periods

- Active journals and source-derived records remain while the source journal is active, subject to the shorter record-specific limits below.
- Submission idempotency records and rejected reservations expire after 24 hours and must no longer be used for replay after expiry.
- Callback receipts expire 30 days after terminal job completion.
- Buddy handoffs expire after 90 days or when the source journal is purged, whichever comes first.
- Sanitized audits and restricted safety records have a one-year retention limit. Journal or account purge strips source identifiers and identifying metadata from retained records rather than leaving identifiable orphaned data.

These are application retention rules, not a claim about a cloud provider's backup schedule. Account deletion and journal deletion are distinct operations. Account-wide removal, security obligations, and provider-managed copies require the applicable deletion workflow; do not assume removing one journal also removes your identity account.

## Your controls and requests

Use available privacy settings to inspect your choices, withdraw optional analysis permission, and request deletion. Use the application's available export tools to obtain supported data. Availability and request status matter: clicking Request is not confirmation that a complete export or account purge has finished. Keep any downloaded copy secure because it may no longer have application access protections.

Withdrawing analysis permission stops new authorized analysis; it does not automatically delete past results. Delete the source journal to initiate its related deletion workflow. If a control is unavailable or a request fails, ask the ECHO operator through the support channel supplied with your deployment. Do not send journal text, passwords, access tokens, or identity documents in public bug reports.

## Changes and informed acknowledgement

Material notice updates are versioned. You may be asked to review a new set before using gated features. Existing acknowledgements remain associated with their original versions; they are not silently rewritten as acceptance of new text. Review the displayed version and ask for clarification if anything is unclear.

Acknowledging the Privacy Notice confirms that you have reviewed it, not that you have enabled optional analysis or waived choices available to you. The final agreement step and the separate optional-analysis preference serve different purposes. You can close the reader without acknowledging and return when ready.
$policy$),
  ('ai_analysis_notice', 'AI Analysis Notice', 'Optional per-entry analysis, simulated outputs, processing, safety, and your control.', $policy$
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
$policy$)
), inserted as (
  insert into auth_provisioning.policy_documents
    (document_type, version, title, summary, sanitized_markdown, content_sha256, effective_at)
  select document_type, '2026-08-31.1', title, summary, btrim(markdown, E'\n'),
    encode(extensions.digest(btrim(markdown, E'\n'), 'sha256'), 'hex'), now()
  from content
  returning id, document_type
)
select auth_provisioning.activate_policy_set(
  (array_agg(id) filter (where document_type = 'terms_of_use'))[1],
  (array_agg(id) filter (where document_type = 'privacy_notice'))[1],
  (array_agg(id) filter (where document_type = 'ai_analysis_notice'))[1]
) from inserted;

