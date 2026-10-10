# Echo database schemas by service

**Repository schema reference (6 October 2026).** This is a labeled, complete table inventory for the service-oriented PostgreSQL schemas defined in Echo's migration files. It describes the repository's schema design, not a fresh inspection of a deployed database. The source of truth for every column type, constraint, index, and policy is the chronological SQL in `supabase/migrations/`; the inventory was cross-checked against `docs/security/DATABASE_CATALOG.json`, which identifies itself as an isolated synthetic PostgreSQL catalog. Column names below are selected keys that make each relationship understandable, not a substitute for the full migration DDL. An apparent relationship through `user_id` is not necessarily a declared foreign key in every table.

All eight `*_service` schemas and `ai_analysis` are logical namespaces inside one PostgreSQL database. They do not imply that Echo has nine separately deployed microservices. Supabase's `auth.users` identifies accounts, and protected application operations run through the Express backend. The additional `auth_provisioning` schema supports signup, while `public` retains compatibility objects and an owner-readable status projection.

## Schema A — `user_service` (10 tables)

This schema holds account profile data, choices about consent and communication, trusted contacts, and requests concerning personal data. Its principal ownership link is `user_id` to the authenticated account. Export and deletion records remain separate from the profile so their status can be audited. The backend's settings and registration modules use this schema; it is a data domain, not a standalone service process.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `profiles` | `user_id` → `auth.users.id` | Stores display name, onboarding state, and account eligibility/status. |
| `user_consents` | `id`; `user_id`; consent type/version | Records acceptance or revocation of specific policy and AI permissions. |
| `notification_preferences` | `user_id` | Stores the user's preferred notification channels and reminder settings. |
| `privacy_preferences` | `user_id` | Stores privacy choices, including whether optional facial analysis is enabled. |
| `trusted_contacts` | `id`; `user_id` | Stores user-provided contact details and permission-related state. |
| `data_export_requests` | `id`; `user_id` | Tracks a request for a copy of the user's data. |
| `export_artifacts` | `request_id` → `data_export_requests.id` | Temporarily holds the encrypted result of an export request. |
| `account_deletion_requests` | `id`; `user_id` | Tracks account deletion scheduling, cancellation, and completion. |
| `audit_events` | `id`; `user_id`; `actor_user_id` | Records application events without storing raw journal content. |
| `security_events` | `id`; request and actor hash | Records selected access, denial, and security outcomes for review. |

## Schema B — `journal_service` (5 tables)

This schema owns journal content, autosaved drafts, journal-level analysis records, and private image references. A journal belongs to one user and can have associated images and an analysis request. The image deletion queue allows storage cleanup to continue after the database operation. Journal text and titles are handled through the application's encrypted storage path; analysis results belong primarily to `ai_analysis`, while `journal_analyses` remains a journal-side analysis table in the migration history.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `journals` | `id`; `user_id` | Stores the user's journal metadata, encrypted content, and analysis-consent choice. |
| `journal_drafts` | `user_id` | Stores the current encrypted draft for a user. |
| `journal_analyses` | `id`; `journal_id`; `request_id` | Stores journal-associated analysis state and historical result fields. |
| `journal_images` | `id`; `journal_id` → `journals.id`; `user_id` | Records ownership and private Storage paths for uploaded journal images. |
| `image_deletion_queue` | `storage_path` | Records image objects to remove from Storage after journal or account deletion. |

## Schema C — `buddy_service` (4 tables)

This schema represents the user's Buddy conversation history and feedback. One conversation may have multiple messages, and a message may receive feedback. A recommendation handoff can carry limited, approved context from an analysis result into Buddy without copying journal text. The presence of these tables does not demonstrate that Buddy currently uses a trained conversational model; the reviewed backend path still generates rule-based replies.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `buddy_conversations` | `id`; `user_id` | Groups one user's Buddy messages into a conversation. |
| `buddy_messages` | `id`; `conversation_id`; `user_id` | Stores encrypted user and assistant messages with role and time. |
| `buddy_feedback` | `id`; `message_id`; `user_id` | Stores the user's rating or comment about a Buddy message. |
| `recommendation_handoffs` | `id`; `analysis_result_id`; `recommendation_selection_id` | Stores a limited, expiring link from reviewed analysis guidance to Buddy. |

## Schema D — `grounding_service` (3 tables)

This schema holds records of grounding and breathing activities and the public directory of support resources. Activity records are owned by users, while resource records are reviewed by the application and filtered for active, verified entries. Emergency-resource discovery is designed to work without depending on AI or a signed-in session.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `grounding_sessions` | `id`; `user_id` | Records a completed or attempted grounding exercise and its duration. |
| `breathing_sessions` | `id`; `user_id` | Records a breathing pattern, number of cycles, and duration. |
| `support_resources` | `id`; `country_code`; `region_code` | Stores reviewed help organizations, contact methods, and verification metadata. |

## Schema E — `insights_service` (5 tables)

This schema stores mood information, derived summaries, periodic PHQ-8 questionnaire records, and state for support prompts. The questionnaire table is distinct from AI-estimated symptoms: its encrypted payload contains eight user-selected answers and a backend-calculated score. Weekly analysis metrics are derived from eligible, non-simulated analysis data. A model prediction must not be written up as an actual PHQ-8 response.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `mood_entries` | `id`; `user_id` | Stores a dated mood score, optional energy score, and note. |
| `insight_snapshots` | `id`; `user_id`; time window | Stores a derived insight for a specified period. |
| `weekly_analysis_metrics` | `id`; `user_id`; `period_start`; version | Stores versioned weekly aggregates from eligible completed analyses. |
| `phq8_assessments` | `id`; `user_id`; `submission_id` | Stores an encrypted record of the eight-item self-assessment and its completion time. |
| `support_prompt_state` | `user_id` | Remembers when a follow-up support prompt was last shown. |

## Schema F — `notification_service` (3 tables)

This schema separates notification content from delivery attempts. A notification belongs to a user; a log records channel-specific delivery state. Support-contact requests are tracked separately because any contact action needs user permission and review rather than automatic dispatch after an AI signal.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `notifications` | `id`; `user_id` | Stores in-app notices and their read state. |
| `notification_logs` | `id`; `notification_id` | Tracks a notification's delivery channel and result. |
| `support_contact_requests` | `id`; `user_id`; `trusted_contact_id`; optional `safety_event_id` | Records a user-requested contact action and its review state. |

## Schema G — `verification_service` (4 tables)

This schema manages identity-verification submissions and restricted reviewer activity. A verification submission may have supporting documents and several reviews. Document metadata includes quarantine and scan status; the private files themselves belong in Storage, not in the table. The schema supports account eligibility checks used by protected AI features.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `verification_admins` | `user_id` → `auth.users.id` | Identifies accounts allowed to perform verification administration. |
| `identity_verifications` | `id`; `user_id`; reviewer fields | Tracks a user's verification status and protected details. |
| `verification_documents` | `id`; `verification_id`; `user_id` | Stores private document metadata, Storage path, and scan state. |
| `verification_reviews` | `id`; `verification_id`; `admin_user_id` | Records a review decision and protected reviewer note. |

## Schema H — `ai_analysis` (18 tables)

This schema is the internal analysis domain. Its central relationship is an `analysis_requests` job linked to a journal and followed by an `analysis_results` row if processing completes. Other tables handle facial output, safety events and review, model and prompt versions, idempotent callbacks, recommendations, quotas, and worker health. These are prepared data structures and workflow controls. Their existence does not prove that a validated model has been trained or deployed; the current FastAPI runtime deliberately reports unavailable, and local stub results are simulated.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `model_versions` | `id`; model/provider/version fields | Identifies model artifacts and their lifecycle metadata. |
| `analysis_requests` | `id`; unique `request_id`; `user_id`; `journal_id` | Tracks an analysis job, processing state, consent-related metadata, lease, and progress. |
| `analysis_results` | `id`; `analysis_request_id`; `user_id` | Stores a versioned, protected result payload for a completed job. |
| `facial_analysis_results` | `id`; `analysis_request_id`; `user_id` | Provides a place for future facial-classifier outputs; it is not proof of a working classifier. |
| `risk_signal_snapshots` | `id`; `analysis_result_id`; `user_id` | Holds derived risk-band snapshots if that feature is validated. |
| `safety_events` | `id`; `analysis_request_id`; `user_id` | Records a safety-relevant event with controlled metadata. |
| `safety_reviews` | `id`; `safety_event_id`; `job_id`; `reviewer_id` | Records an authorized review decision for a paused analysis. |
| `safety_reviewers` | `user_id` → `auth.users.id` | Lists accounts permitted to resolve restricted safety reviews. |
| `prompt_templates` | `id`; unique `template_key` | Versions controlled prompts by feature. |
| `analysis_audit_log` | `id`; `analysis_request_id`; `user_id` | Records important analysis actions without raw source text. |
| `idempotency_records` | `id`; `user_id`; operation/key hash | Prevents duplicate submission effects and detects changed retries. |
| `callback_receipts` | `id`; `job_id`; callback key hash | Records worker callbacks so an exact retry can be recognized. |
| `transition_receipts` | `id`; `job_id`; transition key | Records a job-state change once. |
| `recommendation_rules` | `id`; rule version and feature | Stores reviewed, deterministic recommendation choices. |
| `recommendation_selections` | `id`; `analysis_result_id`; `rule_id` | Records which reviewed recommendation was selected for a result. |
| `aggregation_tasks` | `id`; `analysis_result_id`; period/version | Queues retryable updates to weekly insights. |
| `worker_health` | `worker_id` | Records the last reported state and heartbeat of an analysis worker. |
| `quota_policy` | singleton key | Stores limits for daily and outstanding analysis jobs. |

## Schema I — `auth_provisioning` (3 tables; supporting schema)

This supporting schema is separate from Supabase-managed `auth`. It prepares policy-aware registration and stores temporary, protected signup state. Policy-document versions make it possible to identify which notices a user accepted. A migration comment states that provisioning enforcement was created disabled pending staged validation, so the paper should not claim that the full registration hook is enforced in every environment without a deployed check.

| Table | Selected key or link | Simple explanation |
|---|---|---|
| `settings` | singleton key | Controls whether the provisioning enforcement flow is enabled. |
| `policy_documents` | `id`; document type/version | Stores versioned Terms, Privacy Notice, and AI Notice content. |
| `signup_drafts` | `id`; token hash; policy-document links | Holds temporary eligibility, agreement, and account-provisioning state. |

## Schema J — `public` compatibility and status objects

The `public` schema is not another feature service. The important current status table is `analysis_status_projection`, keyed by `job_id` and linked to a user and journal. It exposes only limited progress information to the owner under row-level security, while the complete job and result remain in `ai_analysis`. The synthetic catalog lists 32 public tables including this projection. Most of the others were created before the service-schema migration and are retained for migration and compatibility, so a paper diagram should not treat every public copy as a second canonical record.

The repository's synthetic catalog lists these remaining public tables by domain: `profiles`, `user_profiles`, `user_preferences`, `user_consents`, `notification_preferences`, `privacy_preferences`, `trusted_contacts`, `data_export_requests`, `export_requests`, `account_deletion_requests`, `deletion_requests`, and `audit_events` for account or settings compatibility; `journals`, `journal_drafts`, `journal_analyses`, `analysis_windows`, `analysis_feedback`, and `model_versions` for journal and analysis compatibility; `buddy_conversations` and `buddy_messages` for older Buddy storage; `mood_entries`, `grounding_sessions`, `support_resources`, `safety_events`, and `safety_event_resources` for older experience data; `notifications` for older notifications; `verification_admins`, `identity_verifications`, `verification_documents`, and `verification_reviews` for older verification data; and `lab_entries` for older laboratory data. `analysis_status_projection` is the separate active progress projection. These names should be checked against the target database before presenting a final deployed ERD.

Supabase-managed `auth` and `storage` schemas provide account identities and private object storage respectively. They are platform namespaces rather than Echo's service schemas. A `private` helper schema is also introduced by an earlier migration; it is not a separate user-facing service table group in the repository catalog.

## Suggested labels for thesis figures or tables

If the schema reference is converted to visual diagrams, use one labeled figure per domain: **Figure 4.1 User Service Schema**, **Figure 4.2 Journal Service Schema**, **Figure 4.3 Buddy Service Schema**, **Figure 4.4 Grounding Service Schema**, **Figure 4.5 Insights Service Schema**, **Figure 4.6 Notification Service Schema**, **Figure 4.7 Verification Service Schema**, **Figure 4.8 AI Analysis Schema**, and **Figure 4.9 Authentication Provisioning Schema**. If the inventories remain as tables, use the corresponding **Table 4.x** labels. Include `public.analysis_status_projection` as a small cross-schema note rather than duplicating the entire legacy public schema in every figure. Renumber the labels to match the thesis template before submission.
