-- Current browser data access is user_service profiles/settings and the minimal
-- realtime status projection. Legacy public CRUD is not an application API.
begin;
revoke all privileges on all tables in schema public from anon,authenticated;
revoke all privileges on all sequences in schema public from anon,authenticated;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke all on sequences from anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
grant select on public.analysis_status_projection to authenticated;
do $$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') loop
  execute format('alter table public.%I enable row level security',t.relname);
 end loop;
end $$;
commit;
