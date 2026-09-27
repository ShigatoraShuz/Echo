# Database grants and policy matrix

Review: 2026-09-21. Generated from isolated migration replay, not a deployed snapshot. Reproduce: `npm run test:sql:isolated -- --catalog`. [DATABASE_CATALOG.json](DATABASE_CATALOG.json) contains 87 tables/views, 62 functions, 207 application-table policies, columns, table/column/schema/default grants, triggers and constraints. Inclusion is not independent policy verification.

Private browser access remains deny-by-default except explicit owner-scoped grants for settings, notifications, journal content/drafts, Buddy history, grounding history and consent reads. Legacy public CRUD is revoked except owner-readable analysis status projection. All 87 application tables plus Storage objects have an authenticated RESTRICTIVE live-session/account-status policy. It composes with the owner policies and does not grant access by itself. Already-issued signed object URLs remain bearer tickets until their short expiry.

Runtime cannot rewrite audit evidence or policy budgets. The fixed export snapshot is a service-only definer. Assessment saves, compare-and-swap migration and privacy request transitions are service-only invokers. No browser grants were added for these operations.

| Schema.object | Kind | RLS | Policies | Evidence / review state |
| --- | --- | --- | --- | --- |
| ai_analysis.aggregation_tasks | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.analysis_audit_log | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.analysis_requests | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.analysis_results | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.callback_receipts | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.facial_analysis_results | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.idempotency_records | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.model_versions | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.prompt_templates | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.quota_policy | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.recommendation_rules | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.recommendation_selections | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.risk_signal_snapshots | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.safety_events | r | true | 2 | Isolated SQL tests; deployed action review pending |
| ai_analysis.safety_reviewers | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.safety_reviews | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.transition_receipts | r | true | 1 | Isolated SQL tests; deployed action review pending |
| ai_analysis.worker_health | r | true | 1 | Isolated SQL tests; deployed action review pending |
| auth_provisioning.policy_documents | r | true | 1 | Isolated SQL tests; deployed action review pending |
| auth_provisioning.settings | r | true | 1 | Isolated SQL tests; deployed action review pending |
| auth_provisioning.signup_drafts | r | true | 1 | Isolated SQL tests; deployed action review pending |
| buddy_service.buddy_conversations | r | true | 5 | Isolated SQL tests; deployed action review pending |
| buddy_service.buddy_feedback | r | true | 3 | Isolated SQL tests; deployed action review pending |
| buddy_service.buddy_messages | r | true | 3 | Isolated SQL tests; deployed action review pending |
| buddy_service.recommendation_handoffs | r | true | 1 | Isolated SQL tests; deployed action review pending |
| grounding_service.breathing_sessions | r | true | 3 | Isolated SQL tests; deployed action review pending |
| grounding_service.grounding_sessions | r | true | 4 | Isolated SQL tests; deployed action review pending |
| grounding_service.support_resources | r | true | 2 | Isolated SQL tests; deployed action review pending |
| insights_service.insight_snapshots | r | true | 1 | Isolated SQL tests; deployed action review pending |
| insights_service.mood_entries | r | true | 5 | Isolated SQL tests; deployed action review pending |
| insights_service.phq8_assessments | r | true | 1 | Isolated SQL tests; deployed action review pending |
| insights_service.support_prompt_state | r | true | 1 | Isolated SQL tests; deployed action review pending |
| insights_service.weekly_analysis_metrics | r | true | 1 | Isolated SQL tests; deployed action review pending |
| journal_service.image_deletion_queue | r | true | 1 | Isolated SQL tests; deployed action review pending |
| journal_service.journal_analyses | r | true | 2 | Isolated SQL tests; deployed action review pending |
| journal_service.journal_drafts | r | true | 5 | Isolated SQL tests; deployed action review pending |
| journal_service.journal_images | r | true | 1 | Isolated SQL tests; deployed action review pending |
| journal_service.journals | r | true | 5 | Isolated SQL tests; deployed action review pending |
| notification_service.notification_logs | r | true | 1 | Isolated SQL tests; deployed action review pending |
| notification_service.notifications | r | true | 3 | Isolated SQL tests; deployed action review pending |
| notification_service.support_contact_requests | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.account_deletion_requests | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.analysis_feedback | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.analysis_status_projection | r | true | 2 | Isolated SQL tests; deployed action review pending |
| public.analysis_windows | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.audit_events | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.buddy_conversations | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.buddy_messages | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.data_export_requests | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.deletion_requests | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.export_requests | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.grounding_sessions | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.identity_verifications | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.journal_analyses | r | true | 2 | Isolated SQL tests; deployed action review pending |
| public.journal_drafts | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.journals | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.lab_entries | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.model_versions | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.mood_entries | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.notification_preferences | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.notifications | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.privacy_preferences | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.profiles | r | true | 3 | Isolated SQL tests; deployed action review pending |
| public.safety_event_resources | r | true | 2 | Isolated SQL tests; deployed action review pending |
| public.safety_events | r | true | 2 | Isolated SQL tests; deployed action review pending |
| public.support_resources | r | true | 2 | Isolated SQL tests; deployed action review pending |
| public.trusted_contacts | r | true | 5 | Isolated SQL tests; deployed action review pending |
| public.user_consents | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.user_preferences | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.user_profiles | r | true | 4 | Isolated SQL tests; deployed action review pending |
| public.verification_admins | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.verification_documents | r | true | 1 | Isolated SQL tests; deployed action review pending |
| public.verification_reviews | r | true | 1 | Isolated SQL tests; deployed action review pending |
| user_service.account_deletion_requests | r | true | 2 | Isolated SQL tests; deployed action review pending |
| user_service.audit_events | r | true | 2 | Isolated SQL tests; deployed action review pending |
| user_service.data_export_requests | r | true | 2 | Isolated SQL tests; deployed action review pending |
| user_service.export_artifacts | r | true | 1 | Isolated SQL tests; deployed action review pending |
| user_service.notification_preferences | r | true | 4 | Isolated SQL tests; deployed action review pending |
| user_service.privacy_preferences | r | true | 4 | Isolated SQL tests; deployed action review pending |
| user_service.profiles | r | true | 4 | Isolated SQL tests; deployed action review pending |
| user_service.security_events | r | true | 1 | Isolated SQL tests; deployed action review pending |
| user_service.trusted_contacts | r | true | 5 | Isolated SQL tests; deployed action review pending |
| user_service.user_consents | r | true | 3 | Isolated SQL tests; deployed action review pending |
| verification_service.identity_verifications | r | true | 2 | Isolated SQL tests; deployed action review pending |
| verification_service.verification_admins | r | true | 2 | Isolated SQL tests; deployed action review pending |
| verification_service.verification_documents | r | true | 2 | Isolated SQL tests; deployed action review pending |
| verification_service.verification_reviews | r | true | 2 | Isolated SQL tests; deployed action review pending |

| Function(signature) | Definer | anon execute | authenticated execute | Configuration |
| --- | --- | --- | --- | --- |
| ai_analysis.advance_stub_job(p_job_id uuid, p_expected text, p_status text, p_attempt integer, p_progress integer) | true | false | false | search_path="" |
| ai_analysis.apply_worker_callback(p_job_id uuid, p_type text, p_key_hmac text, p_payload_hash text, p_worker_id text, p_lease_hash text, p_payload jsonb) | true | false | false | search_path="" |
| ai_analysis.claim_worker_job(p_worker_id text, p_lease_hash text) | true | false | false | search_path="" |
| ai_analysis.complete_journal_analysis(p_job_id uuid, p_result jsonb) | true | false | false | search_path=public, ai_analysis, user_service |
| ai_analysis.complete_worker_callback(p_job_id uuid, p_result jsonb, p_callback_type text, p_key_hmac text, p_payload_hash text, p_worker_id text, p_lease_token_hash text) | true | false | false | search_path=public, ai_analysis |
| ai_analysis.current_gates_allow(p_user_id uuid) | true | false | false | search_path="" |
| ai_analysis.enforce_admission_budget() | true | false | false | search_path="" |
| ai_analysis.enforce_result_immutability() | false | false | false |  |
| ai_analysis.guard_job_transition() | false | false | false | search_path="" |
| ai_analysis.job_gates_allow(p_job_id uuid) | true | false | false | search_path="" |
| ai_analysis.lookup_worker_receipt(p_job_id uuid, p_type text, p_key_hmac text, p_payload_hash text, p_worker_id text, p_lease_hash text) | true | false | false | search_path="" |
| ai_analysis.project_job_status() | true | false | false | search_path="" |
| ai_analysis.release_expired_worker_leases() | true | false | false | search_path="" |
| ai_analysis.requeue_job(p_job_id uuid, p_mode text, p_transition_key text) | true | false | false | search_path="" |
| ai_analysis.reserve_rejected_submission(p_user_id uuid, p_version text, p_hmac text, p_hash text, p_code text) | true | false | false | search_path="" |
| ai_analysis.resolve_safety_review(p_reviewer uuid, p_job_id uuid, p_decision text, p_key text) | true | false | false | search_path="" |
| ai_analysis.run_aggregation_tasks(p_limit integer) | true | false | false | search_path="" |
| ai_analysis.run_retention(p_dry_run boolean) | true | false | false | search_path=public, ai_analysis, journal_service, buddy_service, user_service |
| auth_provisioning.activate_policy_set(terms_id uuid, privacy_id uuid, ai_notice_id uuid) | true | false | false | search_path="" |
| auth_provisioning.before_user_created(event jsonb) | true | false | false | search_path="" |
| auth_provisioning.provision_new_user() | true | false | false | search_path="" |
| buddy_service.guard_analysis_handoff() | true | false | false | search_path="" |
| buddy_service.replace_message_ciphertext(p_id uuid, p_user_id uuid, p_expected_digest text, p_ciphertext text) | false | false | false | search_path="" |
| insights_service.claim_support_prompt(p_user_id uuid, p_threshold integer, p_window_days integer, p_cooldown_days integer) | true | false | false | search_path="" |
| insights_service.recent_concerning_journals(p_user_id uuid, p_window_days integer) | true | false | false | search_path="" |
| insights_service.recompute_analysis_week(p_user uuid, p_period date) | true | false | false | search_path="" |
| insights_service.replace_assessment_ciphertext(p_id uuid, p_user_id uuid, p_submission_id uuid, p_expected_ciphertext text, p_expected_responses smallint[], p_expected_score integer, p_expected_severity text, p_ciphertext text) | false | false | false | search_path="" |
| insights_service.save_encrypted_phq8(p_user_id uuid, p_submission_id uuid, p_ciphertext text, p_interval_days integer) | false | false | false | search_path="" |
| insights_service.save_phq8(p_user_id uuid, p_submission_id uuid, p_responses smallint[], p_interval_days integer) | true | false | false | search_path="" |
| insights_service.score_phq8_answers() | false | false | false | search_path="" |
| journal_service.anonymize_journal_purge() | true | false | false | search_path="" |
| journal_service.anonymize_legacy_journal_purge() | true | false | false | search_path="" |
| journal_service.cancel_deleted_journal() | true | false | false | search_path="" |
| journal_service.enforce_encrypted_title_sentinel() | false | false | false |  |
| journal_service.enforce_journal_image_uploaded_limit() | true | false | false | search_path="" |
| journal_service.guard_legacy_plaintext() | false | false | false |  |
| journal_service.queue_image_deletion() | true | false | false | search_path="" |
| journal_service.remove_deleted_journal_images() | true | false | false | search_path="" |
| journal_service.reserve_journal_image(p_user_id uuid, p_journal_id uuid, p_image_id uuid, p_hash text, p_mime_type text) | true | false | false | search_path="" |
| journal_service.submit_draft_journal(p_user_id uuid, p_title_sentinel text, p_content_ciphertext text, p_encryption_iv text, p_encryption_auth_tag text, p_encryption_key_version integer, p_word_count integer, p_mood text, p_emotions jsonb, p_tags jsonb, p_privacy_status text, p_analysis_requested boolean, p_initial_status text, p_fixture text, p_processing_mode text, p_idempotency_key_version text, p_idempotency_hmac text, p_request_hash text, p_draft_key uuid) | true | false | false | search_path="" |
| journal_service.submit_journal(p_user_id uuid, p_title_sentinel text, p_content_ciphertext text, p_encryption_iv text, p_encryption_auth_tag text, p_encryption_key_version integer, p_word_count integer, p_mood text, p_emotions jsonb, p_tags jsonb, p_privacy_status text, p_analysis_requested boolean, p_initial_status text, p_fixture text, p_processing_mode text, p_idempotency_key_version text, p_idempotency_hmac text, p_request_hash text) | true | false | false | search_path=public, journal_service, ai_analysis, user_service |
| notification_service.guard_support_contact_request() | true | false | false | search_path="" |
| notification_service.notify_completed_journal_analysis() | true | false | false | search_path="" |
| public.echo_google_identity_status(google_subject text, verified_email text) | true | false | false | search_path="" |
| public.echo_registration_active_policies() | true | false | false | search_path=pg_catalog |
| public.echo_registration_create_draft(new_token_hash text, new_csrf_hash text, new_rule_version text, new_expires_at timestamp with time zone) | true | false | false | search_path=pg_catalog |
| public.echo_registration_get_draft(draft_token_hash text) | true | false | false | search_path=pg_catalog |
| public.echo_registration_update_draft(draft_id uuid, expected_token_hash text, expected_state text, changes jsonb) | true | false | false | search_path=pg_catalog |
| public.phq8_severity(score smallint) | false | false | false | search_path="" |
| public.security_request_active() | true | false | true | search_path="" |
| public.set_updated_at() | false | false | false | search_path=public |
| user_service.anonymize_analysis_account_purge() | true | false | false | search_path="" |
| user_service.begin_data_export(p_user_id uuid) | false | false | false | search_path="" |
| user_service.cancel_account_deletion(p_user_id uuid, p_request_id uuid) | false | false | false | search_path="" |
| user_service.collect_user_export(p_user_id uuid) | true | false | false | search_path=""; statement_timeout=30s |
| user_service.consume_data_export(p_user_id uuid, p_request_id uuid) | false | false | false | search_path="" |
| user_service.expire_data_exports() | false | false | false | search_path="" |
| user_service.finish_data_export(p_user_id uuid, p_request_id uuid, p_ciphertext text) | false | false | false | search_path="" |
| user_service.has_valid_trusted_contact(p_user_id uuid) | true | false | false | search_path="" |
| user_service.request_account_deletion(p_user_id uuid) | false | false | false | search_path="" |
| user_service.save_trusted_contact(p_contact_id uuid, p_contact_name text, p_contact_email text, p_contact_phone text, p_relationship text, p_is_primary boolean, p_permission_acknowledged boolean) | false | false | true | search_path="" |
| user_service.security_session_active(p_user_id uuid, p_session_id uuid) | true | false | false | search_path="" |

NOT VALID owner/ciphertext constraints enforce new writes but preserve older rows for reviewed remediation. No remote constraint validation or data backfill was executed. PGlite uses synthetic Auth/Storage scaffolding and cannot establish PostgREST exposure, hosted Auth behavior, live Storage policies, realtime or operational permissions. Supabase-generated database types remain incomplete.
