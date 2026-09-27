begin;
insert into auth.users(id,email) values
 ('20000000-0000-4000-8000-000000000001','contact-a@example.test'),
 ('20000000-0000-4000-8000-000000000002','contact-b@example.test');
insert into user_service.trusted_contacts(id,user_id,contact_name,relationship,contact_email,is_primary) values
 ('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A','friend','a@example.test',true),
 ('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','B','friend','b@example.test',true);
-- Explicit synthetic Auth sessions model the claims supplied by PostgREST.
insert into user_service.profiles(user_id,account_status) select id,'active' from auth.users on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id) select id,id from auth.users on conflict(id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$ declare saved uuid; begin
 begin
  perform user_service.save_trusted_contact('21000000-0000-4000-8000-000000000002','Forged','a@example.test',null,'friend',true,true);
  raise exception 'Cross-user contact save allowed';
 exception when no_data_found then null; end;
 if not (select is_primary from user_service.trusted_contacts where id='21000000-0000-4000-8000-000000000001') then
  raise exception 'Denied save changed primary contact'; end if;
 begin
  perform user_service.save_trusted_contact(null,'Invalid','a@example.test',null,'friend',true,false);
  raise exception 'Missing permission accepted';
 exception when check_violation then null; end;
 saved := user_service.save_trusted_contact(null,'New A','new@example.test',null,'friend',true,true);
 if (select count(*) from user_service.trusted_contacts where is_primary)<>1
 or not (select is_primary from user_service.trusted_contacts where id=saved) then
  raise exception 'Primary contact was not switched atomically'; end if;
 perform user_service.save_trusted_contact(saved,'Edited A','new@example.test',null,'friend',false,true);
 if (select contact_name from user_service.trusted_contacts where id=saved)<>'Edited A' then raise exception 'Own update failed'; end if;
end $$;
reset role;
do $$ begin
 if not (select is_primary from user_service.trusted_contacts where id='21000000-0000-4000-8000-000000000002') then raise exception 'Other owner changed'; end if;
 if has_function_privilege('anon','user_service.save_trusted_contact(uuid,text,text,text,text,boolean,boolean)','EXECUTE') then raise exception 'Anonymous contact save grant'; end if;
end $$;
rollback;
