# Echo service-schema ERDs

**Repository design as of 6 October 2026.** These nine figures cover the 55 tables in the seven `*_service` schemas and the supporting `ai_analysis` and `auth_provisioning` schemas. They are based on the chronological SQL in `supabase/migrations/`, checked against the repository's **synthetic**, isolated PostgreSQL catalog at `docs/security/DATABASE_CATALOG.json`. They are not a live database inspection. The boxes show selected columns; consult the migrations for complete columns, constraints, indexes, and policies.

Each line represents a **declared foreign key**. `auth_users` means Supabase-managed `auth.users`; other schema-qualified names written with underscores are external tables. A column marked `FK` can be part of a composite foreign key. Tables without lines have no declared relationship to another table shown in that figure. Several foreign keys are `NOT VALID` in the catalog: PostgreSQL enforces them for new changes but historical rows still need validation. The figure notes call out important logical links that are **not** foreign keys. These are logical schemas within one PostgreSQL database, not separately deployed microservices.

## Figure 4.1 — User Service Schema (`user_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    profiles {
        uuid user_id PK
        text display_name
        text account_status
        boolean onboarding_completed
    }
    user_consents {
        uuid id PK
        uuid user_id FK
        text consent_type
        text consent_version
        boolean accepted
    }
    notification_preferences {
        uuid user_id PK
        boolean in_app_enabled
        boolean insight_notifications_enabled
    }
    privacy_preferences {
        uuid user_id PK
        boolean facial_analysis_enabled
        boolean journal_ai_analysis_enabled
    }
    trusted_contacts {
        uuid id PK
        uuid user_id FK
        text contact_name
        boolean is_primary
    }
    data_export_requests {
        uuid id PK
        uuid user_id FK
        text request_status
    }
    export_artifacts {
        uuid request_id PK
        uuid user_id FK
        text ciphertext
    }
    account_deletion_requests {
        uuid id PK
        uuid user_id FK
        text request_status
    }
    audit_events {
        uuid id PK
        uuid user_id FK
        uuid actor_user_id FK
        text event_type
    }
    security_events {
        uuid id PK
        text event_type
        text actor_hash
        text outcome
    }

    auth_users ||--o| profiles : owns
    auth_users ||--o{ user_consents : accepts
    auth_users ||--o| notification_preferences : configures
    auth_users ||--o| privacy_preferences : configures
    auth_users ||--o{ trusted_contacts : lists
    auth_users ||--o{ data_export_requests : requests
    auth_users ||--o{ export_artifacts : owns
    auth_users ||--o{ account_deletion_requests : requests
    auth_users o|--o{ audit_events : subject
    auth_users o|--o{ audit_events : actor
    data_export_requests ||--o| export_artifacts : produces
```

`security_events` uses hashed request/actor information and has no account foreign key. The `user_id` links above point to `auth.users`, not to `user_service.profiles`.

## Figure 4.2 — Journal Service Schema (`journal_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    journals {
        uuid id PK
        uuid user_id FK
        text content_ciphertext
        boolean analysis_consent
    }
    journal_drafts {
        uuid user_id PK
        text content_ciphertext
        uuid submission_key
    }
    journal_analyses {
        uuid id PK
        uuid journal_id
        uuid user_id FK
        uuid request_id UK
        text status
    }
    journal_images {
        uuid id PK
        uuid journal_id FK
        uuid user_id FK
        text storage_path UK
    }
    image_deletion_queue {
        text storage_path PK
    }

    auth_users ||--o{ journals : owns
    auth_users ||--o| journal_drafts : drafts
    auth_users ||--o{ journal_analyses : owns
    auth_users ||--o{ journal_images : owns
    journals ||--o{ journal_images : contains
```

`journal_analyses.journal_id` identifies a journal but has **no declared FK** to `journals`. Its `request_id` is unique but has no declared FK to `ai_analysis.analysis_requests`. `image_deletion_queue.storage_path` is likewise not a foreign key to `journal_images.storage_path`. The catalog lists the `journal_analyses.user_id` FK as `NOT VALID`.

## Figure 4.3 — Buddy Service Schema (`buddy_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    buddy_conversations {
        uuid id PK
        uuid user_id FK
        text title
    }
    buddy_messages {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        text role
        text content
    }
    buddy_feedback {
        uuid id PK
        uuid message_id FK
        uuid user_id FK
        int rating
    }
    recommendation_handoffs {
        uuid id PK
        uuid user_id FK
        uuid analysis_result_id FK
        uuid recommendation_selection_id FK
        jsonb approved_context
    }
    ai_analysis_analysis_results {
        uuid id PK
    }
    ai_analysis_recommendation_selections {
        uuid id PK
    }

    auth_users ||--o{ buddy_conversations : owns
    auth_users ||--o{ buddy_messages : owns
    auth_users ||--o{ buddy_feedback : owns
    auth_users ||--o{ recommendation_handoffs : owns
    buddy_conversations ||--o{ buddy_messages : contains
    buddy_messages ||--o{ buddy_feedback : receives
    ai_analysis_analysis_results ||--o{ recommendation_handoffs : supplies
    ai_analysis_recommendation_selections ||--o{ recommendation_handoffs : approves
```

The message-to-conversation and feedback-to-message links use composite FKs that include `user_id`, so ownership must match. The catalog lists those composite FKs and the account FKs on conversations, messages, and feedback as `NOT VALID`. The ERD describes storage relationships; it does not establish that Buddy uses a trained conversational model.

## Figure 4.4 — Grounding Service Schema (`grounding_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    grounding_sessions {
        uuid id PK
        uuid user_id FK
        text exercise_type
        int duration_seconds
        boolean completed
    }
    breathing_sessions {
        uuid id PK
        uuid user_id FK
        text pattern
        int total_cycles
        int duration_seconds
    }
    support_resources {
        uuid id PK
        char country_code
        text region_code
        text resource_name
        boolean is_verified
    }

    auth_users ||--o{ grounding_sessions : performs
    auth_users ||--o{ breathing_sessions : performs
```

`support_resources` is an independent reviewed directory. The two session-to-account FKs are `NOT VALID` in the catalog.

## Figure 4.5 — Insights Service Schema (`insights_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    mood_entries {
        uuid id PK
        uuid user_id FK
        int mood_score
        int energy_score
    }
    insight_snapshots {
        uuid id PK
        uuid user_id FK
        text insight_type
        timestamptz window_start
        timestamptz window_end
    }
    weekly_analysis_metrics {
        uuid id PK
        uuid user_id FK
        date period_start
        text aggregate_version
        int source_count
    }
    phq8_assessments {
        uuid id PK
        uuid user_id FK
        uuid submission_id
        text assessment_ciphertext
        smallint score
    }
    support_prompt_state {
        uuid user_id PK
        timestamptz last_prompted_at
    }

    auth_users ||--o{ mood_entries : records
    auth_users ||--o{ insight_snapshots : receives
    auth_users ||--o{ weekly_analysis_metrics : owns
    auth_users ||--o{ phq8_assessments : submits
    auth_users ||--o| support_prompt_state : has
```

The unique key on `phq8_assessments` is **composite** `(user_id, submission_id)`; `submission_id` alone is not declared unique. Weekly metrics are derived from analysis data but have no FK to an `ai_analysis` table. `mood_entries` and `insight_snapshots` account FKs are `NOT VALID` in the catalog. A PHQ-8 assessment is a user's questionnaire submission, not a model prediction.

## Figure 4.6 — Notification Service Schema (`notification_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    notifications {
        uuid id PK
        uuid user_id FK
        text notification_type
        timestamptz read_at
    }
    notification_logs {
        uuid id PK
        uuid notification_id
        text channel
        text delivery_status
    }
    support_contact_requests {
        uuid id PK
        uuid user_id FK
        uuid trusted_contact_id FK
        uuid safety_event_id FK
        text status
    }
    user_service_trusted_contacts {
        uuid id PK
    }
    ai_analysis_safety_events {
        uuid id PK
    }

    auth_users ||--o{ notifications : receives
    auth_users ||--o{ support_contact_requests : requests
    user_service_trusted_contacts ||--o{ support_contact_requests : targets
    ai_analysis_safety_events o|--o{ support_contact_requests : motivates
```

Although `notification_logs.notification_id` is used as a logical link to `notifications.id`, **no FK is declared** between them. `notifications.user_id` is a `NOT VALID` FK in the catalog. The safety event link is nullable.

## Figure 4.7 — Verification Service Schema (`verification_service`)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    verification_admins {
        uuid user_id PK
        boolean is_active
    }
    identity_verifications {
        uuid id PK
        uuid user_id FK
        text verification_status
        uuid reviewed_by
    }
    verification_documents {
        uuid id PK
        uuid verification_id FK
        uuid user_id FK
        text storage_path
        text scan_status
    }
    verification_reviews {
        uuid id PK
        uuid verification_id FK
        uuid admin_user_id
        text decision
    }

    auth_users ||--o| verification_admins : authorizes
    auth_users ||--o{ identity_verifications : submits
    auth_users ||--o{ verification_documents : owns
    identity_verifications ||--o{ verification_documents : includes
    identity_verifications ||--o{ verification_reviews : receives
```

The document-to-verification FK is composite `(verification_id, user_id)` and is `NOT VALID`. The review-to-verification FK is also `NOT VALID`. `identity_verifications.reviewed_by` and `verification_reviews.admin_user_id` identify reviewers but have **no declared FKs** to `verification_admins` in this schema.

## Figure 4.8 — AI Analysis Schema (`ai_analysis`)

```mermaid
erDiagram
    model_versions {
        uuid id PK
        text model_name
        text provider
        boolean active
    }
    analysis_requests {
        uuid id PK
        uuid request_id UK
        uuid user_id FK
        uuid journal_id FK
        uuid model_version_id FK
        text status
    }
    analysis_results {
        uuid id PK
        uuid analysis_request_id FK
        uuid user_id FK
        text schema_version
        boolean is_simulated
    }
    facial_analysis_results {
        uuid id PK
        uuid analysis_request_id FK
        uuid user_id FK
        text detected_emotion
    }
    risk_signal_snapshots {
        uuid id PK
        uuid analysis_result_id FK
        uuid user_id FK
        text band
    }
    safety_events {
        uuid id PK
        uuid analysis_request_id FK
        uuid user_id FK
        text severity
    }
    safety_reviews {
        uuid id PK
        uuid safety_event_id FK
        uuid job_id FK
        uuid reviewer_id FK
        text decision
    }
    safety_reviewers {
        uuid user_id PK
        boolean active
    }
    prompt_templates {
        uuid id PK
        text template_key UK
        text feature_scope
    }
    analysis_audit_log {
        uuid id PK
        uuid analysis_request_id FK
        uuid user_id FK
        text action
    }
    idempotency_records {
        uuid id PK
        uuid user_id FK
        text operation
        text key_hmac
    }
    callback_receipts {
        uuid id PK
        uuid job_id FK
        text key_hmac
        text callback_type
    }
    transition_receipts {
        uuid id PK
        uuid job_id FK
        text transition_key
        text to_status
    }
    recommendation_rules {
        uuid id PK
        text rule_version
        text feature
    }
    recommendation_selections {
        uuid id PK
        uuid analysis_result_id FK
        uuid rule_id FK
        uuid user_id FK
    }
    aggregation_tasks {
        uuid id PK
        uuid analysis_result_id FK
        uuid user_id FK
        date period_start
        text status
    }
    worker_health {
        text worker_id PK
        timestamptz last_heartbeat_at
    }
    quota_policy {
        boolean singleton PK
        int per_user_daily
        int global_daily
    }
    journal_service_journals {
        uuid id PK
    }

    model_versions o|--o{ analysis_requests : selected_for
    journal_service_journals o|--o{ analysis_requests : source
    analysis_requests ||--o{ analysis_results : yields
    analysis_requests ||--o{ facial_analysis_results : yields
    analysis_requests o|--o{ safety_events : flags
    analysis_requests o|--o{ analysis_audit_log : records
    analysis_requests ||--o{ callback_receipts : receives
    analysis_requests ||--o{ transition_receipts : transitions
    analysis_requests ||--o{ safety_reviews : pauses_for
    analysis_results o|--o{ risk_signal_snapshots : derives
    analysis_results ||--o| recommendation_selections : selects
    analysis_results ||--o{ aggregation_tasks : queues
    recommendation_rules ||--o{ recommendation_selections : chooses
    safety_events ||--o{ safety_reviews : reviewed_by
```

The diagram emphasizes the analysis workflow. Account FKs to `auth.users` also exist on `analysis_requests`, `analysis_results`, `facial_analysis_results`, `risk_signal_snapshots`, `safety_events`, `safety_reviews.reviewer_id`, `safety_reviewers`, `analysis_audit_log`, `idempotency_records`, `recommendation_selections`, and `aggregation_tasks`; they are omitted from this dense figure. The `facial_analysis_results` and `risk_signal_snapshots` account FKs are `NOT VALID`. `safety_reviewers` authorizes reviewers, but `safety_reviews.reviewer_id` references `auth.users`, not that table. `prompt_templates`, `idempotency_records`, `worker_health`, and `quota_policy` have no declared intra-schema FKs. The existence of facial and model tables does not establish deployed, validated AI inference.

## Figure 4.9 — Authentication Provisioning Schema (`auth_provisioning`)

```mermaid
erDiagram
    settings {
        boolean singleton PK
        boolean enforcement_enabled
    }
    policy_documents {
        uuid id PK
        text document_type
        text version
        boolean is_active
    }
    signup_drafts {
        uuid id PK
        text token_hash UK
        uuid terms_document_id FK
        uuid privacy_document_id FK
        uuid ai_notice_document_id FK
        text state
    }

    policy_documents o|--o{ signup_drafts : terms_version
    policy_documents o|--o{ signup_drafts : privacy_version
    policy_documents o|--o{ signup_drafts : ai_notice_version
```

`policy_documents` has a composite unique key `(document_type, version)`. `settings` is a standalone singleton. The repository migration initially created provisioning enforcement disabled, so deployment-specific enforcement requires a target-database check.

## Cross-schema status projection

`public.analysis_status_projection` is a small, owner-readable progress table, **not** another service schema. Its `job_id` primary key references `ai_analysis.analysis_requests.id`; `journal_id` references `journal_service.journals.id`; and `user_id` references `auth.users.id`. Legacy `public` tables are omitted because the service tables above are the canonical domain grouping described in the reference. Check the target database before calling these figures deployed ERDs.
