begin;
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='journal_service' and table_name in ('journals','journal_drafts') and column_name='mood') then
    raise exception 'Manual mood must not be persisted';
  end if;
  if pg_get_functiondef('user_service.collect_user_export(uuid)'::regprocedure) ~ E'\\n[[:space:]]+mood,' then
    raise exception 'User export still selects removed mood';
  end if;
end $$;
-- submit_journal compatibility, idempotency and encrypted saves are exercised by
-- journal-analysis-transactions and wellness-draft-receipt after this migration.
rollback;
