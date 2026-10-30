begin;
-- Scope recovery as strictly as claiming. Never scan/requeue shared disabled jobs.
create function ai_analysis.recover_engineering_jobs(p_worker_id text,p_user_ids uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; recovered integer:=0;
begin
 if cardinality(p_user_ids) is null or cardinality(p_user_ids)<1 or cardinality(p_user_ids)>20
    or p_worker_id<>'echo-http-engineering-v1' then raise exception 'ENGINEERING_SCOPE_REQUIRED'; end if;
 for a in select * from ai_analysis.analysis_requests where user_id=any(p_user_ids)
   and processing_mode='local_worker' and deleted_at is null and (
     (lease_worker_id=p_worker_id and lease_expires_at<=now() and status not in ('completed','failed','safety_action_required'))
     or (lease_token_hash is null and status in ('waiting_for_provider','retrying')
       and updated_at<now()-interval '5 seconds'))
   order by created_at for update skip locked limit 20 loop
   if a.lease_token_hash is not null then
     update ai_analysis.analysis_requests set lease_worker_id=null,lease_token_hash=null,lease_expires_at=null,
       status=case when attempt_count>=3 then 'failed' else 'retrying' end,
       failure_code='LEASE_EXPIRED',completed_at=case when attempt_count>=3 then now() else null end
       where id=a.id;
     insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
       values(a.user_id,'analysis.lease_expired','analysis_job',a.id,'{"engineering_scope":true}');
   elsif a.attempt_count<3 then
     perform ai_analysis.requeue_job(a.id,'local_worker',
       a.status||':'||a.attempt_count::text||':engineering-http-v1');
     recovered:=recovered+1;
   end if;
 end loop;
 return recovered;
end $$;
revoke all on function ai_analysis.recover_engineering_jobs(text,uuid[]) from public,anon,authenticated;
grant execute on function ai_analysis.recover_engineering_jobs(text,uuid[]) to service_role;
commit;
