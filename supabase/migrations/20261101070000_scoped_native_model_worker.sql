-- Scoped encrypted native development worker; no existing jobs or records are changed.
begin;
-- Account and activation scopes isolate newly submitted native development work.
-- Existing worker/auth contracts and ordinary account access gates are preserved.

create function ai_analysis.claim_native_job(p_worker_id text,p_lease_hash text,p_user_ids uuid[],p_started_after timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; expiry timestamptz:=now()+interval '60 seconds';
begin
 if cardinality(p_user_ids) is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>20
    or p_started_after is null or p_worker_id is distinct from 'echo-native-development-v1' or p_lease_hash is null or p_lease_hash !~ '^[a-f0-9]{64}$' then
   raise exception 'NATIVE_SCOPE_REQUIRED';
 end if;
 if not exists(select 1 from ai_analysis.worker_health where worker_id=p_worker_id and accepting_jobs
    and last_heartbeat_at>now()-interval '60 seconds') then return null; end if;
 for a in select * from ai_analysis.analysis_requests where processing_mode='local_worker' and deleted_at is null
   and user_id=any(p_user_ids) and created_at>=p_started_after and lease_token_hash is null and (status='queued' or (status='analyzing_emotions' and exists(
     select 1 from ai_analysis.safety_reviews s where s.job_id=analysis_requests.id and s.decision='approved_continue')))
   order by created_at for update skip locked limit 20 loop
   if not ai_analysis.job_gates_allow(a.id) or (a.status='queued' and a.attempt_count>=3) then
     update ai_analysis.analysis_requests set status='failed',failure_code='CURRENT_GATES_FAILED',completed_at=now() where id=a.id;
     insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
       values(a.user_id,'analysis.claim_denied','analysis_job',a.id,'{}');
     continue;
   end if;
   update ai_analysis.analysis_requests set lease_worker_id=p_worker_id,lease_token_hash=p_lease_hash,lease_expires_at=expiry,
     attempt_count=attempt_count+case when status='queued' then 1 else 0 end where id=a.id;
   return jsonb_build_object('jobId',a.id,'journalId',a.journal_id,'userId',a.user_id,'status',a.status,'leaseExpiresAt',expiry);
 end loop;
 return null;
end $$;
revoke all on function ai_analysis.claim_native_job(text,text,uuid[],timestamptz) from public,anon,authenticated;
grant execute on function ai_analysis.claim_native_job(text,text,uuid[],timestamptz) to service_role;


-- Scope recovery as strictly as claiming. Never scan/requeue shared disabled jobs.
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
       a.status||':'||a.attempt_count::text||':native-development-v1');
     recovered:=recovered+1;
   end if;
 end loop;
 return recovered;
end $$;
revoke all on function ai_analysis.recover_native_jobs(text,uuid[],timestamptz) from public,anon,authenticated;
grant execute on function ai_analysis.recover_native_jobs(text,uuid[],timestamptz) to service_role;

commit;
