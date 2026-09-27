begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','integrity-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','integrity-b@example.test');
insert into buddy_service.buddy_conversations(id,user_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into buddy_service.buddy_messages(id,conversation_id,user_id,role,content) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','user','echo:encrypted:v1:synthetic');
do $$ begin
 begin insert into buddy_service.buddy_conversations(user_id) values('10000000-0000-4000-8000-000000000099');
 raise exception 'Nonexistent owner allowed'; exception when foreign_key_violation then null; end;
 begin insert into buddy_service.buddy_feedback(message_id,user_id,rating) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',5);
 raise exception 'Cross-owner feedback allowed'; exception when foreign_key_violation then null; end;
 if buddy_service.replace_message_ciphertext('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('0',64),'echo:encrypted:v1:new') then raise exception 'Stale migration overwrote data'; end if;
 if not buddy_service.replace_message_ciphertext('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',encode(extensions.digest('echo:encrypted:v1:synthetic','sha256'),'hex'),'echo:encrypted:v1:new') then raise exception 'Valid migration failed'; end if;
end $$;
-- Delete a synthetic conversation and confirm child cleanup does not affect B.
delete from buddy_service.buddy_conversations where id='20000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from buddy_service.buddy_messages where conversation_id='20000000-0000-4000-8000-000000000001') then raise exception 'Message cascade failed'; end if;
 if not exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000002') then raise exception 'Unrelated account removed'; end if;
end $$;
rollback;
