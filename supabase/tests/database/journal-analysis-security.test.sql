begin;

do $$
declare columns text[];
begin
  select array_agg(column_name order by ordinal_position) into columns
  from information_schema.columns where table_schema='public' and table_name='analysis_status_projection';
  if columns <> array['user_id','journal_id','job_id','status','progress','updated_at'] then
    raise exception 'analysis status projection exposes unexpected columns: %', columns;
  end if;
  if not exists (select 1 from pg_class where relnamespace='public'::regnamespace and relname='analysis_status_projection' and relrowsecurity) then
    raise exception 'analysis status RLS is not enabled';
  end if;
end $$;

do $$
begin
  if has_schema_privilege('authenticated','ai_analysis','usage') or has_schema_privilege('anon','journal_service','usage')
    or has_schema_privilege('authenticated','auth_provisioning','usage') then
    raise exception 'browser roles retain private schema usage';
  end if;
  if has_table_privilege('authenticated','public.analysis_status_projection','insert')
     or has_table_privilege('authenticated','public.analysis_status_projection','update')
     or has_table_privilege('authenticated','public.analysis_status_projection','delete') then
    raise exception 'authenticated users can mutate public status';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='analysis_requests_progress_check') then raise exception 'progress constraint missing'; end if;
  if not exists (select 1 from pg_proc where proname='submit_journal' and pronamespace='journal_service'::regnamespace) then raise exception 'atomic submission RPC missing'; end if;
  if not exists (select 1 from pg_proc where proname='complete_journal_analysis' and pronamespace='ai_analysis'::regnamespace) then raise exception 'transactional completion RPC missing'; end if;
end $$;

rollback;
