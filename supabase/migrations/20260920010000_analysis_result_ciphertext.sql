begin;
create or replace function ai_analysis.complete_journal_analysis(p_job_id uuid, p_result jsonb)
returns uuid language plpgsql security definer set search_path=public,ai_analysis,user_service as $$
declare
  v_job ai_analysis.analysis_requests%rowtype;
  v_result_id uuid := gen_random_uuid();
  v_rule_id uuid;
  v_feature text := p_result->'recommendationFeatures'->>0;
  v_period date := date_trunc('week', now())::date;
begin
  if coalesce(p_result->>'encryptedPayload','') not like 'echo:encrypted:v1:%' then raise exception 'ANALYSIS_CIPHERTEXT_REQUIRED'; end if;
  select * into v_job from ai_analysis.analysis_requests where id=p_job_id for update;
  if not found then raise exception 'ANALYSIS_JOB_NOT_FOUND'; end if;
  if v_job.status not in ('generating_recommendation','aggregating_week') then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
  if not ai_analysis.job_gates_allow(p_job_id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
  if v_job.status='generating_recommendation' then
    update ai_analysis.analysis_requests set status='aggregating_week',progress=greatest(progress,
      case when attempt_count<=1 then 65 when attempt_count=2 then 90 else 98 end) where id=p_job_id;
  end if;
  select id into v_rule_id from ai_analysis.recommendation_rules
    where feature=v_feature and active=true order by reviewed_at desc limit 1;
  if v_rule_id is null then raise exception 'REVIEWED_RECOMMENDATION_NOT_FOUND'; end if;
  insert into ai_analysis.analysis_results(id,analysis_request_id,user_id,phq8_score,severity,urgent_language_detected,
    summary,confidence,is_demo_data,result_payload,schema_version,threshold_version,provider_name,model_version,is_simulated)
  values(v_result_id,p_job_id,v_job.user_id,
    null, p_result->>'supportSeverity',
    false,'[encrypted]',null,
    (p_result->>'isSimulated')::boolean,jsonb_build_object('ciphertext',p_result->>'encryptedPayload'),p_result->>'schemaVersion',p_result->>'thresholdVersion',
    p_result->>'providerName',p_result->>'modelVersion',(p_result->>'isSimulated')::boolean);
  insert into ai_analysis.recommendation_selections(analysis_result_id,user_id,rule_id)
    values(v_result_id,v_job.user_id,v_rule_id);
  update ai_analysis.analysis_requests set status='completed',progress=100,completed_at=now(),
    lease_token_hash=null,lease_worker_id=null,lease_expires_at=null where id=p_job_id;
  update public.analysis_status_projection set status='completed',progress=100,updated_at=now() where job_id=p_job_id;
  insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
    values(v_job.user_id,'analysis.completed','analysis_job',p_job_id,jsonb_build_object('is_simulated',(p_result->>'isSimulated')::boolean));
  insert into ai_analysis.aggregation_tasks(analysis_result_id,user_id,period_start,aggregate_version)
    values(v_result_id,v_job.user_id,v_period,'weekly-analysis-v1') on conflict do nothing;
  return v_result_id;
end $$;
revoke all on function ai_analysis.complete_journal_analysis(uuid,jsonb) from public,anon,authenticated;
grant execute on function ai_analysis.complete_journal_analysis(uuid,jsonb) to service_role;


-- Avoid a second plaintext content store. Authorized dashboard trends are
-- computed in JournalService from decrypted results within the request.
create or replace function insights_service.recompute_analysis_week(p_user uuid,p_period date) returns void
language plpgsql security definer set search_path='' as $$
declare sources integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_period::text||':weekly-analysis-v1',0));
 select count(*) into sources from ai_analysis.analysis_results r
 join ai_analysis.analysis_requests a on a.id=r.analysis_request_id
 join journal_service.journals j on j.id=a.journal_id
 where r.user_id=p_user and not r.is_simulated and r.result_payload is not null
 and j.deleted_at is null and a.deleted_at is null and a.status='completed'
 and r.created_at>=p_period::timestamptz and r.created_at<(p_period+7)::timestamptz;
 insert into insights_service.weekly_analysis_metrics(user_id,period_start,aggregate_version,emotion_payload,distress_payload,source_count)
 values(p_user,p_period,'weekly-analysis-v1','{}','{}',sources)
 on conflict(user_id,period_start,aggregate_version) do update set emotion_payload='{}',distress_payload='{}',source_count=excluded.source_count,updated_at=now();
end $$;
alter table ai_analysis.analysis_results add constraint analysis_result_ciphertext_required check
 (coalesce(result_payload is not null and result_payload ? 'ciphertext' and (result_payload->>'ciphertext') like 'echo:encrypted:v1:%'
 and phq8_score is null and confidence is null and summary='[encrypted]' and perspective is null and mood_insight is null and risk_indication is null and (result_payload - 'ciphertext')='{}',false)) not valid;

commit;
