begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;

do $$ begin
 if has_function_privilege('anon','ai_analysis.claim_engineering_job(text,text,uuid[])','execute')
   or has_function_privilege('authenticated','ai_analysis.claim_engineering_job(text,text,uuid[])','execute')
   or has_function_privilege('anon','ai_analysis.recover_engineering_jobs(text,uuid[])','execute')
   or has_function_privilege('authenticated','ai_analysis.recover_engineering_jobs(text,uuid[])','execute') then
   raise exception 'Engineering model worker is browser callable';
 end if;
 perform pg_temp.assert_true(has_function_privilege('service_role','ai_analysis.claim_engineering_job(text,text,uuid[])','execute'),'trusted worker permission');
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
insert into ai_analysis.worker_health(worker_id,accepting_jobs,last_heartbeat_at) values('echo-http-engineering-v1',true,now());

do $$ declare own record; other_job record; lease jsonb; scope uuid[]:=array['e0000000-0000-4000-8000-000000000001'::uuid];
begin
 select * into other_job from journal_service.submit_journal('e0000000-0000-4000-8000-000000000002','[encrypted]','cipher','iv','tag',1,1,'calm','[]','[]','private',true,'queued',null,'local_worker','test-v1','other-key','other-request');
 perform pg_temp.assert_true(ai_analysis.claim_engineering_job('echo-http-engineering-v1',repeat('a',64),scope) is null,'never claim another user');
 perform pg_temp.assert_true((select lease_token_hash is null and attempt_count=0 from ai_analysis.analysis_requests where id=other_job.analysis_job_id),'foreign queue untouched');
 select * into own from journal_service.submit_journal('e0000000-0000-4000-8000-000000000001','[encrypted]','cipher','iv','tag',1,1,'calm','[]','[]','private',true,'queued',null,'local_worker','test-v1','own-key','own-request');
 lease:=ai_analysis.claim_engineering_job('echo-http-engineering-v1',repeat('b',64),scope);
 perform pg_temp.assert_true((lease->>'jobId')::uuid=own.analysis_job_id,'claim exact scoped job');
 update ai_analysis.analysis_requests set lease_expires_at=now()-interval '1 second' where id=own.analysis_job_id;
 perform ai_analysis.recover_engineering_jobs('echo-http-engineering-v1',scope);
 perform pg_temp.assert_true((select status='retrying' and lease_token_hash is null from ai_analysis.analysis_requests where id=own.analysis_job_id),'expired scoped lease recovered');
 perform pg_temp.assert_true((select status='queued' and attempt_count=0 from ai_analysis.analysis_requests where id=other_job.analysis_job_id),'recovery leaves foreign job unchanged');
 update public.analysis_status_projection set updated_at=now()-interval '10 seconds' where job_id=own.analysis_job_id;
 perform ai_analysis.recover_engineering_jobs('echo-http-engineering-v1',scope);
 perform pg_temp.assert_true((select status='queued' from ai_analysis.analysis_requests where id=own.analysis_job_id),'retry requeues using real projection timestamp');
 update user_service.privacy_preferences set journal_ai_analysis_enabled=false where user_id=scope[1];
 perform pg_temp.assert_true(ai_analysis.claim_engineering_job('echo-http-engineering-v1',repeat('c',64),scope) is null,'revoked consent blocks inference');
 perform pg_temp.assert_true((select status='failed' and failure_code='CURRENT_GATES_FAILED' from ai_analysis.analysis_requests where id=own.analysis_job_id),'denied scope audited and terminal');
end $$;
rollback;
