# Account export coverage

Review: 2026-09-20. Local implementation and synthetic tests; not deployed verification. No actual account was exported.

The account JSON path creates a fixed-schema snapshot for the verified user, reads account email/creation time from managed Auth, decrypts existing encrypted fields in process memory, and encrypts the complete temporary archive before persistence. Five child collections use parent-owner joins. The snapshot function is a narrowly scoped service-only SECURITY DEFINER function to read locked-down historical tables; all other export lifecycle functions are invokers. No browser role can execute them or read export_artifacts.

Generation and download both require signed recent authentication within ten minutes. The download is a no-store attachment, with no bearer token in a URL. The database atomically consumes the ciphertext once and writes the download audit. Decrypted owner/request identifiers must match the authenticated request. A failed delivery after consumption requires a new request; no replayable public URL is issued. Exports expire after 24 hours, independently of the 30-second cleanup timer. Cleanup also marks abandoned processing requests failed after ten minutes.

Limits: three requests per user and 200 globally per rolling day; two concurrent generation/download operations per backend process; 2,500 rows per collection; 24 MB plaintext package; 16 attachments; 8 MB per object; a 60-second file-collection budget checked between bounded Storage calls. A failed/over-limit package is never marked completed. Large-account delivery still needs an approved streaming/manual process; this is an outstanding release concern.

Private journal photos marked uploaded, clean verification documents, and owner-prefixed avatars are included as base64 attachments. Paths must match the authenticated owner, contain only canonical safe segments, and are fetched through the configured Supabase Storage SDK, never an arbitrary URL. Unscanned/quarantined legacy verification documents remain metadata-only. Authentication credentials, worker lease/idempotency secrets, authority lists, operator-only receipts, provider copies and backup archives are not included. Provider data requests and backup expiry remain separate, unfinished operational processes. Historical encrypted fields must be readable under the configured approved keyring; an unreadable field fails the export rather than silently dropping it.

The existing journal PDF stays available and does not require collecting unrelated account attachments. It uses a dedicated recent-authentication gate that requires a successful audit insertion before the browser loads journal data and formats the report. Browser-generated PDF bytes are not persisted server-side. Neither JSON nor PDF is written into browser localStorage/sessionStorage. Downloads are explicitly initiated by the user; downloaded plaintext files are outside server expiry control.

## Snapshot collections (62)

- ai_analysis.analysis_audit_log
- ai_analysis.analysis_requests
- ai_analysis.analysis_results
- ai_analysis.facial_analysis_results
- ai_analysis.recommendation_selections
- ai_analysis.risk_signal_snapshots
- ai_analysis.safety_events
- buddy_service.buddy_conversations
- buddy_service.buddy_feedback
- buddy_service.buddy_messages
- buddy_service.recommendation_handoffs
- grounding_service.breathing_sessions
- grounding_service.grounding_sessions
- insights_service.insight_snapshots
- insights_service.mood_entries
- insights_service.phq8_assessments
- insights_service.support_prompt_state
- insights_service.weekly_analysis_metrics
- journal_service.journal_analyses
- journal_service.journal_drafts
- journal_service.journal_images
- journal_service.journals
- notification_service.notifications
- notification_service.support_contact_requests
- public.account_deletion_requests
- public.analysis_feedback
- public.analysis_status_projection
- public.audit_events
- public.buddy_conversations
- public.buddy_messages
- public.deletion_requests
- public.grounding_sessions
- public.identity_verifications
- public.journal_analyses
- public.journal_drafts
- public.journals
- public.lab_entries
- public.mood_entries
- public.notification_preferences
- public.notifications
- public.privacy_preferences
- public.profiles
- public.safety_events
- public.trusted_contacts
- public.user_consents
- public.user_preferences
- public.user_profiles
- public.verification_documents
- user_service.account_deletion_requests
- user_service.audit_events
- user_service.notification_preferences
- user_service.privacy_preferences
- user_service.profiles
- user_service.trusted_contacts
- user_service.user_consents
- verification_service.identity_verifications
- verification_service.verification_documents
- public.analysis_windows
- public.safety_event_resources
- notification_service.notification_logs
- public.verification_reviews
- verification_service.verification_reviews

## Evidence and remaining coverage

- backend/tests/security/data-export.test.ts: ciphertext persistence, owner/request binding, bytea decryption, tamper rejection, clean/quarantine behavior, path isolation and storage failure.
- supabase/tests/database/security-export-lifecycle.sql: owner snapshots, unavailable foreign IDs, atomic completion, no plaintext artifact, single use, expiry, cleanup, audit and direct-browser RPC denial.
- Settings route tests: verified owner passed to delivery; stale/missing authentication rejected; attachment/no-store headers.
- Frontend settings service tests: bearer header, encoded identifier, no-store and stable failure messages.
- Actual PostgREST/Storage, browser account switching, legacy encryption compatibility, large-account delivery and an independent completeness review remain unverified. This document does not claim account deletion is implemented.
