begin;
set local timezone='Pacific/Kiritimati';
insert into auth.users(id,email) values ('73000000-0000-4000-8000-000000000001','delete-a@example.test'),('73000000-0000-4000-8000-000000000002','delete-b@example.test');
set local role service_role;
do $$ declare first_id uuid; second_id uuid; begin
 first_id:=user_service.request_account_deletion('73000000-0000-4000-8000-000000000001');
 second_id:=user_service.request_account_deletion('73000000-0000-4000-8000-000000000001');
 if first_id<>second_id or (select count(*) from user_service.account_deletion_requests where user_id='73000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate deletion request'; end if;
 if not exists(select 1 from user_service.account_deletion_requests where id=first_id and requested_at=now() and scheduled_for=now()+interval '30 days') then raise exception 'Deletion schedule shifted by timezone'; end if;
 if (select count(*) from user_service.audit_events where resource_id=first_id and event_type='settings.account_deletion_requested')<>1 then raise exception 'Missing or repeated request audit'; end if;
 if user_service.cancel_account_deletion('73000000-0000-4000-8000-000000000002',first_id) then raise exception 'Cross-owner cancellation'; end if;
 if not user_service.cancel_account_deletion('73000000-0000-4000-8000-000000000001',first_id) then raise exception 'Owner cancellation failed'; end if;
 if user_service.cancel_account_deletion('73000000-0000-4000-8000-000000000001',first_id) then raise exception 'Cancelled request mutated again'; end if;
 second_id:=user_service.request_account_deletion('73000000-0000-4000-8000-000000000001');
 update user_service.account_deletion_requests set request_status='processing' where id=second_id;
 if user_service.cancel_account_deletion('73000000-0000-4000-8000-000000000001',second_id) then raise exception 'Processing deletion cancelled'; end if;
end $$;
reset role;
-- An unavailable append-only audit sink must roll back the associated privacy state change.
revoke insert on user_service.audit_events from service_role;
set local role service_role;
do $$ begin
 begin perform user_service.request_account_deletion('73000000-0000-4000-8000-000000000002'); raise exception 'Unaudited request accepted';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from user_service.account_deletion_requests where user_id='73000000-0000-4000-8000-000000000002') then raise exception 'Audit failure left request behind'; end if;
end $$;
reset role;
grant insert on user_service.audit_events to service_role;
set local role authenticated;
do $$ begin
 begin perform user_service.request_account_deletion('73000000-0000-4000-8000-000000000002'); raise exception 'Browser bypasses recent authentication';
 exception when insufficient_privilege then null; end;
 begin perform user_service.cancel_account_deletion('73000000-0000-4000-8000-000000000002',gen_random_uuid()); raise exception 'Browser bypasses owner API';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
