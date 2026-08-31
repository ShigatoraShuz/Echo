begin;

select plan(43);

insert into storage.buckets (id, name, public)
values ('echo-storage-denied-test', 'echo-storage-denied-test', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values
  ('verification-documents', 'pgtap-allowed-existing'),
  ('echo-storage-denied-test', 'pgtap-denied-existing')
on conflict (bucket_id, name) do nothing;

select ok(has_table_privilege('user_service_role', 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE'),
  'user service owns profiles');
select ok(has_table_privilege('user_service_role', 'public.identity_verifications', 'SELECT,INSERT,UPDATE,DELETE'),
  'user service owns verification workflow data');
select ok(not has_table_privilege('user_service_role', 'public.journals', 'SELECT'),
  'user service cannot read journals directly');
select ok(not has_schema_privilege('user_service_role', 'storage', 'USAGE'),
  'application-table role has no Storage schema access');
select ok(not (select rolbypassrls from pg_roles where rolname = 'user_storage_role'),
  'User Storage role cannot bypass bucket RLS');
select ok(has_schema_privilege('user_storage_role', 'storage', 'USAGE'),
  'User Storage role can resolve the Storage schema');
select ok(has_table_privilege('user_storage_role', 'storage.buckets', 'SELECT'),
  'User Storage role can inspect its configured buckets');
select ok(has_table_privilege('user_storage_role', 'storage.objects', 'SELECT,INSERT,DELETE'),
  'User Storage role has only required object operations');
select ok(not has_table_privilege('user_storage_role', 'storage.objects', 'UPDATE'),
  'User Storage role cannot update arbitrary object rows');
select ok(not has_table_privilege('authenticated', 'storage.objects', 'INSERT'),
  'browser authenticated role cannot upload verification documents directly');
select ok(not has_table_privilege('journal_service_role', 'storage.objects', 'SELECT'),
  'unrelated service roles have no verification Storage access');
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'verification-documents' and public = false and file_size_limit = 8388608
  ) and exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('user_storage_objects_read', 'user_storage_objects_insert', 'user_storage_objects_delete')
      and 'user_storage_role' = any (roles)
  ),
  'verification documents use the private size-limited bucket and restricted Storage policies');

set local role user_storage_role;
select results_eq(
  $$select id from storage.buckets where id in ('avatars', 'verification-documents', 'echo-storage-denied-test') order by id$$,
  array['avatars'::text, 'verification-documents'::text],
  'User Storage role sees only User-owned buckets'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('verification-documents', 'pgtap-allowed-insert')$$,
  'User Storage role can insert a verification document object'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('echo-storage-denied-test', 'pgtap-denied-insert')$$,
  '42501', null,
  'User Storage role cannot insert into another bucket'
);
select results_eq(
  $$select name from storage.objects where name like 'pgtap-%' order by name$$,
  array['pgtap-allowed-existing'::text, 'pgtap-allowed-insert'::text],
  'cross-bucket objects are filtered by effective RLS'
);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'verification-documents' and name = 'pgtap-allowed-insert'$$,
  'User Storage role can delete a verification document object'
);
select results_eq(
  $$select name from storage.objects where bucket_id = 'verification-documents' and name = 'pgtap-allowed-insert'$$,
  array[]::text[],
  'allowed verification object deletion takes effect'
);
reset role;

set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('verification-documents', 'pgtap-browser-denied')$$,
  '42501', null,
  'browser role cannot insert verification documents'
);
reset role;

set local role user_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'User application-table role cannot read verification Storage'
);
reset role;

set local role assessment_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'Assessment Service cannot read verification documents'
);
reset role;

set local role analysis_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'Analysis Service cannot read verification documents'
);
reset role;

set local role recommendation_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'Recommendation Service cannot read verification documents'
);
reset role;

set local role wellness_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'Wellness Service cannot read verification documents'
);
reset role;

set local role journal_service_role;
select throws_ok(
  $$select count(*) from storage.objects where bucket_id = 'verification-documents'$$,
  '42501', null,
  'unrelated service role cannot read verification documents'
);
reset role;

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
select ok(not has_table_privilege('recommendation_service_role', 'public.support_resources', 'UPDATE'),
  'recommendation service cannot update curated resources');
select ok(not has_table_privilege('recommendation_service_role', 'public.support_resources', 'DELETE'),
  'recommendation service cannot delete curated resources');
select ok(not has_table_privilege('recommendation_service_role', 'public.profiles', 'SELECT'),
  'recommendation service cannot read unrelated User Service tables');
select ok(not has_schema_privilege('recommendation_service_role', 'storage', 'USAGE'),
  'recommendation service has no Storage access');

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
