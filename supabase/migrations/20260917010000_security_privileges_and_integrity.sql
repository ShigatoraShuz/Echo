-- Forward-only. Run against isolated fixtures first; remote application needs
-- project verification, migration history comparison and a reviewed dry run.
-- Keep private service schemas private; do not reopen dormant browser policies.
begin;
revoke create on schema public from public, anon, authenticated;

do $$
declare s text; t record; f record;
begin
  foreach s in array array['user_service','journal_service','buddy_service','verification_service',
    'notification_service','grounding_service','insights_service','ai_analysis','auth_provisioning'] loop
    execute format('revoke all on schema %I from anon, authenticated', s);
    execute format('revoke all on all tables in schema %I from anon, authenticated', s);
    execute format('revoke all on all sequences in schema %I from anon, authenticated', s);
    execute format('revoke execute on all functions in schema %I from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I revoke all on tables from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I revoke all on sequences from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I revoke execute on functions from public, anon, authenticated', s);
    for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=s and c.relkind in ('r','p') loop
      execute format('alter table %I.%I enable row level security',s,t.relname);
    end loop;
    -- Functions without a pinned path must use qualified names. Existing
    -- explicit paths are retained and protected by CREATE revocation above.
    for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname=s and p.prosecdef and not exists
      (select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%') loop
      execute format('alter function %s set search_path = pg_catalog',f.signature);
    end loop;
  end loop;
end $$;

-- Audit retention/de-identification is an owner-only maintenance operation;
-- the application runtime may append and read, never rewrite evidence.
revoke update, delete, truncate on user_service.audit_events from service_role;

-- Protect dormant policies too, so future exposure cannot authorize review
-- decisions or fabricate a document path/AI result.
drop policy if exists identity_verifications_insert_own on verification_service.identity_verifications;
drop policy if exists identity_verifications_update_own on verification_service.identity_verifications;
drop policy if exists verification_documents_insert_own on verification_service.verification_documents;
drop policy if exists journal_analyses_insert_own on journal_service.journal_analyses;
drop policy if exists analysis_requests_insert_own on ai_analysis.analysis_requests;
drop policy if exists analysis_requests_update_own on ai_analysis.analysis_requests;
drop policy if exists notifications_insert_own on notification_service.notifications;

drop policy if exists buddy_messages_insert_own on buddy_service.buddy_messages;
create policy buddy_messages_insert_user_owned_conversation on buddy_service.buddy_messages
  for insert to authenticated with check (
    user_id=(select auth.uid()) and role='user' and exists (
      select 1 from buddy_service.buddy_conversations c
      where c.id=conversation_id and c.user_id=(select auth.uid())
    )
  );

create unique index if not exists buddy_conversations_id_owner_unique
  on buddy_service.buddy_conversations(id,user_id);
alter table buddy_service.buddy_messages add constraint buddy_message_conversation_owner_fk
  foreign key(conversation_id,user_id) references buddy_service.buddy_conversations(id,user_id)
  on delete cascade not valid;
create unique index if not exists verification_id_owner_unique
  on verification_service.identity_verifications(id,user_id);
alter table verification_service.verification_documents add constraint verification_document_owner_fk
  foreign key(verification_id,user_id) references verification_service.identity_verifications(id,user_id)
  on delete cascade not valid;
alter table verification_service.identity_verifications add constraint verification_status_security_check
  check(verification_status in ('not_started','draft','submitted','under_review','approved','rejected','needs_changes','expired')) not valid;
alter table verification_service.verification_documents add constraint verification_document_size_security_check
  check(size_bytes between 1 and 8388608 and mime_type in ('image/jpeg','image/png','application/pdf')) not valid;

-- Existing data must be separately reviewed before validating NOT VALID
-- constraints; new and changed rows are checked immediately.
update storage.buckets set public=false where id in ('verification-documents','journal-images');
commit;
