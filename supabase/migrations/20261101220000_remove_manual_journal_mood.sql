begin;
-- Remove manual mood storage. p_mood is retained only as an ignored legacy RPC argument.
create or replace function journal_service.emotion_insights_summary() returns jsonb language sql stable set search_path='' as $$ select jsonb_build_object('total',(select count(*) from journal_service.journals where user_id=(select auth.uid()) and deleted_at is null),'mood_counts','{}'::jsonb,'daily_scores','{}'::jsonb); $$;
CREATE OR REPLACE FUNCTION journal_service.submit_journal(p_user_id uuid, p_title_sentinel text, p_content_ciphertext text, p_encryption_iv text, p_encryption_auth_tag text, p_encryption_key_version integer, p_word_count integer, p_mood text, p_emotions jsonb, p_tags jsonb, p_privacy_status text, p_analysis_requested boolean, p_initial_status text, p_fixture text, p_processing_mode text, p_idempotency_key_version text, p_idempotency_hmac text, p_request_hash text)
 RETURNS TABLE(journal_id uuid, analysis_job_id uuid, result_status text, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'journal_service', 'ai_analysis', 'user_service'
AS $function$
declare
  v_existing ai_analysis.idempotency_records%rowtype;
  v_journal_id uuid := gen_random_uuid();
  v_job_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':journal.create:' || p_idempotency_key_version || ':' || p_idempotency_hmac,0));
  delete from ai_analysis.idempotency_records where user_id=p_user_id and operation='journal.create'
    and key_version=p_idempotency_key_version and key_hmac=p_idempotency_hmac and expires_at <= now();
  select * into v_existing from ai_analysis.idempotency_records
   where user_id=p_user_id and operation='journal.create'
     and key_version=p_idempotency_key_version and key_hmac=p_idempotency_hmac
     and expires_at > now() for update;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode='23505', message='IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.state='succeeded' then
      return query select (v_existing.response_payload->>'journalId')::uuid,
        nullif(v_existing.response_payload->>'analysisJobId','')::uuid,
        v_existing.response_payload->>'status', true;
      return;
    end if;
  else
    insert into ai_analysis.idempotency_records(user_id,operation,key_version,key_hmac,request_hash,state,expires_at)
      values(p_user_id,'journal.create',p_idempotency_key_version,p_idempotency_hmac,p_request_hash,'processing',now()+interval '24 hours');
  end if;

  if p_analysis_requested and not ai_analysis.current_gates_allow(p_user_id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
  if p_analysis_requested then
    p_initial_status := case when p_processing_mode='development_stub' then 'queued'
      when p_processing_mode='local_worker' and exists(select 1 from ai_analysis.worker_health where accepting_jobs and last_heartbeat_at>now()-interval '60 seconds') then 'queued'
      else 'waiting_for_provider' end;
  end if;
  insert into journal_service.journals(id,user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,
    encryption_key_version,word_count,emotions,tags,privacy_status,analysis_consent)
  values(v_journal_id,p_user_id,p_title_sentinel,p_content_ciphertext,p_encryption_iv,p_encryption_auth_tag,
    p_encryption_key_version,p_word_count,p_emotions,p_tags,p_privacy_status,p_analysis_requested);

  if p_analysis_requested then
    v_job_id := gen_random_uuid();
    insert into ai_analysis.analysis_requests(id,request_id,user_id,source_feature,source_record_id,journal_id,
      analysis_type,status,progress,fixture,processing_mode,retention_expires_at)
    values(v_job_id,gen_random_uuid(),p_user_id,'journal',v_journal_id,v_journal_id,'journal_reflection',
      p_initial_status,case when p_initial_status='queued' then 5 else 0 end,p_fixture,p_processing_mode,now()+interval '30 days');
    insert into public.analysis_status_projection(user_id,journal_id,job_id,status,progress)
      values(p_user_id,v_journal_id,v_job_id,p_initial_status,case when p_initial_status='queued' then 5 else 0 end);
  end if;

  insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,metadata)
    values(p_user_id,p_user_id,case when p_analysis_requested then 'journal.submitted_for_analysis' else 'journal.saved_private' end,
      'journal',v_journal_id,jsonb_build_object('analysis_requested',p_analysis_requested));

  update ai_analysis.idempotency_records set state='succeeded',response_status=case when p_analysis_requested then 202 else 201 end,
    response_payload=jsonb_build_object('journalId',v_journal_id,'analysisJobId',coalesce(v_job_id::text,''),
      'status',case when p_analysis_requested then p_initial_status else 'saved' end),updated_at=now()
    where user_id=p_user_id and operation='journal.create' and key_version=p_idempotency_key_version and key_hmac=p_idempotency_hmac;
  return query select v_journal_id,v_job_id,case when p_analysis_requested then p_initial_status else 'saved' end,false;
end $function$;

CREATE OR REPLACE FUNCTION user_service.collect_user_export(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
declare result jsonb := '{}'::jsonb; rows jsonb;
begin
 if p_user_id is null then raise exception 'EXPORT_OWNER_REQUIRED'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,analysis_request_id,actor,action,metadata,created_at from ai_analysis.analysis_audit_log where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.analysis_audit_log', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,source_feature,source_record_id,analysis_type,status,model_version_id,created_at,started_at,completed_at,failure_code,failure_message,journal_id,attempt_count,progress,fixture,processing_mode,retention_expires_at,deleted_at,facial_analysis_requested,facial_status,facial_capture_received_at,facial_capture_schema_version,facial_capture_model_version from ai_analysis.analysis_requests where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.analysis_requests', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,analysis_request_id,user_id,phq8_score,severity,urgent_language_detected,summary,perspective,mood_insight,risk_indication,confidence,is_demo_data,created_at,result_payload,schema_version,threshold_version,provider_name,model_version,is_simulated from ai_analysis.analysis_results where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.analysis_results', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,analysis_request_id,user_id,detected_emotion,emotion_distribution,confidence,camera_available,permission_granted,created_at from ai_analysis.facial_analysis_results where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.facial_analysis_results', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,analysis_result_id,user_id,rule_id,created_at from ai_analysis.recommendation_selections where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.recommendation_selections', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,analysis_result_id,score,band,supporting_factors,created_at from ai_analysis.risk_signal_snapshots where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.risk_signal_snapshots', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,analysis_request_id,event_type,severity,summary,metadata,created_at from ai_analysis.safety_events where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('ai_analysis.safety_events', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,title,last_message_at,archived,created_at,updated_at from buddy_service.buddy_conversations where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('buddy_service.buddy_conversations', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,message_id,user_id,rating,feedback,created_at from buddy_service.buddy_feedback where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('buddy_service.buddy_feedback', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,conversation_id,user_id,role,content,is_flagged,created_at from buddy_service.buddy_messages where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('buddy_service.buddy_messages', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,analysis_result_id,recommendation_selection_id,approved_context,expires_at,created_at from buddy_service.recommendation_handoffs where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('buddy_service.recommendation_handoffs', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,pattern,total_cycles,duration_seconds,completed_at from grounding_service.breathing_sessions where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('grounding_service.breathing_sessions', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,exercise_type,duration_seconds,completed,reflection,started_at,completed_at from grounding_service.grounding_sessions where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('grounding_service.grounding_sessions', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,insight_type,window_start,window_end,payload,created_at from insights_service.insight_snapshots where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('insights_service.insight_snapshots', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,mood_score,energy_score,note,recorded_at,created_at from insights_service.mood_entries where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('insights_service.mood_entries', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,responses,score,severity,assessment_ciphertext,completed_at from insights_service.phq8_assessments where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('insights_service.phq8_assessments', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,last_prompted_at from insights_service.support_prompt_state where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('insights_service.support_prompt_state', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,period_start,aggregate_version,emotion_payload,distress_payload,source_count,updated_at from insights_service.weekly_analysis_metrics where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('insights_service.weekly_analysis_metrics', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,journal_id,user_id,status,phq8_score,severity,urgent_language_detected,processing_time_ms,failure_code,started_at,completed_at,analyzed_at,created_at from journal_service.journal_analyses where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('journal_service.journal_analyses', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,emotions,tags,privacy_status,analysis_consent,updated_at from journal_service.journal_drafts where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('journal_service.journal_drafts', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,journal_id,user_id,storage_path,mime_type,uploaded,created_at from journal_service.journal_images where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('journal_service.journal_images', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,title,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,word_count,emotions,tags,privacy_status,analysis_consent,deleted_at,created_at,updated_at from journal_service.journals where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('journal_service.journals', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,notification_type,title,message,resource_type,resource_id,read_at,created_at from notification_service.notifications where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('notification_service.notifications', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,trusted_contact_id,safety_event_id,status,decision_code,created_at from notification_service.support_contact_requests where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('notification_service.support_contact_requests', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,request_status,requested_at,scheduled_for,completed_at,cancelled_at,created_at,updated_at from public.account_deletion_requests where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.account_deletion_requests', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,analysis_id,user_id,feedback_rating,corrected_score,comment_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,consent_for_model_improvement,created_at,updated_at from public.analysis_feedback where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.analysis_feedback', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,journal_id,job_id,status,progress,updated_at,facial_status from public.analysis_status_projection where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.analysis_status_projection', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,event_type,resource_type,resource_id,metadata,created_at from public.audit_events where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.audit_events', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,title_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,conversation_status,last_message_at,created_at,updated_at from public.buddy_conversations where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.buddy_conversations', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,conversation_id,user_id,model_version_id,message_role,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,input_token_count,output_token_count,processing_time_ms,urgent_language_detected,created_at from public.buddy_messages where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.buddy_messages', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,status,scheduled_for,created_at,cancelled_at from public.deletion_requests where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.deletion_requests', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,exercise_type,duration_seconds,pace,created_at from public.grounding_sessions where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.grounding_sessions', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,verification_status,is_minor,age_at_submission,details_ciphertext,details_iv,details_auth_tag,details_key_version,consent_version,privacy_notice_acknowledged_at,guardian_consent_acknowledged_at,submitted_at,reviewed_at,decision_reason_code,review_note_ciphertext,review_note_iv,review_note_auth_tag,review_note_key_version,approved_expires_at,created_at,updated_at from public.identity_verifications where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.identity_verifications', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,journal_id,user_id,model_version_id,phq8_score,severity,urgent_language_detected,processing_time_ms,status,failure_code,analyzed_at,created_at,window_count,input_token_count,output_token_count,prompt_version,aggregation_method,requested_at,started_at,completed_at,updated_at from public.journal_analyses where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.journal_analyses', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,emotions,tags,privacy_status,analysis_consent,created_at,updated_at from public.journal_drafts where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.journal_drafts', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,title,content,entry_date,analysis_status,created_at,updated_at,deleted_at,title_ciphertext,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,journal_status,word_count,language_code,emotions,tags,privacy_status,analysis_consent,archived_at from public.journals where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.journals', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,owner_id,title,content,created_at,text_emotion,face_emotion,risk_level,recommendation,top_emotions,raw from public.lab_entries where owner_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.lab_entries', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,mood_score,energy_score,note,recorded_at,created_at,anxiety_score,note_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version from public.mood_entries where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.mood_entries', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,email_enabled,push_enabled,journal_reminders_enabled,insight_notifications_enabled,created_at,updated_at,in_app_enabled,wellbeing_reminders_enabled,reminder_time,reminder_timezone from public.notification_preferences where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.notification_preferences', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,notification_type,title,message,read_at,created_at,resource_type,resource_id from public.notifications where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.notifications', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,facial_analysis_enabled,crisis_support_visible,lock_screen_private,created_at,updated_at from public.privacy_preferences where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.privacy_preferences', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,display_name,avatar_path,timezone,onboarding_completed,created_at,updated_at,theme_variant,theme_mode,goals,buddy_tone_preference from public.profiles where id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.profiles', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,journal_id,analysis_id,safety_level,detection_source,matched_rule_id,crisis_message_shown,support_resources_shown,trusted_contact_option_shown,acknowledged_at,created_at from public.safety_events where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.safety_events', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,contact_name,contact_email,contact_phone,relationship,verified,created_at,updated_at,is_primary,verified_at,permission_acknowledged_at,preferred_locale from public.trusted_contacts where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.trusted_contacts', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,consent_type,consent_version,accepted,accepted_at,revoked_at,created_at,source from public.user_consents where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.user_consents', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,camera_enabled,camera_interval_minutes,facial_analysis_consent,theme_variant,theme_mode,created_at,updated_at from public.user_preferences where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.user_preferences', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select owner_id,first_name,last_name,email,timezone,dark_mode from public.user_profiles where owner_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.user_profiles', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,verification_id,user_id,document_kind,storage_path,mime_type,size_bytes,uploaded_at,created_at,updated_at from public.verification_documents where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.verification_documents', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,request_status,requested_at,scheduled_for,cancelled_at,completed_at,created_at from user_service.account_deletion_requests where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.account_deletion_requests', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,event_type,resource_type,resource_id,metadata,created_at from user_service.audit_events where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.audit_events', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,email_enabled,push_enabled,in_app_enabled,journal_reminders_enabled,wellbeing_reminders_enabled,insight_notifications_enabled,reminder_time,reminder_timezone,created_at,updated_at from user_service.notification_preferences where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.notification_preferences', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,facial_analysis_enabled,crisis_support_visible,lock_screen_private,created_at,updated_at,journal_ai_analysis_enabled from user_service.privacy_preferences where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.privacy_preferences', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select user_id,display_name,timezone,avatar_path,theme_variant,theme_mode,onboarding_completed,created_at,updated_at,account_status,eligible_18_plus,eligibility_verified_at,eligibility_rule_version,eligibility_source,preferred_name,gender_identity,gender_self_description,pronouns,pronouns_self_description,onboarding_step,onboarding_completed_at from user_service.profiles where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.profiles', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,contact_name,contact_email,contact_phone,relationship,verified,is_primary,permission_acknowledged_at,created_at,updated_at from user_service.trusted_contacts where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.trusted_contacts', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,consent_type,consent_version,accepted,accepted_at,revoked_at,source,created_at from user_service.user_consents where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('user_service.user_consents', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,user_id,verification_status,is_minor,age_at_submission,submitted_at,reviewed_at,decision_reason_code,approved_expires_at,details_ciphertext,details_iv,details_auth_tag,details_key_version,review_note_ciphertext,review_note_iv,review_note_auth_tag,review_note_key_version,created_at,updated_at,consent_version,privacy_notice_acknowledged_at,guardian_consent_acknowledged_at from verification_service.identity_verifications where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('verification_service.identity_verifications', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
  (select id,verification_id,user_id,document_kind,mime_type,size_bytes,storage_path,uploaded_at,scan_status,scanned_at,scanner_version from verification_service.verification_documents where user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('verification_service.verification_documents', rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
 (select c.id,c.analysis_id,c.window_index,c.token_count,c.predicted_score,c.urgent_language_detected,c.processing_time_ms,c.created_at from public.analysis_windows c join public.journal_analyses p on p.id=c.analysis_id where p.user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.analysis_windows',rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
 (select c.safety_event_id,c.support_resource_id,c.clicked_at from public.safety_event_resources c join public.safety_events p on p.id=c.safety_event_id where p.user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.safety_event_resources',rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
 (select c.id,c.notification_id,c.channel,c.delivery_status,c.sent_at,c.created_at from notification_service.notification_logs c join notification_service.notifications p on p.id=c.notification_id where p.user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('notification_service.notification_logs',rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
 (select c.id,c.verification_id,c.decision,c.reason_code,c.note_ciphertext,c.note_iv,c.note_auth_tag,c.note_key_version,c.created_at from public.verification_reviews c join public.identity_verifications p on p.id=c.verification_id where p.user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('public.verification_reviews',rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into rows from
 (select c.id,c.verification_id,c.decision,c.reason_code,c.note_ciphertext,c.note_iv,c.note_auth_tag,c.note_key_version,c.created_at from verification_service.verification_reviews c join verification_service.identity_verifications p on p.id=c.verification_id where p.user_id=p_user_id limit 2501) r;
 if jsonb_array_length(rows)>2500 then raise exception 'EXPORT_TOO_LARGE'; end if;
 result := result || jsonb_build_object('verification_service.verification_reviews',rows);
 if octet_length(result::text)>24000000 then raise exception 'EXPORT_TOO_LARGE'; end if;
 return result;
end $function$;

alter table journal_service.journals drop column mood;
alter table journal_service.journal_drafts drop column mood;
commit;

