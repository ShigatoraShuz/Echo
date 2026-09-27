begin;
do $$ declare t record; begin
 for t in select c.relname,c.relrowsecurity,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p','v','m') loop
  if t.relkind in ('r','p') and not t.relrowsecurity then raise exception 'Missing public RLS: %',t.relname; end if;
  if has_table_privilege('anon',format('public.%I',t.relname),'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Anonymous public access: %',t.relname; end if;
  if t.relname<>'analysis_status_projection' and has_table_privilege('authenticated',format('public.%I',t.relname),'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Legacy browser access: %',t.relname; end if;
 end loop;
 if has_table_privilege('authenticated','public.analysis_status_projection','INSERT,UPDATE,DELETE') then raise exception 'Projection write allowed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 begin insert into public.buddy_messages default values;
 raise exception 'Legacy Buddy bypass'; exception when insufficient_privilege then null; end;
 begin update public.profiles set display_name='forged'; raise exception 'Legacy profile mutation'; exception when insufficient_privilege then null; end;
 begin perform * from public.data_export_requests; raise exception 'Legacy privacy data accessible'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
