# Supabase — Database Configuration

## Migrations

All database changes are tracked as timestamped SQL files in \migrations/\.
Migrations are applied in chronological order.

### Current Schema

- profiles — User profiles with onboarding state
- journals — Journal entries with mood, emotions, energy
- mood_entries — Time-series mood and energy snapshots
- buddy_conversations — AI chat conversation threads
- buddy_messages — Individual messages within conversations
- grounding_sessions — Recorded breathing/exercise sessions
- notification_preferences — User notification settings
- trusted_contacts — Emergency contacts
- export_requests — Data export requests
- deletion_requests — Account deletion requests
- user_consents — GDPR/compliance consent records
- user_preferences — App preferences (theme, camera, etc.)

## RLS Policies

Row-Level Security is enabled on all user-data tables.
Each policy ensures users can only access their own records via \uth.uid() = user_id\.

## Local Development

1. Install Supabase CLI
2. Run \supabase start\ for local Postgres
3. Run \supabase db push\ to apply migrations
