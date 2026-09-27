begin;
do $$
declare s text; t record;
begin
  foreach s in array array['user_service','journal_service','buddy_service','verification_service',
    'notification_service','grounding_service','insights_service','ai_analysis','auth_provisioning'] loop
    if has_schema_privilege('anon',s,'USAGE') or (s not in ('notification_service','user_service','journal_service','buddy_service','grounding_service') and has_schema_privilege('authenticated',s,'USAGE')) then
      raise exception 'Private schema accessible to browser role: %',s;
    end if;
    for t in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=s and c.relkind in ('r','p') loop
      if not t.relrowsecurity then raise exception 'Missing RLS: %.%',s,t.relname; end if;
      if has_table_privilege('anon',format('%I.%I',s,t.relname),'SELECT,INSERT,UPDATE,DELETE') or
        (not((s='buddy_service' and t.relname in ('buddy_conversations','buddy_messages')) or (s='grounding_service' and t.relname='grounding_sessions') or (s='journal_service' and t.relname in ('journals','journal_drafts')) or (s='notification_service' and t.relname='notifications') or (s='user_service' and t.relname in ('profiles','notification_preferences','privacy_preferences','trusted_contacts','audit_events','user_consents','data_export_requests','account_deletion_requests'))) and
        has_table_privilege('authenticated',format('%I.%I',s,t.relname),'SELECT,INSERT,UPDATE,DELETE')) then
        raise exception 'Unexpected browser grant: %.%',s,t.relname;
      end if;
    end loop;
  end loop;
  if has_table_privilege('service_role','user_service.audit_events','UPDATE,DELETE,TRUNCATE') then
    raise exception 'Runtime can rewrite audit evidence';
  end if;
  if exists(select 1 from storage.buckets where id in ('verification-documents','journal-images') and public) then
    raise exception 'Restricted bucket is public';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('user_service','journal_service','buddy_service','verification_service','notification_service',
      'grounding_service','insights_service','ai_analysis','auth_provisioning')
    and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
    raise exception 'Browser can execute private SECURITY DEFINER function';
  end if;
end $$;

-- Role-level denial applies equally to both authenticated users, even when
-- they know the schema/table. This does not substitute for API two-user tests.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$ begin
  begin perform * from verification_service.verification_admins; raise exception 'Admin table leaked';
  exception when insufficient_privilege then null; end;
  begin update verification_service.identity_verifications set verification_status='approved'; raise exception 'Review escalation';
  exception when insufficient_privilege then null; end;
  begin update buddy_service.buddy_messages set role='assistant'; raise exception 'Buddy message rewriting allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$ begin
  begin delete from journal_service.journals; raise exception 'Direct journal deletion allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
