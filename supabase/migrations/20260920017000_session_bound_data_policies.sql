begin;
-- No caller-supplied identity: Auth/PostgREST supplies the verified JWT claims.
create function public.security_request_active() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(user_service.security_session_active(auth.uid(),
   case when (auth.jwt()->>'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (auth.jwt()->>'session_id')::uuid else null end),false)
$$;
revoke all on function public.security_request_active() from public,anon;
grant execute on function public.security_request_active() to authenticated,service_role;
-- Restrictive policies compose with (and cannot broaden) existing owner policies.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','user_service','journal_service','buddy_service','verification_service',
  'notification_service','grounding_service','insights_service','ai_analysis','auth_provisioning') and c.relkind in ('r','p') loop
  execute format('create policy security_active_session on %I.%I as restrictive for all to authenticated using ((select public.security_request_active())) with check ((select public.security_request_active()))',t.nspname,t.relname);
 end loop;
end $$;
create policy security_active_session on storage.objects as restrictive for all to authenticated
 using ((select public.security_request_active())) with check ((select public.security_request_active()));
commit;
