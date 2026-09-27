begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','read-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','read-b@example.test');
insert into journal_service.journals(id,user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,mood) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','[encrypted]','syntheticcipher','syntheticiv','synthetictag',1,'calm'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','[encrypted]','syntheticcipher','syntheticiv','synthetictag',1,'calm');
-- Explicit synthetic Auth sessions model the claims supplied by PostgREST.
insert into user_service.profiles(user_id,account_status) select id,'active' from auth.users on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id) select id,id from auth.users on conflict(id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 if (select count(*) from journal_service.journals)<>1 then raise exception 'Journal read isolation failed'; end if;
 if exists(select 1 from journal_service.journals where id='20000000-0000-4000-8000-000000000002') then raise exception 'Cross-user journal read'; end if;
 begin update journal_service.journals set encryption_key_version=99;raise exception 'Key version directly writable';exception when insufficient_privilege then null;end;
 begin delete from journal_service.journals;raise exception 'Direct deletion allowed';exception when insufficient_privilege then null;end;
 begin insert into journal_service.journal_drafts default values;raise exception 'Direct draft state writable';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
