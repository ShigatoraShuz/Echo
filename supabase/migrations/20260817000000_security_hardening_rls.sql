-- ECHO security hardening: RLS policy reconciliation and privilege pinning.
--
-- Background
-- ----------
-- 20260728000001_new_feature_rls.sql and 20260728000002_profiles_preferences.sql
-- created duplicate, role-unqualified policies (no TO clause) on tables that
-- already carried strict policies from 20260724021728_reconcile_non_ai_erd_schema.sql.
-- PostgreSQL combines policies with OR, so the loose duplicates defeated the
-- strict ones. In particular, insert_own_buddy_messages allowed any authenticated
-- user to write assistant-role messages into ANY conversation (no conversation
-- ownership check, no message_role constraint).
--
-- This migration:
--   1. drops every role-unqualified duplicate policy;
--   2. re-asserts the strict buddy policies (idempotent, drift-proof);
--   3. gives the tables created in 20260728000000/002 proper role-scoped,
--      owner-scoped policies with both USING and WITH CHECK where applicable;
--   4. grants matching least-privilege table/column privileges;
--   5. pins storage object privileges so client roles have no direct object
--      access (uploads/downloads flow through the API; signed URLs);
--   6. removes the superseded public.set_updated_at() function;
--   7. constrains profiles.display_name to match the API contract.

-- ---------------------------------------------------------------------------
-- 1. Drop loose/duplicate policies introduced by 20260728000001
-- ---------------------------------------------------------------------------
drop policy if exists select_own_buddy_conversations on public.buddy_conversations;
drop policy if exists insert_own_buddy_conversations on public.buddy_conversations;
drop policy if exists update_own_buddy_conversations on public.buddy_conversations;
drop policy if exists delete_own_buddy_conversations on public.buddy_conversations;

drop policy if exists select_own_buddy_messages on public.buddy_messages;
drop policy if exists insert_own_buddy_messages on public.buddy_messages;

-- ---------------------------------------------------------------------------
-- 2. Drop role-unqualified duplicates introduced by 20260728000002
-- ---------------------------------------------------------------------------
drop policy if exists select_own_notification_preferences on public.notification_preferences;
drop policy if exists insert_own_notification_preferences on public.notification_preferences;
drop policy if exists update_own_notification_preferences on public.notification_preferences;

drop policy if exists select_own_trusted_contacts on public.trusted_contacts;
drop policy if exists insert_own_trusted_contacts on public.trusted_contacts;
drop policy if exists delete_own_trusted_contacts on public.trusted_contacts;

-- ---------------------------------------------------------------------------
-- 3. Drop role-unqualified policies on tables created without grants
-- ---------------------------------------------------------------------------
drop policy if exists select_own_grounding_sessions on public.grounding_sessions;
drop policy if exists insert_own_grounding_sessions on public.grounding_sessions;

drop policy if exists select_own_export_requests on public.export_requests;
drop policy if exists insert_own_export_requests on public.export_requests;

drop policy if exists select_own_deletion_requests on public.deletion_requests;
drop policy if exists insert_own_deletion_requests on public.deletion_requests;
drop policy if exists update_own_deletion_requests on public.deletion_requests;

drop policy if exists select_own_user_preferences on public.user_preferences;
drop policy if exists insert_own_user_preferences on public.user_preferences;
drop policy if exists update_own_user_preferences on public.user_preferences;

-- ---------------------------------------------------------------------------
-- 4. Re-assert strict buddy policies (idempotent)
-- ---------------------------------------------------------------------------
-- Conversations: every command scoped to the owning user; UPDATE requires both
-- USING and WITH CHECK ownership.
drop policy if exists buddy_conversations_select_own on public.buddy_conversations;
create policy buddy_conversations_select_own on public.buddy_conversations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists buddy_conversations_insert_own on public.buddy_conversations;
create policy buddy_conversations_insert_own on public.buddy_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists buddy_conversations_update_own on public.buddy_conversations;
create policy buddy_conversations_update_own on public.buddy_conversations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists buddy_conversations_delete_own on public.buddy_conversations;
create policy buddy_conversations_delete_own on public.buddy_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Messages: readable only through an owned conversation; insertable only as
-- user-role rows (no model_version) into an owned conversation. This is the
-- only INSERT policy, so role spoofing and cross-user writes are impossible.
drop policy if exists buddy_messages_select_from_owned_conversation on public.buddy_messages;
create policy buddy_messages_select_from_owned_conversation on public.buddy_messages for select to authenticated
  using (exists (
    select 1 from public.buddy_conversations conversation
    where conversation.id = conversation_id and conversation.user_id = (select auth.uid())
  ));

drop policy if exists buddy_messages_insert_user_role_only on public.buddy_messages;
create policy buddy_messages_insert_user_role_only on public.buddy_messages for insert to authenticated
  with check (
    message_role = 'user'
    and model_version_id is null
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.buddy_conversations conversation
      where conversation.id = conversation_id and conversation.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Owner-scoped policies for tables created in 20260728000000/002
-- ---------------------------------------------------------------------------
-- grounding_sessions: owner-only select/insert.
create policy grounding_sessions_select_own on public.grounding_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy grounding_sessions_insert_own on public.grounding_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- export_requests: owner-only select/insert; inserts constrained to pending
-- requests without a storage path (mirrors data_export_requests).
create policy export_requests_select_own on public.export_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create policy export_requests_insert_own on public.export_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and file_path is null);

-- deletion_requests: owner-only select/insert; cancel only from pending to
-- cancelled with cancelled_at set (mirrors account_deletion_requests).
create policy deletion_requests_select_own on public.deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create policy deletion_requests_insert_own on public.deletion_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and scheduled_for is not null);

create policy deletion_requests_cancel_own_pending on public.deletion_requests for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'cancelled' and cancelled_at is not null);

-- user_preferences: owner-only select/insert/update.
create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_preferences_insert_own on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_preferences_update_own on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 6. Least-privilege grants matching the reconciled policies
-- ---------------------------------------------------------------------------
grant select, insert on public.grounding_sessions, public.export_requests to authenticated;
grant select, insert on public.deletion_requests to authenticated;
grant update (status, cancelled_at) on public.deletion_requests to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage: client roles never need direct object access. Uploads arrive at
--    the API as raw request bodies; downloads use backend-issued short-lived
--    signed URLs. service_role (bypasses RLS) and storage admins are unaffected.
-- ---------------------------------------------------------------------------
revoke all on storage.objects from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Remove the superseded public.set_updated_at() trigger function. All
--    triggers were migrated to private.set_updated_at() in 20260724021728,
--    so no dependencies remain.
-- ---------------------------------------------------------------------------
drop function if exists public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Constrain profiles.display_name to the API contract (backend maximum is
--    80 characters). private.handle_new_user() writes display_name verbatim
--    from signup metadata, so the database must bound it independently.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_length_limit
  check (display_name is null or char_length(display_name) <= 80)
  not valid;
alter table public.profiles validate constraint profiles_display_name_length_limit;
