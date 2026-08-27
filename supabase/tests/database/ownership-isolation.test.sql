-- Functional table-grant isolation for the canonical public schema.
begin;

select plan(8);

set local role journal_service_role;
select lives_ok(
  $$select count(*) from public.journals$$,
  'journal service can access its owned journals table'
);
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501', null,
  'journal service cannot read user-service profiles'
);
select throws_ok(
  $$select count(*) from public.journal_analyses$$,
  '42501', null,
  'journal service cannot read analysis-service results directly'
);
reset role;

set local role analysis_service_role;
select lives_ok(
  $$select count(*) from public.journal_analyses$$,
  'analysis service can access owned analysis results'
);
select throws_ok(
  $$select count(*) from public.journals$$,
  '42501', null,
  'analysis service must request journal text through the Journal API'
);
reset role;

set local role wellness_service_role;
select lives_ok(
  $$select count(*) from public.buddy_messages$$,
  'wellness service can access owned Buddy messages'
);
select throws_ok(
  $$select count(*) from public.notifications$$,
  '42501', null,
  'wellness service must request notifications through the User API'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select count(*) from public.journals$$,
  '42501', null,
  'browser authenticated role cannot query protected application tables'
);

select * from finish();
rollback;
