begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then
   if position(expected in sqlerrm)>0 then return; end if;
   raise exception 'Wrong error: %, expected %',sqlerrm,expected;
 end;
 raise exception 'Expected error was not raised: %',expected;
end $$;

insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','analysis-test-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','analysis-test-b@example.invalid');
insert into user_service.profiles(user_id,account_status,onboarding_completed,eligible_18_plus)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active',true,true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active',true,true)
 on conflict(user_id) do update set account_status='active',onboarding_completed=true,eligible_18_plus=true;
insert into user_service.privacy_preferences(user_id,journal_ai_analysis_enabled) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true)
 on conflict(user_id) do update set journal_ai_analysis_enabled=true;
insert into verification_service.identity_verifications(user_id,verification_status,is_minor,approved_expires_at)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved',false,now()+interval '1 year'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','approved',false,now()+interval '1 year');
insert into user_service.user_consents(user_id,consent_type,consent_version,accepted,accepted_at)
 select u.id,d.document_type,d.version,true,now() from auth.users u cross join auth_provisioning.policy_documents d
 where u.id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') and d.is_active
 on conflict(user_id,consent_type,consent_version) do update set accepted=true,accepted_at=now(),revoked_at=null;
insert into user_service.trusted_contacts(user_id,contact_name,contact_email,relationship,permission_acknowledged_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Trusted person','trusted-a@example.invalid','Friend',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Trusted person','trusted-b@example.invalid','Friend',now());
insert into user_service.notification_preferences(user_id,in_app_enabled,insight_notifications_enabled)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,true)
on conflict(user_id) do update set in_app_enabled=true,insight_notifications_enabled=true;
select pg_temp.assert_true(ai_analysis.current_gates_allow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'eligible fixture');


do $$ declare owner uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; journal uuid; job uuid; claimed jsonb; outcome jsonb; n integer;
begin
 insert into journal_service.journals(user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,word_count,emotions,tags,privacy_status,analysis_consent)
 values(owner,'[encrypted]','synthetic','iv','tag',1,1,'[]','[]','private',true) returning id into journal;
 insert into ai_analysis.analysis_requests(user_id,request_id,source_feature,source_record_id,journal_id,analysis_type,status,progress,processing_mode)
 values(owner,gen_random_uuid(),'journal',journal,journal,'journal_reflection','queued',5,'local_worker') returning id into job;
 insert into ai_analysis.worker_health(worker_id,accepting_jobs,last_heartbeat_at,metadata) values('echo-native-development-v1',true,now(),'{}')
 on conflict(worker_id) do update set accepting_jobs=true,last_heartbeat_at=now();
 for n in 1..4 loop
   claimed:=ai_analysis.claim_native_job('echo-native-development-v1',repeat('a',64),array[owner],now()-interval '1 day');
   perform pg_temp.assert_true((claimed->>'jobId')::uuid=job,'claim succeeds after capacity recovery');
   perform ai_analysis.apply_worker_callback(job,'progress','progress-'||n,'progress-hash-'||n,'echo-native-development-v1',repeat('a',64),'{"status":"safety_checking"}');
   outcome:=ai_analysis.apply_worker_callback(job,'failure','capacity-'||n,'capacity-hash-'||n,'echo-native-development-v1',repeat('a',64),'{"code":"CAPACITY_WAIT"}');
   perform pg_temp.assert_true(outcome->>'status'='retrying','capacity waits remain recoverable');
   perform pg_temp.assert_true((select attempt_count=0 and capacity_wait_count=n and lease_token_hash is null from ai_analysis.analysis_requests where id=job),'capacity does not consume attempts and revokes old lease');
   perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L::jsonb)',job,'failure','late','late-hash','echo-native-development-v1',repeat('a',64),'{"code":"CAPACITY_WAIT"}'),'LEASE_REJECTED');
   update public.analysis_status_projection set updated_at=now()-interval '6 seconds' where job_id=job;
   perform ai_analysis.recover_native_jobs('echo-native-development-v1',array[owner],now()-interval '1 day');
   perform pg_temp.assert_true((select status='queued' from ai_analysis.analysis_requests where id=job),'requeue receipt stays unique across repeated capacity waits');
 end loop;
end $$;
rollback;
