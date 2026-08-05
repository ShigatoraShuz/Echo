# Echo ERD to migration comparison

Source ERD: user-provided `echo ERD.png`.  
Migration reviewed: `20260724012900_initial_echo_schema.sql`.  
Local database: unverified; Docker is not installed, so no local stack was started.

| ERD table | Migration state | Primary differences / risks | Corrective direction |
|---|---|---|---|
| `profiles` | Exists | User insert/delete policies conflict with trigger-owned lifecycle; missing ERD locale fields. | Remove direct insert/delete; create profile trigger; retain existing columns. |
| `user_consents` | Exists | Missing `source`, blank version guard, revoked active-consent consistency. | Add source and checks. |
| `notification_preferences` | Exists | Missing in-app flag, reminder time/timezone and wellbeing flag; direct delete allowed. | Add settings columns and remove delete policy. |
| `journals` | Exists, incompatible | Plaintext title/content, no encryption metadata, word count, archive semantics, language/status fields, composite owner FK target. | Add encrypted fields and constraints; backend writes encrypted fields only. |
| `model_versions` | Exists, partial | Missing purpose and lifecycle metadata; active uniqueness is global rather than per purpose. | Add purpose/version metadata and unique active-per-purpose index. |
| `journal_analyses` | Exists, partial | Missing composite journal-owner FK, token/window/prompt fields, lifecycle timestamps and strict failed/severity consistency; users can write. | Add fields/constraints, secure policies. |
| `analysis_windows` | Missing | Required service-only derived window records. | Create with no private text fields or client grants. |
| `analysis_feedback` | Missing | Required owned feedback with encrypted optional comment grouping. | Create with owner consistency and RLS. |
| `mood_entries` | Exists, incompatible | Scores 1-10, plaintext note, missing anxiety/encryption metadata. | Add encrypted note fields and constrain new score columns to 1-5. |
| `trusted_contacts` | Exists, partial | Missing primary, verification timestamp, consent acknowledgement, locale. | Add fields/checks and single-primary partial index. |
| `notifications` | Exists, partial | Client can change/delete arbitrary notification fields. | Restrict to read-state update; add resource references. |
| `safety_events` | Missing | ERD requires no raw triggering text and consistent owned relations. | Create service-managed table. |
| `support_resources` | Missing | ERD requires active/verified public resources only; no seed of real contact data. | Create with active/verified RLS reads. |
| `safety_event_resources` | Missing | Required many-to-many owned-resource linkage. | Create service-managed join with owned read policy. |
| `buddy_conversations` | Missing | Requires owned conversation metadata. | Create with ownership RLS. |
| `buddy_messages` | Missing | Requires encrypted content and user-only client insert. | Create with role/ownership guard and immutable rows. |
| `data_export_requests` | Missing | Must not let users set storage paths. | Create with client-safe columns/policies. |
| `account_deletion_requests` | Missing | Only eligible pending cancellation permitted. | Create with constrained status policy. |
| `audit_events` | Exists, partial | Needs append-only/server-only ownership naming and broader sensitive-metadata deny list. | Retain table and strengthen constraints/grants. |

## Deliberate compatibility decision

The initial migration's plaintext `journals.content` and `mood_entries.note` cannot be dropped safely in an additive correction. The corrective migration keeps them for historical compatibility but permits the new backend only to use the encrypted fields. A later, separately approved data migration can backfill and remove plaintext after production data review.

## Verification status

The SQL is designed for `supabase db reset` and pgTAP. It has not been applied to a local database because Docker is unavailable. No remote Supabase command has been run.
