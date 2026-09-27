begin;
insert into auth.users(id,email) values
 ('30000000-0000-4000-8000-000000000001','experience-a@example.test'),
 ('30000000-0000-4000-8000-000000000002','experience-b@example.test');
insert into buddy_service.buddy_conversations(id,user_id) values
 ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
 ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
insert into buddy_service.buddy_messages(conversation_id,user_id,role,content) values
 ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','user','echo:encrypted:v1:synthetic-a'),
 ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','assistant','echo:encrypted:v1:synthetic-b');
insert into grounding_service.grounding_sessions(user_id,exercise_type,duration_seconds) values
 ('30000000-0000-4000-8000-000000000001','breathing',60),('30000000-0000-4000-8000-000000000002','breathing',60);
insert into user_service.user_consents(user_id,consent_type,consent_version,accepted,source,accepted_at) values
 ('30000000-0000-4000-8000-000000000001','journal_analysis','synthetic-v1',true,'onboarding',now()),
 ('30000000-0000-4000-8000-000000000002','journal_analysis','synthetic-v1',true,'onboarding',now());
-- Explicit synthetic Auth sessions model the claims supplied by PostgREST.
insert into user_service.profiles(user_id,account_status) select id,'active' from auth.users on conflict(user_id) do nothing;
insert into auth.sessions(id,user_id) select id,id from auth.users on conflict(id) do nothing;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","session_id":"30000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 if (select count(*) from buddy_service.buddy_messages)<>1 then raise exception 'Buddy message isolation failed'; end if;
 if (select count(*) from buddy_service.buddy_conversations)<>1 then raise exception 'Conversation isolation failed'; end if;
 if (select count(*) from grounding_service.grounding_sessions)<>1 then raise exception 'Grounding isolation failed'; end if;
 if (select count(*) from user_service.user_consents)<>1 then raise exception 'Consent isolation failed'; end if;
 if exists(select 1 from buddy_service.buddy_messages where conversation_id='31000000-0000-4000-8000-000000000002') then raise exception 'Known foreign conversation leaked'; end if;
 begin insert into buddy_service.buddy_messages(conversation_id,user_id,role,content)
 values('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','assistant','echo:encrypted:v1:forged');
 raise exception 'Assistant message forgery'; exception when insufficient_privilege then null; end;
 begin update user_service.user_consents set accepted=false; raise exception 'Consent overwrite'; exception when insufficient_privilege then null; end;
 begin delete from grounding_service.grounding_sessions; raise exception 'Grounding direct delete'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
