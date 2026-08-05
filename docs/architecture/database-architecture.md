# Database architecture

The `supabase/migrations/20260724012900_initial_echo_schema.sql` migration creates profiles, consents, journals, analysis records, mood entries, trusted contacts, notification preferences, notifications, audit events, and model versions.

User-owned tables have RLS enabled with `TO authenticated` policies and ownership predicates based on `auth.uid()`. Every update policy includes both `USING` and `WITH CHECK`, preventing ownership reassignment. Audit events and model versions intentionally have no user-facing policies; they remain server-only.

The Supabase CLI configuration keeps new tables out of automatic Data API exposure. This matches the architecture: browser code uses Supabase Auth only, while protected data access goes through the Express API.

The migration constrains completed analysis scores to `0–24`, accepts only approved severity/status values, and rejects obvious raw journal-text keys in audit metadata. These checks do not replace server-side redaction and logging discipline.
