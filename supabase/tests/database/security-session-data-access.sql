begin;
insert into auth.users(id,email) values
 ('60000000-0000-4000-8000-000000000001','session-data-a@example.test'),
 ('60000000-0000-4000-8000-000000000002','session-data-b@example.test');
insert into user_service.profiles(user_id,account_status) values
 ('60000000-0000-4000-8000-000000000001','active'),('60000000-0000-4000-8000-000000000002','active') on conflict(user_id) do update set account_status='active';
insert into auth.sessions(id,user_id,not_after) values
 ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',now()+interval '1 hour'),
 ('61000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',now()+interval '1 hour');
insert into notification_service.notifications(user_id,notification_type,title,message) values
 ('60000000-0000-4000-8000-000000000001','test','Synthetic A','Ready'),
 ('60000000-0000-4000-8000-000000000002','test','Synthetic B','Ready');
-- Synthetic owner policy isolates the restrictive session rule from provider-specific bucket configuration.
insert into storage.buckets(id,name,public) values('session-policy-test','session-policy-test',false);
insert into storage.objects(id,bucket_id,name,owner) values
 ('62000000-0000-4000-8000-000000000001','session-policy-test','synthetic-file','60000000-0000-4000-8000-000000000001');
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
create policy synthetic_owner on storage.objects for select to authenticated using(bucket_id='session-policy-test' and owner=auth.uid());
create function pg_temp.expect_visible(expected integer) returns void language plpgsql as $$ begin
 if (select count(*) from notification_service.notifications)<>expected then raise exception 'Notification session boundary failed'; end if;
 if (select count(*) from storage.objects where bucket_id='session-policy-test')<>expected then raise exception 'Storage session boundary failed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001"}',true);
select pg_temp.expect_visible(0);
do $$ declare affected integer; begin
 update notification_service.notifications set read_at=now(); get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Missing session mutated data'; end if;
 begin insert into user_service.trusted_contacts(user_id,contact_name,relationship,contact_email)
 values('60000000-0000-4000-8000-000000000001','Synthetic','friend','synthetic@example.test');
 raise exception 'Missing session inserted data'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","session_id":"malformed"}',true);
select pg_temp.expect_visible(0);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","session_id":"61000000-0000-4000-8000-000000000002"}',true);
select pg_temp.expect_visible(0);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","session_id":"61000000-0000-4000-8000-000000000001"}',true);
select pg_temp.expect_visible(1);
reset role;
update auth.sessions set not_after=now()-interval '1 second' where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_visible(0);
reset role;
update auth.sessions set not_after=now()+interval '1 hour' where user_id='60000000-0000-4000-8000-000000000001';
update user_service.profiles set account_status='suspended' where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_visible(0);
reset role;
update user_service.profiles set account_status='active' where user_id='60000000-0000-4000-8000-000000000001';
delete from auth.sessions where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_visible(0);
reset role;
rollback;
