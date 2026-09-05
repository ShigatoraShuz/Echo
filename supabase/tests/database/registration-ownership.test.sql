begin;
select plan(14);

select is((select count(*) from public.registration_policy_documents where is_active), 3::bigint,
  'exactly three current registration documents');
select ok((select bool_and(content_sha256 = encode(extensions.digest(sanitized_markdown, 'sha256'), 'hex'))
  from public.registration_policy_documents), 'policy hashes match exact displayed text');
select ok((select bool_and(position(chr(92) || 'n' in sanitized_markdown) = 0)
  from public.registration_policy_documents), 'Markdown uses real newlines');
select ok(not has_table_privilege('anon', 'public.registration_drafts', 'SELECT'), 'anonymous browsers cannot read drafts');
select ok(not has_table_privilege('authenticated', 'public.registration_drafts', 'SELECT'), 'signed-in browsers cannot read drafts');
select ok(not has_table_privilege('user_service_role', 'public.registration_drafts', 'SELECT'), 'User uses restricted draft RPCs');
select ok(has_table_privilege('user_service_role', 'public.registration_policy_documents', 'SELECT'), 'User can read current policies');
select ok(not has_table_privilege('user_service_role', 'public.registration_policy_documents', 'UPDATE'), 'User cannot publish policy changes');
select ok(has_function_privilege('user_service_role', 'public.echo_registration_get_draft(text)', 'EXECUTE'), 'User owns registration RPC access');
select ok(not has_function_privilege('authenticated', 'public.echo_registration_get_draft(text)', 'EXECUTE'), 'browser cannot execute registration RPCs');
select ok(not has_function_privilege('journal_service_role', 'public.echo_registration_get_draft(text)', 'EXECUTE'), 'Journal cannot execute User RPCs');
select has_column('public', 'profiles', 'starting_mood_preference', 'onboarding mood has a canonical storage column');

set local role user_service_role;
select lives_ok($$select public.echo_registration_create_draft(repeat('a', 64), repeat('b', 64), 'test-rule', now() + interval '1 hour')$$,
  'restricted User role can create an eligible draft through its RPC');
select results_eq($$select state from public.echo_registration_get_draft(repeat('a', 64))$$,
  $$values ('agreements'::text)$$, 'draft retrieval starts at agreements');
reset role;

select * from finish();
rollback;
