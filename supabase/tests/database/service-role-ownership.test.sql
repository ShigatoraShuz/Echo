begin;

select plan(17);

select ok(has_table_privilege('user_service_role', 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE'),
  'user service owns profiles');
select ok(has_table_privilege('user_service_role', 'public.identity_verifications', 'SELECT,INSERT,UPDATE,DELETE'),
  'user service owns verification workflow data');
select ok(not has_table_privilege('user_service_role', 'public.journals', 'SELECT'),
  'user service cannot read journals directly');

select ok(has_table_privilege('journal_service_role', 'public.journals', 'SELECT,INSERT,UPDATE,DELETE'),
  'journal service owns journals');
select ok(not has_table_privilege('journal_service_role', 'public.profiles', 'SELECT'),
  'journal service cannot read profiles directly');
select ok(not has_table_privilege('journal_service_role', 'public.journal_analyses', 'INSERT'),
  'journal service cannot write analysis data');

select ok(has_table_privilege('assessment_service_role', 'public.mood_entries', 'SELECT,INSERT,UPDATE,DELETE'),
  'assessment service owns mood entries');
select ok(not has_table_privilege('assessment_service_role', 'public.journals', 'SELECT'),
  'assessment service cannot read journals directly');

select ok(has_table_privilege('analysis_service_role', 'public.journal_analyses', 'SELECT,INSERT,UPDATE,DELETE'),
  'analysis service owns analysis records');
select ok(not has_table_privilege('analysis_service_role', 'public.journals', 'SELECT'),
  'analysis service must obtain journal content through the journal API');

select ok(has_table_privilege('wellness_service_role', 'public.buddy_messages', 'SELECT,INSERT,UPDATE,DELETE'),
  'wellness service owns buddy messages');
select ok(not has_table_privilege('wellness_service_role', 'public.notifications', 'INSERT'),
  'wellness service cannot write user-service notifications directly');

select ok(has_table_privilege('recommendation_service_role', 'public.support_resources', 'SELECT'),
  'recommendation service reads curated support resources');
select ok(not has_table_privilege('recommendation_service_role', 'public.support_resources', 'INSERT'),
  'recommendation service cannot mutate curated resources at runtime');

select ok(not has_table_privilege('authenticated', 'public.journals', 'SELECT'),
  'browser authenticated role cannot query protected journal data');
select is((select count(*)::integer from pg_namespace where nspname in (
  'user_service', 'journal_service', 'buddy_service', 'grounding_service',
  'insights_service', 'notification_service', 'verification_service', 'ai_analysis'
)), 0, 'experimental duplicate service schemas are absent');
select is((select count(*)::integer from pg_tables where schemaname = 'public' and tablename in (
  'lab_entries', 'user_profiles', 'user_preferences', 'export_requests', 'deletion_requests'
)), 0, 'duplicate compatibility tables are absent');

select * from finish();
rollback;
