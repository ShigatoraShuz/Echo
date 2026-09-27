begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','settings-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','settings-b@example.test');
insert into user_service.profiles(user_id) values
 ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into user_service.trusted_contacts(user_id,contact_name,relationship,contact_email) values
 ('10000000-0000-4000-8000-000000000001','Synthetic A','friend','a@example.test'),
 ('10000000-0000-4000-8000-000000000002','Synthetic B','friend','b@example.test');
-- Explicit synthetic Auth sessions model the claims supplied by PostgREST.
insert into user_service.profiles(user_id,account_status) select id,'active' from auth.users on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id) select id,id from auth.users on conflict(id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
do $$ declare affected integer; begin
 if (select count(*) from user_service.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
 if (select count(*) from user_service.trusted_contacts)<>1 then raise exception 'Contact isolation failed'; end if;
 update user_service.profiles set display_name='Allowed';
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Own profile update denied'; end if;
 update user_service.trusted_contacts set contact_name='Cross-user' where user_id='10000000-0000-4000-8000-000000000002';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Contact update crossed owner'; end if;
 delete from user_service.trusted_contacts where user_id='10000000-0000-4000-8000-000000000002';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Contact deletion crossed owner'; end if;
 begin update user_service.profiles set eligible_18_plus=true;
 raise exception 'Age assurance writable'; exception when insufficient_privilege then null; end;
 begin update user_service.profiles set account_status='active';
 raise exception 'Account state writable'; exception when insufficient_privilege then null; end;
 begin update user_service.trusted_contacts set verified=true;
 raise exception 'Contact verification writable'; exception when insufficient_privilege then null; end;
 begin update user_service.trusted_contacts set user_id='10000000-0000-4000-8000-000000000002';
 raise exception 'Contact owner writable'; exception when insufficient_privilege then null; end;
 begin insert into user_service.trusted_contacts(user_id,contact_name,relationship,contact_email)
 values('10000000-0000-4000-8000-000000000002','Forged','friend','f@example.test');
 raise exception 'Cross-owner insert allowed'; exception when insufficient_privilege then null; end;
 begin insert into user_service.audit_events(user_id,event_type) values('10000000-0000-4000-8000-000000000001','forged');
 raise exception 'Audit forgery allowed'; exception when insufficient_privilege then null; end;
 begin update user_service.account_deletion_requests set request_status='completed';
 raise exception 'Deletion state writable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
