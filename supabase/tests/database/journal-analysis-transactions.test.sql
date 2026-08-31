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
select pg_temp.assert_true(ai_analysis.current_gates_allow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'eligible fixture');

create temp table test_jobs(label text primary key,journal_id uuid,job_id uuid);
do $$ declare r record; replay record; before_count integer;
begin
 select * into r from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v1','private-hmac','request-1');
 perform pg_temp.assert_true(r.analysis_job_id is null and r.result_status='saved','private save creates no job');
 perform pg_temp.assert_true(not exists(select 1 from public.analysis_status_projection where journal_id=r.journal_id),'private save creates no status');
 select * into replay from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','different-cipher-same-normalized-request','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v1','private-hmac','request-1');
 perform pg_temp.assert_true(replay.journal_id=r.journal_id and replay.replayed,'same request replays identifiers');
 perform pg_temp.expect_error($q$select * from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',false,'saved',null,'disabled','v1','private-hmac','changed')$q$,'IDEMPOTENCY_CONFLICT');
 perform pg_temp.expect_error(format('update journal_service.journals set title=%L where id=%L','plaintext title',r.journal_id),'compatibility sentinel');
 select * into r from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',true,'queued',null,'disabled','v1','waiting-hmac','request-2');
 perform pg_temp.assert_true(r.result_status='waiting_for_provider','disabled initial state created transactionally');
 insert into test_jobs values('waiting',r.journal_id,r.analysis_job_id);
 select * into r from journal_service.submit_journal('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',true,'queued',null,'local_worker','v1','other-user-hmac','request-2');
 perform pg_temp.assert_true(r.result_status='waiting_for_provider','unavailable worker waits');
 insert into test_jobs values('other',r.journal_id,r.analysis_job_id);
 perform ai_analysis.reserve_rejected_submission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','v1','rejected-hmac','request-reject','ANALYSIS_GATE_FAILED');
 perform ai_analysis.reserve_rejected_submission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','v1','rejected-hmac','request-reject','ANALYSIS_GATE_FAILED');
 perform pg_temp.assert_true((select state='rejected' and expires_at=created_at+interval '24 hours' from ai_analysis.idempotency_records where key_hmac='rejected-hmac'),'rejected reservation is not successful and expires at 24 hours');
 perform pg_temp.expect_error($q$select ai_analysis.reserve_rejected_submission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','v1','rejected-hmac','changed','GATE')$q$,'IDEMPOTENCY_CONFLICT');
 select count(*) into before_count from journal_service.journals;
 update user_service.privacy_preferences set journal_ai_analysis_enabled=false where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 perform pg_temp.expect_error($q$select * from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',true,'queued',null,'development_stub','v1','gate-hmac','gate-request')$q$,'ANALYSIS_GATE_FAILED');
 perform pg_temp.assert_true((select count(*)=before_count from journal_service.journals),'gate error saves nothing');
 update user_service.privacy_preferences set journal_ai_analysis_enabled=true where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
end $$;

-- Realtime's entire published row is minimal, and owner RLS filters selects.
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select pg_temp.assert_true((select count(*)=1 from public.analysis_status_projection),'owner-only projection');
select pg_temp.expect_error('select * from ai_analysis.analysis_requests','permission denied');
select pg_temp.expect_error('update public.analysis_status_projection set progress=100','permission denied');
reset role;

insert into ai_analysis.worker_health(worker_id,accepting_jobs,last_heartbeat_at) values('local-worker',true,now());
do $$ declare job uuid; claimed jsonb; result jsonb; receipt jsonb; result_id uuid; audit_count integer;
begin
 select job_id into job from test_jobs where label='waiting';
 perform pg_temp.assert_true(ai_analysis.requeue_job(job,'local_worker','waiting:0:test')='queued','current-gate checked requeue');
 select count(*) into audit_count from user_service.audit_events where event_type='analysis.requeued' and resource_id=job;
 perform ai_analysis.requeue_job(job,'local_worker','waiting:0:test');
 perform pg_temp.assert_true((select count(*)=audit_count from user_service.audit_events where event_type='analysis.requeued' and resource_id=job),'requeue audit exactly once');
 claimed:=ai_analysis.claim_worker_job('local-worker','lease-hash');
 perform pg_temp.assert_true((claimed->>'jobId')::uuid=job,'claim is owned and leased');
 receipt:=ai_analysis.apply_worker_callback(job,'progress','callback-1','hash-1','local-worker','lease-hash','{"status":"safety_checking"}');
 perform pg_temp.assert_true(ai_analysis.apply_worker_callback(job,'progress','callback-1','hash-1','local-worker','lease-hash','{"status":"safety_checking"}')=receipt,'exact callback replay');
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'progress','callback-1','different','local-worker','lease-hash','{"status":"safety_checking"}'),'CALLBACK_IDEMPOTENCY_CONFLICT');
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'progress','callback-1','hash-1','wrong-worker','lease-hash','{"status":"safety_checking"}'),'LEASE_REJECTED');
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'progress','skip-safety','skip-hash','local-worker','lease-hash','{"status":"classifying_distress"}'),'INVALID_ANALYSIS_TRANSITION');
 perform ai_analysis.apply_worker_callback(job,'safety_result','callback-2','hash-2','local-worker','lease-hash','{"actionRequired":false}');
 perform ai_analysis.apply_worker_callback(job,'progress','callback-3','hash-3','local-worker','lease-hash','{"status":"classifying_distress"}');
 perform ai_analysis.apply_worker_callback(job,'progress','callback-4','hash-4','local-worker','lease-hash','{"status":"estimating_screening"}');
 perform ai_analysis.apply_worker_callback(job,'progress','callback-5','hash-5','local-worker','lease-hash','{"status":"generating_recommendation"}');
 result:='{"schemaVersion":"echo-journal-analysis-v1","thresholdVersion":"v1","providerName":"protocol-test","modelVersion":"fixture","isSimulated":true,"emotionDistribution":[{"emotion":"joy","value":0.1},{"emotion":"calm","value":0.5},{"emotion":"sadness","value":0.1},{"emotion":"anxiety","value":0.1},{"emotion":"anger","value":0.1},{"emotion":"hope","value":0.1}],"dominantEmotion":"calm","emotionConfidence":0.8,"distressBand":"low","distressConfidence":0.8,"depressiveSymptomRange":{"lower":0,"upper":4},"recommendationFeatures":["paced_breathing"]}';
 result_id:=ai_analysis.complete_worker_callback(job,result,'final_result','final-key','final-hash','local-worker','lease-hash');
 perform pg_temp.assert_true(ai_analysis.complete_worker_callback(job,result,'final_result','final-key','final-hash','local-worker','lease-hash')=result_id,'completed exact final receipt replays');
 perform pg_temp.expect_error(format('select ai_analysis.complete_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,result,'final_result','new-key','final-hash','local-worker','lease-hash'),'LEASE_REJECTED');
 perform pg_temp.assert_true((select status='completed' and progress=100 from ai_analysis.analysis_requests where id=job),'terminal job state');
 perform pg_temp.assert_true((select count(*)=1 from ai_analysis.recommendation_selections where analysis_result_id=result_id),'reviewed selection committed');
 perform pg_temp.assert_true((select count(*)=1 from ai_analysis.aggregation_tasks where analysis_result_id=result_id),'aggregation enqueued separately');
 perform pg_temp.expect_error(format('update ai_analysis.analysis_results set result_payload=%L where id=%L','{}',result_id),'IMMUTABLE');
 perform pg_temp.expect_error(format('update ai_analysis.analysis_requests set progress=80 where id=%L',job),'TERMINAL');
 perform ai_analysis.run_aggregation_tasks(20);
 perform ai_analysis.run_aggregation_tasks(20);
 perform pg_temp.assert_true((select source_count=0 from insights_service.weekly_analysis_metrics where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'simulated result excluded from aggregates');
 update journal_service.journals set deleted_at=now()-interval '31 days' where id=(select journal_id from test_jobs where label='waiting');
 perform pg_temp.assert_true(not exists(select 1 from public.analysis_status_projection where job_id=job),'deletion removes public status immediately');
 perform pg_temp.expect_error(format('select ai_analysis.complete_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,result,'final_result','final-key','final-hash','local-worker','lease-hash'),'LEASE_REJECTED');
 perform ai_analysis.run_retention(true);
 perform pg_temp.assert_true(exists(select 1 from ai_analysis.analysis_requests where id=job),'dry run preserves source');
 perform ai_analysis.run_retention(false);
 perform pg_temp.assert_true(not exists(select 1 from ai_analysis.analysis_results where id=result_id),'purge cascades results');
 perform pg_temp.assert_true(not exists(select 1 from ai_analysis.callback_receipts where job_id=job),'purge cascades receipts');
 perform pg_temp.assert_true(not exists(select 1 from user_service.audit_events where resource_id=job),'purge strips audit identifiers');
end $$;
do $$ declare job uuid; claimed jsonb; r record; receipt jsonb; final_progress integer;
begin
 select job_id into job from test_jobs where label='other';
 perform ai_analysis.requeue_job(job,'local_worker','waiting:0:safety');
 claimed:=ai_analysis.claim_worker_job('local-worker','safety-lease');
 perform pg_temp.assert_true((claimed->>'jobId')::uuid=job,'safety job claimed');
 perform ai_analysis.apply_worker_callback(job,'progress','safety-1','safety-hash-1','local-worker','safety-lease','{"status":"safety_checking"}');
 perform ai_analysis.apply_worker_callback(job,'safety_result','safety-2','safety-hash-2','local-worker','safety-lease','{"actionRequired":true}');
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'safety_result','resume','resume-hash','local-worker','safety-lease','{"actionRequired":false}'),'INVALID_ANALYSIS_TRANSITION');
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'failure','fail','fail-hash','local-worker','safety-lease','{}'),'SAFETY_REVIEW_REQUIRED');
 update ai_analysis.analysis_requests set lease_expires_at=now()-interval '1 second' where id=job;
 perform ai_analysis.release_expired_worker_leases();
 perform pg_temp.assert_true((select status='safety_action_required' and lease_token_hash is null from ai_analysis.analysis_requests where id=job),'lease expiry never resumes paused safety');
 perform pg_temp.expect_error(format('select ai_analysis.resolve_safety_review(%L,%L,%L,%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',job,'approved_continue','review-key'),'PERMISSION_REQUIRED');
 insert into ai_analysis.safety_reviewers(user_id,active) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 update user_service.privacy_preferences set journal_ai_analysis_enabled=false where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 perform pg_temp.expect_error(format('select ai_analysis.resolve_safety_review(%L,%L,%L,%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',job,'approved_continue','review-key'),'ANALYSIS_GATE_FAILED');
 update user_service.privacy_preferences set journal_ai_analysis_enabled=true where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 receipt:=ai_analysis.resolve_safety_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',job,'approved_continue','review-key');
 perform pg_temp.assert_true(receipt->>'status'='analyzing_emotions','reviewed continuation');
 perform pg_temp.assert_true((ai_analysis.resolve_safety_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',job,'approved_continue','review-key')->>'replayed')::boolean,'review replay');
 claimed:=ai_analysis.claim_worker_job('local-worker','reviewed-lease');
 perform pg_temp.assert_true((claimed->>'jobId')::uuid=job and claimed->>'status'='analyzing_emotions','reviewed worker continuation can be claimed');
 update journal_service.journals set deleted_at=now() where id=(select journal_id from test_jobs where label='other');
 perform pg_temp.assert_true((select status='failed' and lease_token_hash is null from ai_analysis.analysis_requests where id=job),'deletion cancels and revokes');

 select * into r from journal_service.submit_journal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[encrypted]','cipher','iv','tag',1,2,'calm','[]','[]','private',true,'waiting_for_provider',null,'local_worker','v1','retry-hmac','retry-request');
 job:=r.analysis_job_id;
 perform pg_temp.assert_true(r.result_status='queued','available worker initially queued');
 claimed:=ai_analysis.claim_worker_job('local-worker','retry-lease-1');
 update ai_analysis.analysis_requests set lease_expires_at=now()-interval '1 second' where id=job;
 perform pg_temp.expect_error(format('select ai_analysis.apply_worker_callback(%L,%L,%L,%L,%L,%L,%L)',job,'heartbeat','expired-key','expired-hash','local-worker','retry-lease-1','{}'),'LEASE_REJECTED');
 perform pg_temp.assert_true(not exists(select 1 from ai_analysis.callback_receipts where key_hmac='expired-key'),'expired callback writes no receipt');
 perform ai_analysis.release_expired_worker_leases();
 perform pg_temp.assert_true((select status='retrying' and progress=70 from ai_analysis.analysis_requests where id=job),'first retry floor');
 perform ai_analysis.requeue_job(job,'local_worker','retrying:1:test');
 claimed:=ai_analysis.claim_worker_job('local-worker','retry-lease-2');
 perform ai_analysis.apply_worker_callback(job,'progress','retry-stage','retry-stage-hash','local-worker','retry-lease-2','{"status":"safety_checking"}');
 perform pg_temp.assert_true((select progress=72 from ai_analysis.analysis_requests where id=job),'second attempt progress range');
 perform ai_analysis.apply_worker_callback(job,'failure','retry-failure','retry-failure-hash','local-worker','retry-lease-2','{}');
 perform pg_temp.assert_true((select progress=92 from ai_analysis.analysis_requests where id=job),'second retry floor');
 perform ai_analysis.requeue_job(job,'local_worker','retrying:2:test');
 claimed:=ai_analysis.claim_worker_job('local-worker','retry-lease-3');
 select a.progress into final_progress from ai_analysis.analysis_requests a where id=job;
 perform ai_analysis.apply_worker_callback(job,'failure','last-failure','last-failure-hash','local-worker','retry-lease-3','{}');
 perform pg_temp.assert_true((select a.status='failed' and a.progress=final_progress and a.attempt_count=3 from ai_analysis.analysis_requests a where id=job),'third failure is terminal and retains progress');
 perform pg_temp.expect_error(format('select ai_analysis.requeue_job(%L,%L,%L)',job,'local_worker','retrying:3:test'),'INVALID_ANALYSIS_TRANSITION');
 perform pg_temp.assert_true((select bool_and(expires_at=completed_at+interval '30 days') from ai_analysis.callback_receipts c join ai_analysis.analysis_requests a on a.id=c.job_id where a.id=job),'callback receipt retention starts at terminal completion');
end $$;
rollback;
