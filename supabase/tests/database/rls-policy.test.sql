begin;

select plan(18);

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and tablename in (
    'profiles', 'user_consents', 'notification_preferences', 'journals', 'model_versions',
    'journal_analyses', 'analysis_windows', 'analysis_feedback', 'mood_entries', 'trusted_contacts',
    'notifications', 'safety_events', 'support_resources', 'safety_event_resources',
    'buddy_conversations', 'buddy_messages', 'data_export_requests', 'account_deletion_requests', 'audit_events'
  )),
  19,
  'all ERD public tables exist'
);

select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity and tablename in (
    'profiles', 'user_consents', 'notification_preferences', 'journals', 'model_versions',
    'journal_analyses', 'analysis_windows', 'analysis_feedback', 'mood_entries', 'trusted_contacts',
    'notifications', 'safety_events', 'support_resources', 'safety_event_resources',
    'buddy_conversations', 'buddy_messages', 'data_export_requests', 'account_deletion_requests', 'audit_events'
  )),
  19,
  'RLS is enabled for every public application table'
);

select has_schema('private', 'private schema exists and is not exposed by config');
select has_function('private', 'set_updated_at', array[]::text[], 'private timestamp trigger function exists');
select has_function('private', 'handle_new_user', array[]::text[], 'private profile bootstrap function exists');
select has_function('public', 'phq8_severity', array['smallint'], 'PHQ-8 severity function exists');

select ok(
  exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created' and not tgisinternal),
  'new auth users receive profile and notification-preference setup trigger'
);

select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.journals'::regclass and conname = 'journals_encryption_fields_grouped'),
  'journals require grouped encryption metadata when encrypted content is present'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.journal_analyses'::regclass and conname = 'journal_analyses_score_matches_severity'),
  'analysis severity must match PHQ-8 score'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.journal_analyses'::regclass and conname = 'journal_analyses_failed_has_code'),
  'failed analyses require a safe failure code'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.analysis_windows'::regclass and conname like '%window_index%'),
  'analysis windows have a unique analysis/index constraint'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'trusted_contacts_one_primary_per_user_idx'),
  'only one primary trusted contact can exist per user'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'journal_analyses'),
  1,
  'analyses are read-only to their owner'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'analysis_windows'),
  0,
  'analysis windows are service-only'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'audit_events'),
  0,
  'audit events are server-only'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'buddy_messages' and policyname = 'buddy_messages_insert_user_role_only'),
  'clients may insert only user-role Buddy messages'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_resources' and policyname = 'support_resources_read_verified_active'),
  'public resources are visible only when active and verified'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_mark_own_read'),
  'notifications allow a constrained owned read-state update'
);

select * from finish();
rollback;
