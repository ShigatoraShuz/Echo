# ECHO-004 — Migration baseline conflict inventory (static analysis)

Date: 2026-08-15. Status: **BLOCKED** for executable verification (Docker unavailable); static inventory complete.

## Migrations on disk (10 files)

| # | Migration | Purpose |
|---|---|---|
| 1 | `20260724012900_initial_echo_schema.sql` | Base tables, RLS, indexes (plaintext journals/mood, permissive policies) |
| 2 | `20260724021728_reconcile_non_ai_erd_schema.sql` | Encryption columns, ERD tables, constraints, private schema |
| 3 | `20260724090000_settings_preferences.sql` | Settings/preferences columns |
| 4 | `20260724182348_seed_verified_support_resources.sql` | Seed support resources |
| 5 | `20260724185719_journal_drafts.sql` | Journal draft table |
| 6 | `20260724192001_account_verification_workflow.sql` | Verification tables + state machine |
| 7 | `20260725104500_signup_terms_and_ai_consent.sql` | Consent types/versions |
| 8 | `20260728000000_new_feature_tables.sql` | Buddy/grounding/export/deletion tables (plaintext, `IF NOT EXISTS`) |
| 9 | `20260728000001_new_feature_rls.sql` | RLS for migration 8 tables |
| 10 | `20260728000002_profiles_preferences.sql` | Preferences columns, notification_preferences/trusted_contacts/user_preferences (`IF NOT EXISTS`) |

## Hidden incompatible `IF NOT EXISTS` definitions (backlog §3.2 defect 7)

| Concept | Defined in | Redefined in | Conflict |
|---|---|---|---|
| `buddy_conversations` | M2 (encrypted title_ciphertext + status) | M8 (`title TEXT NOT NULL`, mood) | M8 no-op if M2 ran; incompatible shape otherwise |
| `buddy_messages` | M2 (content_ciphertext, message_role, no plaintext) | M8 (`content TEXT NOT NULL` plaintext, role='user'/'buddy') | M8 introduces a plaintext-content table that ECHO-032 forbids |
| `trusted_contacts` | M1 (relationship NOT NULL, verified bool, id PK) | M10 (no relationship NOT NULL, no verified column, id PK) | M10 silently no-ops; schema drift |
| `notification_preferences` | M1 (id PK + user_id UNIQUE) | M10 (user_id PK) | PK shape differs; no-op masks drift |
| export concept | M2 `data_export_requests` (request_status, expires_at) | M8 `export_requests` (status, file_path) | Two names for one concept (ECHO-092) |
| deletion concept | M2 `account_deletion_requests` | M8 `deletion_requests` | Two names for one concept (ECHO-092) |

## Other observations

- M1 journal/mood tables still allow plaintext writes (columns retained non-null in M1; M2 drops NOT NULL and adds ciphertext columns).
- M8 `grounding_sessions` has no encryption columns (grounding is operational data; session records are not wellness prose — review at ECHO-051/091).
- M8/M10 enable RLS but rely on M2/M1 for some tables; `user_preferences` is new (M10) with RLS.
- Migration history is treated as immutable; corrections are additive (current-system-audit.md).

## Required executable verification (BLOCKED)

Once Docker/Supabase CLI are available, run from repo root:

```
npx supabase start
npx supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
npx supabase db lint
# then inspect: no table/policy/function warnings; deterministic empty-DB migration
```

Expected result for VERIFIED: empty database migrates deterministically from M1..M10 with zero errors; the `IF NOT EXISTS` redefinitions above are either resolved (ECHO-091 canonical chain) or proven harmless; shadow reset is repeatable.

Owner: DB. Depends on: none (execution blocked on Docker). ECHO-091 builds the canonical chain on top of this inventory.