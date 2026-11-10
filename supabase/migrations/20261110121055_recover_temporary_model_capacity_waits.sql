begin;
alter table ai_analysis.analysis_requests add column capacity_wait_count integer not null default 0 check (capacity_wait_count>=0);
-- Capacity waits preserve current progress and do not consume failure attempts.
create or replace function ai_analysis.apply_worker_callback(p_job_id uuid,p_type text,p_key_hmac text,p_payload_hash text,
 p_worker_id text,p_lease_hash text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; r ai_analysis.callback_receipts%rowtype;
 next_status text; next_progress integer; stage integer; outcome jsonb; expiry timestamptz;
begin
 select * into a from ai_analysis.analysis_requests where id=p_job_id for update;
 if not found or a.deleted_at is not null then raise exception 'LEASE_REJECTED'; end if;
 select * into r from ai_analysis.callback_receipts where job_id=p_job_id and key_hmac=p_key_hmac and (expires_at is null or expires_at>now());
 if found then
   if r.payload_hash<>p_payload_hash or r.callback_type<>p_type then raise exception 'CALLBACK_IDEMPOTENCY_CONFLICT'; end if;
   if r.worker_id<>p_worker_id or r.lease_token_hash<>p_lease_hash then raise exception 'LEASE_REJECTED'; end if;
   if a.status in ('completed','failed') then return r.outcome_payload; end if;
 end if;
 if a.status in ('completed','failed') or a.processing_mode<>'local_worker' or a.lease_worker_id is distinct from p_worker_id
   or a.lease_token_hash is distinct from p_lease_hash or a.lease_expires_at is null or a.lease_expires_at<=now() then raise exception 'LEASE_REJECTED'; end if;
 if r.id is not null then return r.outcome_payload; end if;
 if not ai_analysis.job_gates_allow(p_job_id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 next_status := a.status; next_progress := a.progress;
 if p_type='heartbeat' then
   expiry:=now()+interval '60 seconds';
   update ai_analysis.analysis_requests set lease_expires_at=expiry where id=p_job_id;
   outcome:=jsonb_build_object('jobId',p_job_id,'leaseExpiresAt',expiry);
 elsif p_type='safety_result' then
   if a.status<>'safety_checking' or jsonb_typeof(p_payload->'actionRequired')<>'boolean' then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
   next_status:=case when (p_payload->>'actionRequired')::boolean then 'safety_action_required' else 'analyzing_emotions' end;
   if next_status='safety_action_required' then
     insert into ai_analysis.safety_events(user_id,analysis_request_id,event_type,severity,summary,metadata)
       values(a.user_id,a.id,'self_harm_support','high','Worker requested restricted safety review.','{}');
   end if;
 elsif p_type='progress' then
   next_status:=p_payload->>'status';
   -- A worker cannot bypass the safety-result callback or enter a backend-owned state.
   if not ((a.status='queued' and next_status='safety_checking')
     or (a.status='analyzing_emotions' and next_status='classifying_distress')
     or (a.status='classifying_distress' and next_status='estimating_screening')
     or (a.status='estimating_screening' and next_status='generating_recommendation')) then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
 elsif p_type='failure' then
   if a.status='safety_action_required' then raise exception 'SAFETY_REVIEW_REQUIRED'; end if;
   if p_payload->>'code'='CAPACITY_WAIT' then
     next_status:='retrying'; next_progress:=a.progress;
   else
     next_status:=case when a.attempt_count<3 then 'retrying' else 'failed' end;
     next_progress:=case when next_status='failed' then a.progress else greatest(a.progress,case when a.attempt_count<=1 then 70 else 92 end) end;
   end if;
 else raise exception 'INVALID_CALLBACK_TYPE';
 end if;
 if p_type<>'heartbeat' then
   stage:=array_position(array['safety_checking','analyzing_emotions','classifying_distress','estimating_screening','generating_recommendation'],next_status);
   if stage is not null then next_progress:=greatest(next_progress,case when a.attempt_count<=1 then (array[10,25,35,45,55])[stage]
     when a.attempt_count=2 then (array[72,76,80,84,87])[stage] else (array[93,94,95,96,97])[stage] end); end if;
   update ai_analysis.analysis_requests set status=next_status,progress=next_progress,
     completed_at=case when next_status='failed' then now() else completed_at end,
     failure_code=case when p_type='failure' and p_payload->>'code'='CAPACITY_WAIT' then 'CAPACITY_WAIT' when p_type='failure' then 'WORKER_FAILURE' else failure_code end,
     capacity_wait_count=case when p_type='failure' and p_payload->>'code'='CAPACITY_WAIT' then capacity_wait_count+1 else capacity_wait_count end,
     attempt_count=case when p_type='failure' and p_payload->>'code'='CAPACITY_WAIT' then greatest(attempt_count-1,0) else attempt_count end,
     lease_token_hash=case when p_type='failure' then null else lease_token_hash end,
     lease_worker_id=case when p_type='failure' then null else lease_worker_id end,
     lease_expires_at=case when p_type='failure' then null else lease_expires_at end where id=p_job_id;
   outcome:=jsonb_build_object('status',next_status,'progress',next_progress);
 end if;
 insert into ai_analysis.callback_receipts(job_id,callback_type,key_hmac,payload_hash,worker_id,lease_token_hash,outcome_status,outcome_payload,expires_at)
 values(a.id,p_type,p_key_hmac,p_payload_hash,p_worker_id,p_lease_hash,200,outcome,
   case when next_status='failed' then now()+interval '30 days' else null end);
 return outcome;
end $$;
revoke all on function ai_analysis.apply_worker_callback(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function ai_analysis.apply_worker_callback(uuid,text,text,text,text,text,jsonb) to service_role;

create or replace function ai_analysis.recover_native_jobs(p_worker_id text,p_user_ids uuid[],p_started_after timestamptz) returns integer
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; recovered integer:=0;
begin
 if cardinality(p_user_ids) is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>20
    or p_started_after is null or p_worker_id is distinct from 'echo-native-development-v1' then raise exception 'NATIVE_SCOPE_REQUIRED'; end if;
 for a in select * from ai_analysis.analysis_requests where user_id=any(p_user_ids) and created_at>=p_started_after
   and processing_mode='local_worker' and deleted_at is null and (
     (lease_worker_id=p_worker_id and lease_expires_at<=now() and status not in ('completed','failed','safety_action_required'))
     or (lease_token_hash is null and status in ('waiting_for_provider','retrying')
       and coalesce((select s.updated_at from public.analysis_status_projection s where s.job_id=analysis_requests.id),created_at)<now()-interval '5 seconds'))
   order by created_at for update skip locked limit 20 loop
   if a.lease_token_hash is not null then
     update ai_analysis.analysis_requests set lease_worker_id=null,lease_token_hash=null,lease_expires_at=null,
       status=case when attempt_count>=3 then 'failed' else 'retrying' end,
       failure_code='LEASE_EXPIRED',completed_at=case when attempt_count>=3 then now() else null end
       where id=a.id;
     insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
       values(a.user_id,'analysis.lease_expired','analysis_job',a.id,'{"native_development_scope":true}');
   elsif a.attempt_count<3 then
     perform ai_analysis.requeue_job(a.id,'local_worker',
       a.status||':'||a.attempt_count::text||':'||a.capacity_wait_count::text||':native-development-v1');
     recovered:=recovered+1;
   end if;
 end loop;
 return recovered;
end $$;
revoke all on function ai_analysis.recover_native_jobs(text,uuid[],timestamptz) from public,anon,authenticated;
grant execute on function ai_analysis.recover_native_jobs(text,uuid[],timestamptz) to service_role;

commit;
