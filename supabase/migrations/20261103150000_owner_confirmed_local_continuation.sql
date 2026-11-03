-- Owner confirmation is a local handoff, never a safety-review decision.
begin;
create table ai_analysis.owner_continuations (
 job_id uuid primary key references ai_analysis.analysis_requests(id),
 user_id uuid not null, local_job_id uuid not null, decision_key uuid not null,
 confirmed_at timestamptz not null default now()
);
alter table ai_analysis.owner_continuations enable row level security;
revoke all on ai_analysis.owner_continuations from public,anon,authenticated;
grant select,insert on ai_analysis.owner_continuations to service_role;
create or replace function ai_analysis.guard_job_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('completed','failed') and (new.status<>old.status or new.progress<>old.progress
   or new.lease_token_hash is not null or new.lease_expires_at is not null) then raise exception 'ANALYSIS_JOB_TERMINAL'; end if;
 if new.progress<old.progress then raise exception 'PROGRESS_CANNOT_DECREASE'; end if;
 if old.status<>new.status and new.deleted_at is null then
   if not (case old.status
     when 'queued' then new.status in ('safety_checking','retrying','failed','waiting_for_provider')
     when 'waiting_for_provider' then new.status in ('queued','failed')
     when 'safety_checking' then new.status in ('safety_action_required','analyzing_emotions','retrying','failed')
     when 'safety_action_required' then (new.status in ('analyzing_emotions','failed') and exists(select 1 from ai_analysis.safety_reviews where job_id=old.id)) or (new.status='failed' and new.failure_code='CONTINUED_LOCALLY' and exists(select 1 from ai_analysis.owner_continuations c where c.job_id=old.id and c.user_id=old.user_id))
     when 'analyzing_emotions' then new.status in ('classifying_distress','retrying','failed')
     when 'classifying_distress' then new.status in ('estimating_screening','retrying','failed')
     when 'estimating_screening' then new.status in ('generating_recommendation','retrying','failed')
     when 'generating_recommendation' then new.status in ('aggregating_week','retrying','failed')
     when 'aggregating_week' then new.status in ('completed','retrying','failed')
     when 'retrying' then new.status in ('queued','failed') else false end) then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
   if new.status not in ('failed','retrying','safety_action_required','waiting_for_provider') and not ai_analysis.job_gates_allow(old.id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 end if;
 return new;
end $$;

create function ai_analysis.confirm_owner_local_continuation(p_user_id uuid,p_job_id uuid,p_local_job_id uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; c ai_analysis.owner_continuations%rowtype;
begin
 select * into a from ai_analysis.analysis_requests where id=p_job_id and user_id=p_user_id and deleted_at is null for update;
 if not found then raise exception 'OWNED_PAUSE_NOT_FOUND'; end if;
 select * into c from ai_analysis.owner_continuations where job_id=a.id;
 if found then
  if c.user_id<>p_user_id or c.local_job_id<>p_local_job_id or c.decision_key<>p_key then raise exception 'CONFIRMATION_CONFLICT'; end if;
  return jsonb_build_object('status',a.status,'replayed',true);
 end if;
 if a.status<>'safety_action_required' then raise exception 'PAUSE_CHANGED'; end if;
 if not ai_analysis.job_gates_allow(a.id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 insert into ai_analysis.owner_continuations(job_id,user_id,local_job_id,decision_key) values(a.id,p_user_id,p_local_job_id,p_key);
 update ai_analysis.analysis_requests set status='failed',failure_code='CONTINUED_LOCALLY',completed_at=now(),lease_worker_id=null,lease_token_hash=null,lease_expires_at=null where id=a.id and user_id=p_user_id;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,metadata)
 values(p_user_id,p_user_id,'analysis.owner_confirmed_local_continuation','analysis_job',a.id,jsonb_build_object('local_job_id',p_local_job_id,'decision_key',p_key,'original_status','safety_action_required'));
 return jsonb_build_object('status','failed','reason','CONTINUED_LOCALLY','replayed',false);
end $$;
revoke all on function ai_analysis.confirm_owner_local_continuation(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function ai_analysis.confirm_owner_local_continuation(uuid,uuid,uuid,uuid) to service_role;
commit;
