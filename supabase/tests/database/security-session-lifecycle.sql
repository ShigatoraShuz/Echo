begin;
insert into auth.users(id,email) values('50000000-0000-4000-8000-000000000001','session-a@example.test');
insert into user_service.profiles(user_id,account_status) values('50000000-0000-4000-8000-000000000001','active') on conflict(user_id) do update set account_status='active';
insert into auth.sessions(id,user_id,not_after) values('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now()+interval '1 hour');
do $$ declare state text; begin
 if not user_service.security_session_active('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001') then raise exception 'Active session rejected'; end if;
 if user_service.security_session_active('50000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001') then raise exception 'Foreign session accepted'; end if;
 foreach state in array array['suspended','disabled','deleted'] loop
  update user_service.profiles set account_status=state where user_id='50000000-0000-4000-8000-000000000001';
  if user_service.security_session_active('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001') then raise exception 'Inactive account accepted: %',state; end if;
 end loop;
 update user_service.profiles set account_status='active' where user_id='50000000-0000-4000-8000-000000000001';
 update auth.sessions set not_after=now()-interval '1 second';
 if user_service.security_session_active('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001') then raise exception 'Expired session accepted'; end if;
 delete from auth.sessions;
 if user_service.security_session_active('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001') then raise exception 'Revoked session accepted'; end if;
 if has_function_privilege('authenticated','user_service.security_session_active(uuid,uuid)','EXECUTE') then raise exception 'Session inventory exposed'; end if;
end $$;
rollback;
