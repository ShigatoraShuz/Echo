## Information ECHO uses

ECHO stores the information needed for account access and the features you use: identity/session details, profile and onboarding preferences, policy acknowledgements, optional permissions, journals and drafts, mood or assessment records, Buddy conversations, grounding sessions, notifications, and export or deletion requests.

Age eligibility is derived from the birthday you submit; the registration draft records the eligibility outcome rather than retaining the birthday. Temporary signup drafts contain hashed browser credentials, current policy identifiers, and email or verified Google identity bindings. Drafts expire, but expiry alone does not physically erase a database row.

Identity verification may require application details and private evidence files. Reviewers access evidence through the authorized verification workflow and short-lived file links. Account identity verification is separate from journal-analysis consent.

## Access and encryption

Supabase Auth handles identity and sessions. Protected application data passes through the API Gateway to the service that owns that domain. The services share one physical database with canonical public tables, restricted service roles, and separate credentials. Browser credentials cannot directly query protected tables.

Journal payloads and other configured sensitive content are encrypted at rest. Authorized services hold the keys necessary to decrypt content for requested operations. This is not end-to-end encryption and does not mean the server can never read journal text. Verification files are private; avatars use a separate restricted storage path.

## Optional processing

Analysis requires account-level optional permission, entry consent, and an explicit request. Journal Service supplies the selected decrypted journal to Analysis Service and the self-hosted ML Service. Recommendation Service receives the screening severity and urgent-language flag, not the journal text. Declining optional analysis does not prevent ordinary journaling.

Saved analysis records contain status, screening results when available, timestamps, and failure information. Withdrawing permission prevents subsequent authorized analysis requests; it does not itself erase earlier results or cancel a request already in progress.

## Your controls and exports

Settings let you update supported profile, privacy, and notification preferences and maintain trusted contact details. ECHO does not automatically contact those people or share reflections with them.

The journal PDF export is generated in your browser from your journal history and self-reported moods. It is not a complete database archive. Downloaded files can be read by anyone with access to them, even if a watermark says private. Store and share them carefully.

## Deletion and retention

Journal deletion removes the selected journal through Journal Service and its database relationships. There is no supported recoverable journal trash or promised 30-day journal retention period in this implementation.

Account deletion is a tracked request, not proof that all records have already been removed. Operator handling, backups, audit requirements, and infrastructure retention can affect completion. Consult the deployment operator about retention and backup policies before storing information that requires a particular erasure guarantee.

## Operational limits and questions

Services use request identifiers, status codes, and audit records for security and operation. Do not put credentials or unnecessary journal content into support reports. ECHO is not an emergency monitoring service and does not promise that a human reviews your content.

This notice describes repository behavior, not a legal compliance certification. The operator must supply deployment-specific contact, hosting, retention, and privacy information. Changes to required notices are versioned and presented for acknowledgement.
