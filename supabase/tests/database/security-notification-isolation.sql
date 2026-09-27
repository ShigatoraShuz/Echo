begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','security-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','security-b@example.test');
insert into notification_service.notifications(id,user_id,notification_type,title,message) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','test','Notification','Ready'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','test','Notification','Ready');
-- Explicit synthetic Auth sessions model the claims supplied by PostgREST.
insert into user_service.profiles(user_id,account_status) select id,'active' from auth.users on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id) select id,id from auth.users on conflict(id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
do $$ declare changed integer; begin
  if (select count(*) from notification_service.notifications) <> 1 then raise exception 'Cross-user notification read'; end if;
  update notification_service.notifications set read_at=now() where user_id='10000000-0000-4000-8000-000000000002';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-user notification update'; end if;
  update notification_service.notifications set read_at=now() where user_id='10000000-0000-4000-8000-000000000001';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner update incorrectly denied'; end if;
  begin update notification_service.notifications set user_id='10000000-0000-4000-8000-000000000002';
    raise exception 'Owner reassignment allowed'; exception when insufficient_privilege then null; end;
  begin update notification_service.notifications set message='forged';
    raise exception 'Message rewrite allowed'; exception when insufficient_privilege then null; end;
  begin delete from notification_service.notifications;
    raise exception 'Notification deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from notification_service.notifications; raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
