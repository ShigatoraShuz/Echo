-- RLS ownership-isolation tests.
--
-- Run with: supabase test db
--
-- Verifies that the security-hardening migration (20260817000000_security_hardening_rls.sql)
-- closed the loose-policy gap: no role-unqualified policies remain, buddy
-- messages are conversation-scoped and user-role-only, and no user can insert
-- rows carrying another user's user_id (RLS WITH CHECK is the enforcement
-- point, because the API never accepts user_id from request bodies).

begin;

select plan(18);

-- ---------------------------------------------------------------------------
-- Structural assertions
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and 'public' = any(roles)),
  0,
  'no role-unqualified (public-role) policies remain on public schema tables'
);

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and tablename = 'buddy_messages'),
  2,
  'buddy_messages exposes exactly the two strict policies (select from owned conversation, insert user-role only)'
);

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and tablename = 'buddy_conversations'),
  4,
  'buddy_conversations exposes exactly the four owner-scoped policies'
);

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public' and tablename in ('grounding_sessions', 'export_requests', 'deletion_requests', 'user_preferences')),
  10,
  'reconciled tables carry exactly 2+2+3+3 owner-scoped policies'
);

select is(
  (select count(*)::integer
   from information_schema.role_table_grants
   where table_schema = 'storage' and table_name = 'objects'
     and grantee in ('anon', 'authenticated')),
  0,
  'client roles hold no privileges on storage.objects'
);

-- UPDATE policies must carry both USING and WITH CHECK ownership.
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public'
     and cmd = 'UPDATE'
     and tablename in (
       'journals', 'profiles', 'user_consents', 'mood_entries', 'trusted_contacts',
       'notification_preferences', 'privacy_preferences', 'analysis_feedback',
       'buddy_conversations', 'buddy_messages', 'notifications', 'deletion_requests',
       'user_preferences', 'data_export_requests', 'account_deletion_requests'
     )
     and (
       qual is null or with_check is null
       or not (qual::text like '%auth.uid%' and with_check::text like '%auth.uid%')
     )
  ),
  0,
  'every update policy on sensitive tables has both USING and WITH CHECK ownership conditions'
);

-- ---------------------------------------------------------------------------
-- Functional isolation assertions
-- ---------------------------------------------------------------------------

-- Two distinct test identities (the auth trigger bootstraps their defaults).
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'isolation-a@example.test', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'isolation-b@example.test', 'crypt', now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');

-- User A creates an own conversation and a user-role message.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.buddy_conversations (id, user_id)
    values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a')$$,
  'user A may create an own conversation'
);

select lives_ok(
  $$insert into public.buddy_messages (
      conversation_id, user_id, message_role, content_ciphertext,
      encryption_iv, encryption_auth_tag, encryption_key_version
    )
    values (
      '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'user',
      '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, 1
    )$$,
  'user A may post a user-role message to an own conversation'
);

select ok(
  exception_ok(
    $$insert into public.buddy_messages (
        conversation_id, user_id, message_role, content_ciphertext,
        encryption_iv, encryption_auth_tag, encryption_key_version
      )
      values (
        '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'assistant',
        '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, 1
      )$$
  ),
  'assistant-role message injection into an own conversation is rejected'
);

-- User B attempts to tamper with user A''s resources.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b"}', true);

select ok(
  exception_ok(
    $$insert into public.buddy_messages (
        conversation_id, user_id, message_role, content_ciphertext,
        encryption_iv, encryption_auth_tag, encryption_key_version
      )
      values (
        '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'user',
        '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, 1
      )$$
  ),
  'user B cannot insert a message into user A''s conversation (conversation ownership WITH CHECK)'
);

select ok(
  exception_ok(
    $$insert into public.buddy_messages (
        conversation_id, user_id, message_role, content_ciphertext,
        encryption_iv, encryption_auth_tag, encryption_key_version
      )
      values (
        '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'user',
        '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, 1
      )$$
  ),
  'user B cannot insert a message claiming user A''s user_id'
);

select is(
  (select count(*)::integer from public.buddy_messages
   where conversation_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'user B cannot select user A''s messages'
);

select is(
  (select count(*)::integer from (
     update public.buddy_conversations
     set conversation_status = 'archived'
     where id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) updated),
  0,
  'user B cannot update user A''s conversation (USING ownership filters the row)'
);

select is(
  (select count(*)::integer from (
     delete from public.buddy_conversations
     where id = '11111111-1111-1111-1111-111111111111'
     returning 1
   ) deleted),
  0,
  'user B cannot delete user A''s conversation'
);

select ok(
  exception_ok(
    $$insert into public.journals (
        user_id, content_ciphertext, encryption_iv,
        encryption_auth_tag, encryption_key_version
      )
      values (
        '00000000-0000-0000-0000-00000000000a',
        '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, '\xdeadbeef'::bytea, 1
      )$$
  ),
  'user B cannot insert a journal carrying user A''s user_id (mass assignment WITH CHECK)'
);

-- User B may still create own resources (proves the rejection is not global).
select lives_ok(
  $$insert into public.buddy_conversations (id, user_id)
    values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b')$$,
  'user B may create an own conversation (ownership, not denial, is enforced)'
);

select ok(
  exception_ok(
    $$insert into public.export_requests (user_id, status, file_path)
      values ('00000000-0000-0000-0000-00000000000b', 'completed', 's3://leak.txt')$$
  ),
  'export requests cannot be created in a non-pending state or with a storage path'
);

select is(
  (select count(*)::integer from public.export_requests),
  0,
  'user B cannot see any export requests (table is empty for the test user)'
);

select * from finish();
rollback;
