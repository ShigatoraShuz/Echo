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


do $$ declare owner uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; journal uuid; oldjob uuid; stamp timestamptz; value jsonb; beforetext text; payload jsonb;
begin
 insert into journal_service.journals(user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,word_count,emotions,tags,privacy_status,analysis_consent)
 values(owner,'[encrypted]','original-cipher','iv','tag',1,2,'[]','[]','private',true) returning id,updated_at into journal,stamp;
 insert into ai_analysis.analysis_requests(user_id,request_id,source_feature,source_record_id,journal_id,analysis_type,status,progress,processing_mode)
 values(owner,gen_random_uuid(),'journal',journal,journal,'journal_reflection','safety_checking',10,'local_worker') returning id into oldjob;
 update ai_analysis.analysis_requests set lease_token_hash='old-lease',lease_worker_id='old-worker',lease_expires_at=now()+interval '5 minutes' where id=oldjob;
 insert into public.analysis_status_projection(user_id,journal_id,job_id,status,progress) values(owner,journal,oldjob,'safety_checking',10) on conflict(job_id) do nothing;
 insert into ai_analysis.journal_face_results(journal_id,user_id,result_ciphertext) values(journal,owner,'echo:encrypted:v1:synthetic');
 payload:=jsonb_build_object('content_ciphertext','edited-cipher','encryption_iv','iv2','encryption_auth_tag','tag2','encryption_key_version',1,'word_count',3,'emotions','[]'::jsonb,'tags','[]'::jsonb,'privacy_status','private');
 value:=journal_service.edit_journal(owner,journal,stamp,payload,true,'development_stub','queued');
 perform pg_temp.assert_true((value->'entry'->>'updated_at')::timestamptz>stamp,'edit advances revision fence');
 perform pg_temp.expect_error(format('select journal_service.edit_journal(%L,%L,%L,%L,true,%L,%L)',owner,journal,stamp,payload,'development_stub','queued'),'JOURNAL_EDIT_CONFLICT');
 perform pg_temp.assert_true((value->>'jobId')::uuid<>oldjob,'new analysis job');
 perform pg_temp.assert_true((select status='failed' and deleted_at is not null and lease_token_hash is null from ai_analysis.analysis_requests where id=oldjob),'old worker fenced');
 perform pg_temp.assert_true(not exists(select 1 from ai_analysis.journal_face_results where journal_id=journal),'old face result removed');
 perform pg_temp.assert_true((select count(*)=1 from public.analysis_status_projection where journal_id=journal),'only new progress remains');
 perform pg_temp.assert_true((select content_ciphertext='edited-cipher' from journal_service.journals where id=journal),'edited text saved');
 stamp:=(value->'entry'->>'updated_at')::timestamptz;
 update ai_analysis.quota_policy set per_user_daily=1 where singleton;
 perform pg_temp.expect_error(format('select journal_service.edit_journal(%L,%L,%L,%L::jsonb,true,%L,%L)',owner,journal,stamp,payload||jsonb_build_object('content_ciphertext','quota-rejected-edit'),'development_stub','queued'),'AI_QUOTA_EXCEEDED');
 perform pg_temp.assert_true((select content_ciphertext='edited-cipher' from journal_service.journals where id=journal),'queue admission failure rolls back text');
 perform pg_temp.assert_true((select deleted_at is null from ai_analysis.analysis_requests where id=(value->>'jobId')::uuid),'queue admission failure restores prior active job');
 perform pg_temp.expect_error(format('select journal_service.edit_journal(%L,%L,%L,%L::jsonb,false,%L,%L)','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',journal,stamp,payload,'disabled','saved'),'JOURNAL_NOT_FOUND');
 perform pg_temp.expect_error(format('select journal_service.edit_journal(%L,%L,%L,%L::jsonb,false,%L,%L)',owner,journal,stamp-interval '1 second',payload,'disabled','saved'),'JOURNAL_EDIT_CONFLICT');
 perform pg_temp.expect_error(format('select ai_analysis.complete_worker_callback(%L,%L::jsonb,%L,%L,%L,%L,%L)',oldjob,'{}','final_result','receipt','hash','old-worker','old-lease'),'LEASE_REJECTED');
 perform pg_temp.expect_error(format('select ai_analysis.save_journal_face_result_for_revision(%L,%L,%L,%L,true)',owner,journal,stamp-interval '1 second','echo:encrypted:v1:stale'),'JOURNAL_EDIT_CONFLICT');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','journal_service.edit_journal(uuid,uuid,timestamptz,jsonb,boolean,text,text)','EXECUTE'),'RPC restricted to trusted backend');
end $$;
rollback;
