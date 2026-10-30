-- Optional local engineering HTTP bridge. Existing worker/auth contracts are unchanged.
-- Never apply automatically; local test launcher verifies the named-pipe Echo stack.
begin;
create function ai_analysis.claim_engineering_job(p_worker_id text,p_lease_hash text,p_user_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; expiry timestamptz:=now()+interval '60 seconds';
begin
 if cardinality(p_user_ids) is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>20
    or p_worker_id<>'echo-http-engineering-v1' or length(p_lease_hash)<>64 then
   raise exception 'ENGINEERING_SCOPE_REQUIRED';
 end if;
 if not exists(select 1 from ai_analysis.worker_health where worker_id=p_worker_id and accepting_jobs
    and last_heartbeat_at>now()-interval '60 seconds') then return null; end if;
 for a in select * from ai_analysis.analysis_requests where processing_mode='local_worker' and deleted_at is null
   and user_id=any(p_user_ids) and lease_token_hash is null and (status='queued' or (status='analyzing_emotions' and exists(
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
revoke all on function ai_analysis.claim_engineering_job(text,text,uuid[]) from public,anon,authenticated;
grant execute on function ai_analysis.claim_engineering_job(text,text,uuid[]) to service_role;
commit;
