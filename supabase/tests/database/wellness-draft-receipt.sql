begin;
insert into auth.users(id,email) values('ffffffff-ffff-4fff-8fff-ffffffffffff','draft-receipt@example.invalid');
do $$ declare first_id uuid; replay_id uuid; draft_key uuid:=gen_random_uuid();
begin
  if has_function_privilege('authenticated','journal_service.submit_draft_journal(uuid,text,text,text,text,integer,integer,text,jsonb,jsonb,text,boolean,text,text,text,text,text,text,uuid)','execute') then raise exception 'browser can impersonate draft owner'; end if;
  select journal_id into first_id from journal_service.submit_draft_journal('ffffffff-ffff-4fff-8fff-ffffffffffff','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v1','draft-hmac','hash',draft_key);
  delete from ai_analysis.idempotency_records where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  select journal_id into replay_id from journal_service.submit_draft_journal('ffffffff-ffff-4fff-8fff-ffffffffffff','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v2','rotated-hmac','hash',draft_key);
  if first_id is distinct from replay_id or (select count(*) from journal_service.journals where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>1 then raise exception 'draft duplicated after HTTP retry expiry/key rotation'; end if;
  begin
    perform journal_service.submit_draft_journal('ffffffff-ffff-4fff-8fff-ffffffffffff','[encrypted]','changed','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v2','rotated-hmac','changed-hash',draft_key);
    raise exception 'changed request accepted';
  exception when unique_violation then null; end;
  update journal_service.journals set deleted_at=now() where id=first_id;
  begin
    perform journal_service.submit_draft_journal('ffffffff-ffff-4fff-8fff-ffffffffffff','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v2','rotated-hmac','hash',draft_key);
    raise exception 'deleted journal recreated';
  exception when others then if sqlerrm <> 'JOURNAL_NOT_FOUND' then raise; end if; end;
end $$;
rollback;
