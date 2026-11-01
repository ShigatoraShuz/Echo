begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;

do $$ begin
 if has_function_privilege('anon','ai_analysis.claim_native_job(text,text,uuid[],timestamptz)','execute')
   or has_function_privilege('authenticated','ai_analysis.claim_native_job(text,text,uuid[],timestamptz)','execute')
   or has_function_privilege('anon','ai_analysis.recover_native_jobs(text,uuid[],timestamptz)','execute')
   or has_function_privilege('authenticated','ai_analysis.recover_native_jobs(text,uuid[],timestamptz)','execute') then
   raise exception 'Engineering model worker is browser callable';
 end if;
 perform pg_temp.assert_true(has_function_privilege('service_role','ai_analysis.claim_native_job(text,text,uuid[],timestamptz)','execute'),'trusted worker permission');
end $$;

insert into auth.users(id,email) values
 ('e0000000-0000-4000-8000-000000000001','engineering-owner@example.invalid'),
 ('e0000000-0000-4000-8000-000000000002','engineering-other@example.invalid');
insert into user_service.profiles(user_id,account_status,onboarding_completed,eligible_18_plus)
select id,'active',true,true from auth.users where email in ('engineering-owner@example.invalid','engineering-other@example.invalid')
on conflict(user_id) do update set account_status='active',onboarding_completed=true,eligible_18_plus=true;
insert into user_service.privacy_preferences(user_id,journal_ai_analysis_enabled)
select id,true from auth.users where email in ('engineering-owner@example.invalid','engineering-other@example.invalid')
on conflict(user_id) do update set journal_ai_analysis_enabled=true;
insert into verification_service.identity_verifications(user_id,verification_status,approved_expires_at)
select id,'approved',now()+interval '1 year' from auth.users where email in ('engineering-owner@example.invalid','engineering-other@example.invalid');
insert into user_service.trusted_contacts(user_id,contact_name,contact_email,relationship,permission_acknowledged_at)
select id,'Fictional test contact','fictional@example.invalid','Test fixture',now() from auth.users where email in ('engineering-owner@example.invalid','engineering-other@example.invalid');
insert into user_service.user_consents(user_id,consent_type,consent_version,accepted,accepted_at)
select u.id,d.document_type,d.version,true,now() from auth.users u cross join auth_provisioning.policy_documents d
where u.email in ('engineering-owner@example.invalid','engineering-other@example.invalid') and d.is_active
on conflict(user_id,consent_type,consent_version) do update set accepted=true,accepted_at=now(),revoked_at=null;
insert into ai_analysis.worker_health(worker_id,accepting_jobs,last_heartbeat_at) values('echo-native-development-v1',true,now());

do $$ declare j record; rejected boolean; begin
 update user_service.privacy_preferences set facial_analysis_enabled=true where user_id='e0000000-0000-4000-8000-000000000001';
 select * into j from journal_service.submit_journal('e0000000-0000-4000-8000-000000000001','[encrypted]','cipher','iv','tag',1,1,'calm','[]','[]','private',true,'queued',null,'local_worker','test-v1','face-key','face-request');
 perform ai_analysis.save_journal_face_result('e0000000-0000-4000-8000-000000000001',j.journal_id,'echo:encrypted:v1:fictional-ciphertext',true);
 perform pg_temp.assert_true((select result_ciphertext='echo:encrypted:v1:fictional-ciphertext' from ai_analysis.journal_face_results where journal_id=j.journal_id),'encrypted result persisted');
 rejected:=false;
 begin perform ai_analysis.save_journal_face_result('e0000000-0000-4000-8000-000000000002',j.journal_id,'echo:encrypted:v1:foreign',true); exception when others then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'other account rejected');
 update user_service.privacy_preferences set facial_analysis_enabled=false where user_id='e0000000-0000-4000-8000-000000000001';
 rejected:=false;
 begin perform ai_analysis.save_journal_face_result('e0000000-0000-4000-8000-000000000001',j.journal_id,'echo:encrypted:v1:revoked',true); exception when others then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'revoked face consent rejected');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','ai_analysis.save_journal_face_result(uuid,uuid,text,boolean)','execute'),'browser cannot save arbitrary face predictions');
end $$;
rollback;
