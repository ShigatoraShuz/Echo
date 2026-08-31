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
