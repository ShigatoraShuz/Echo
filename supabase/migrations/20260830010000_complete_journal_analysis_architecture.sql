-- Complete ECHO journal-analysis persistence boundary.
-- Forward-only: private service tables remain service-role-only; the browser
-- receives only the RLS-protected public status projection.

create extension if not exists pgcrypto;

alter table ai_analysis.analysis_requests
  add column if not exists journal_id uuid,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists progress integer not null default 0,
  add column if not exists fixture text,
  add column if not exists processing_mode text not null default 'disabled' check (processing_mode in ('disabled','development_stub','local_worker')),
  add column if not exists lease_token_hash text,
  add column if not exists lease_worker_id text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists retention_expires_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table ai_analysis.analysis_requests drop constraint if exists analysis_requests_status_check;
update ai_analysis.analysis_requests set status=case status when 'pending' then 'queued' when 'processing' then 'retrying' else status end
  where status in ('pending','processing');
alter table ai_analysis.analysis_requests add constraint analysis_requests_status_check check (status in (
  'queued','waiting_for_provider','safety_checking','safety_action_required',
  'analyzing_emotions','classifying_distress','estimating_screening',
  'generating_recommendation','aggregating_week','completed','retrying','failed'
));
alter table ai_analysis.analysis_requests add constraint analysis_requests_progress_check check (progress between 0 and 100);
alter table ai_analysis.analysis_requests add constraint analysis_requests_attempt_check check (attempt_count between 0 and 3);
alter table ai_analysis.analysis_requests alter column status set default 'queued';
create unique index if not exists analysis_requests_one_journal_idx
  on ai_analysis.analysis_requests (journal_id) where journal_id is not null and deleted_at is null;
create index if not exists analysis_requests_claim_idx
  on ai_analysis.analysis_requests (status, created_at) where deleted_at is null;
create index if not exists analysis_requests_lease_idx
  on ai_analysis.analysis_requests (lease_expires_at) where lease_expires_at is not null;

alter table ai_analysis.analysis_results
  add column if not exists result_payload jsonb,
  add column if not exists schema_version text,
  add column if not exists threshold_version text,
  add column if not exists provider_name text,
  add column if not exists model_version text,
  add column if not exists is_simulated boolean not null default true;
create unique index if not exists analysis_results_one_per_request_idx
  on ai_analysis.analysis_results (analysis_request_id) where result_payload is not null;

alter table ai_analysis.analysis_requests add constraint analysis_requests_journal_fkey
  foreign key (journal_id) references journal_service.journals(id) on delete cascade;

create or replace function ai_analysis.enforce_result_immutability()
returns trigger language plpgsql as $$
begin
  if old.result_payload is not null and new is distinct from old then raise exception 'ANALYSIS_RESULTS_ARE_IMMUTABLE'; end if;
  return new;
end $$;
create trigger analysis_results_immutable before update on ai_analysis.analysis_results
  for each row execute function ai_analysis.enforce_result_immutability();

alter table grounding_service.support_resources
  add column if not exists call_uri text,
  add column if not exists text_uri text,
  add column if not exists source_url text;
update grounding_service.support_resources set call_uri=case when phone_number is not null then 'tel:'||phone_number end,
  text_uri=case when sms_number is not null then 'sms:'||sms_number end,
  source_url=case when verification_source ~ '^https://' then verification_source else website_url end;

create table if not exists ai_analysis.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  key_version text not null,
  key_hmac text not null,
  request_hash text not null,
  state text not null check (state in ('processing','rejected','succeeded')),
  response_status integer,
  response_payload jsonb,
  rejection_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, operation, key_version, key_hmac)
);

create table if not exists ai_analysis.callback_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ai_analysis.analysis_requests(id) on delete cascade,
  callback_type text not null,
  key_hmac text not null,
  payload_hash text not null,
  worker_id text not null,
  lease_token_hash text not null,
  outcome_status integer not null,
  outcome_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, key_hmac)
);

create table if not exists ai_analysis.transition_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ai_analysis.analysis_requests(id) on delete cascade,
  transition_key text not null,
  from_status text not null,
  to_status text not null,
  decision text not null,
  created_at timestamptz not null default now(),
  unique (job_id, transition_key)
);

create table if not exists ai_analysis.recommendation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_version text not null,
  feature text not null,
  title text not null,
  description text not null,
  activity text not null,
  reviewed_at timestamptz not null,
  active boolean not null default true,
  unique (rule_version, feature)
);

create table if not exists ai_analysis.recommendation_selections (
  id uuid primary key default gen_random_uuid(),
  analysis_result_id uuid not null references ai_analysis.analysis_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references ai_analysis.recommendation_rules(id),
  created_at timestamptz not null default now(),
  unique (analysis_result_id)
);

create table if not exists ai_analysis.aggregation_tasks (
  id uuid primary key default gen_random_uuid(),
  analysis_result_id uuid not null references ai_analysis.analysis_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  aggregate_version text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','retrying','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (analysis_result_id, aggregate_version)
);

create table if not exists insights_service.weekly_analysis_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  aggregate_version text not null,
  emotion_payload jsonb not null default '{}'::jsonb,
  distress_payload jsonb not null default '{}'::jsonb,
  source_count integer not null default 0 check (source_count >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, aggregate_version)
);

create table if not exists ai_analysis.worker_health (
  worker_id text primary key,
  accepting_jobs boolean not null default false,
  model_status text,
  model_version text,
  last_heartbeat_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists ai_analysis.safety_reviews (
  id uuid primary key default gen_random_uuid(),
  safety_event_id uuid not null references ai_analysis.safety_events(id) on delete cascade,
  job_id uuid not null references ai_analysis.analysis_requests(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved_continue','end_analysis')),
  decision_key text not null,
  created_at timestamptz not null default now(),
  unique (job_id, decision_key)
);

create table if not exists buddy_service.recommendation_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_result_id uuid not null references ai_analysis.analysis_results(id) on delete cascade,
  recommendation_selection_id uuid not null references ai_analysis.recommendation_selections(id) on delete cascade,
  approved_context jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists notification_service.support_contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trusted_contact_id uuid not null references user_service.trusted_contacts(id) on delete cascade,
  safety_event_id uuid references ai_analysis.safety_events(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','review_required','denied','approved')),
  decision_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_status_projection (
  user_id uuid not null references auth.users(id) on delete cascade,
  journal_id uuid not null,
  job_id uuid primary key references ai_analysis.analysis_requests(id) on delete cascade,
  status text not null check (status in (
    'queued','waiting_for_provider','safety_checking','safety_action_required',
    'analyzing_emotions','classifying_distress','estimating_screening',
    'generating_recommendation','aggregating_week','completed','retrying','failed'
  )),
  progress integer not null check (progress between 0 and 100),
  updated_at timestamptz not null default now()
);
alter table public.analysis_status_projection add constraint analysis_status_journal_fkey
  foreign key (journal_id) references journal_service.journals(id) on delete cascade;

alter table public.analysis_status_projection enable row level security;
drop policy if exists analysis_status_select_own on public.analysis_status_projection;
create policy analysis_status_select_own on public.analysis_status_projection for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.analysis_status_projection from anon, authenticated;
grant select on public.analysis_status_projection to authenticated;
grant select,insert,update,delete on public.analysis_status_projection to service_role;

do $$ begin
  alter publication supabase_realtime add table public.analysis_status_projection;
exception when duplicate_object then null;
end $$;

-- Existing plaintext columns remain for compatibility. New or changed titles
-- must be the non-sensitive sentinel; untouched legacy rows remain backfillable.
create or replace function journal_service.enforce_encrypted_title_sentinel()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.title <> '[encrypted]' then
    raise exception 'new journal titles must use the encrypted compatibility sentinel';
  end if;
  if tg_op = 'UPDATE' and new.title is distinct from old.title and new.title <> '[encrypted]' then
    raise exception 'updated journal titles must use the encrypted compatibility sentinel';
  end if;
  return new;
end $$;

drop trigger if exists journals_encrypted_title_sentinel on journal_service.journals;
create trigger journals_encrypted_title_sentinel before insert or update on journal_service.journals
  for each row execute function journal_service.enforce_encrypted_title_sentinel();
drop trigger if exists journal_drafts_encrypted_title_sentinel on journal_service.journal_drafts;
create trigger journal_drafts_encrypted_title_sentinel before insert or update on journal_service.journal_drafts
  for each row execute function journal_service.enforce_encrypted_title_sentinel();

-- The historical public copies also survive the service-schema cutover.
-- They are not an alternate browser API or a loophole for plaintext writes.
revoke all on public.journals,public.journal_drafts,public.journal_analyses,
 public.analysis_windows,public.analysis_feedback,public.safety_events,public.safety_event_resources from anon,authenticated;
grant select,insert,update,delete on public.journals,public.journal_drafts to service_role;
create function journal_service.guard_legacy_plaintext() returns trigger language plpgsql as $$
begin
 if (tg_op='INSERT' and (new.title is distinct from '[encrypted]' or new.content is distinct from '[encrypted]'))
 or (tg_op='UPDATE' and ((new.title is distinct from old.title and new.title is distinct from '[encrypted]')
   or (new.content is distinct from old.content and new.content is distinct from '[encrypted]'))) then raise exception 'LEGACY_PLAINTEXT_WRITE_FORBIDDEN'; end if;
 return new;
end $$;
create trigger guard_legacy_plaintext before insert or update on public.journals for each row execute function journal_service.guard_legacy_plaintext();
do $$ declare item record; begin
 for item in select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime'
 and (schemaname in ('ai_analysis','journal_service','insights_service','buddy_service','verification_service','user_service','notification_service')
 or (schemaname='public' and tablename in ('journals','journal_drafts','journal_analyses','safety_events','analysis_windows','analysis_feedback','safety_event_resources'))) loop
   execute format('alter publication supabase_realtime drop table %I.%I',item.schemaname,item.tablename);
 end loop;
end $$;

-- A single fail-closed gate predicate is reused inside every processing transaction.
create function ai_analysis.current_gates_allow(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from user_service.profiles p join user_service.privacy_preferences pp using(user_id)
   where p.user_id=p_user_id and p.account_status='active' and p.onboarding_completed and p.eligible_18_plus
     and pp.journal_ai_analysis_enabled)
 and exists(select 1 from verification_service.identity_verifications v where v.id=(
   select id from verification_service.identity_verifications where user_id=p_user_id order by created_at desc limit 1)
   and v.verification_status='approved' and (v.approved_expires_at is null or v.approved_expires_at>now()))
 and (select count(*)=3 from auth_provisioning.policy_documents where is_active)
 and not exists(select 1 from auth_provisioning.policy_documents d where d.is_active and not exists(
   select 1 from user_service.user_consents c where c.user_id=p_user_id and c.consent_type=d.document_type
   and c.consent_version=d.version and c.accepted and c.revoked_at is null));
$$;
revoke all on function ai_analysis.current_gates_allow(uuid) from public,anon,authenticated;
grant execute on function ai_analysis.current_gates_allow(uuid) to service_role;

create function ai_analysis.job_gates_allow(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from ai_analysis.analysis_requests a join journal_service.journals j on j.id=a.journal_id
   where a.id=p_job_id and a.deleted_at is null and j.deleted_at is null and j.user_id=a.user_id and j.analysis_consent
   and (a.retention_expires_at is null or a.retention_expires_at>now()) and ai_analysis.current_gates_allow(a.user_id));
$$;
revoke all on function ai_analysis.job_gates_allow(uuid) from public,anon,authenticated;
grant execute on function ai_analysis.job_gates_allow(uuid) to service_role;

-- Projection, terminal receipt expiry, and deletion are coupled to the job write.
create function ai_analysis.project_job_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null then delete from public.analysis_status_projection where job_id=new.id;
 elsif new.journal_id is not null then
   insert into public.analysis_status_projection(user_id,journal_id,job_id,status,progress,updated_at)
   values(new.user_id,new.journal_id,new.id,new.status,new.progress,now())
   on conflict(job_id) do update set status=excluded.status,progress=excluded.progress,updated_at=excluded.updated_at;
 end if;
 if new.status in ('completed','failed') and old.status not in ('completed','failed') then
   update ai_analysis.callback_receipts set expires_at=coalesce(new.completed_at,now())+interval '30 days' where job_id=new.id;
 end if;
 return new;
end $$;
create trigger project_job_status after update on ai_analysis.analysis_requests
 for each row execute function ai_analysis.project_job_status();

create function journal_service.cancel_deleted_journal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null and old.deleted_at is null then
   update ai_analysis.analysis_requests set deleted_at=new.deleted_at,lease_token_hash=null,lease_worker_id=null,lease_expires_at=null,
     status=case when status in ('completed','failed') then status else 'failed' end,
     failure_code=case when status in ('completed','failed') then failure_code else 'JOURNAL_DELETED' end,
     completed_at=coalesce(completed_at,now()) where journal_id=new.id;
   delete from public.analysis_status_projection where journal_id=new.id;
   insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
     values(new.user_id,'journal.soft_deleted','journal',new.id,'{}');
 end if;
 return new;
end $$;
create trigger cancel_deleted_journal after update of deleted_at on journal_service.journals
 for each row execute function journal_service.cancel_deleted_journal();

create function ai_analysis.requeue_job(p_job_id uuid,p_mode text,p_transition_key text) returns text
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; prior ai_analysis.transition_receipts%rowtype; approved boolean;
begin
 select * into a from ai_analysis.analysis_requests where id=p_job_id for update;
 if not found then raise exception 'ANALYSIS_JOB_NOT_FOUND'; end if;
 select * into prior from ai_analysis.transition_receipts where job_id=p_job_id and transition_key=p_transition_key;
 if found then return prior.to_status; end if;
 if a.status not in ('waiting_for_provider','retrying') or a.deleted_at is not null then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
 if p_mode not in ('development_stub','local_worker') then return a.status; end if;
 if p_mode='local_worker' and not exists(select 1 from ai_analysis.worker_health where accepting_jobs and last_heartbeat_at>now()-interval '60 seconds') then return a.status; end if;
 -- Never route a real worker job through the development runner (or a fixture to a worker).
 if a.processing_mode not in ('disabled',p_mode) then return a.status; end if;
 approved := ai_analysis.job_gates_allow(a.id) and a.attempt_count<3;
 insert into ai_analysis.transition_receipts(job_id,transition_key,from_status,to_status,decision)
   values(a.id,p_transition_key,a.status,case when approved then 'queued' else 'failed' end,case when approved then 'approved' else 'current_gate_or_attempt_denied' end);
 update ai_analysis.analysis_requests set status=case when approved then 'queued' else 'failed' end,
   processing_mode=p_mode,lease_token_hash=null,lease_worker_id=null,lease_expires_at=null,
   failure_code=case when approved then null else 'REQUEUE_GATE_FAILED' end,
   completed_at=case when approved then null else now() end where id=a.id;
 insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
   values(a.user_id,case when approved then 'analysis.requeued' else 'analysis.requeue_denied' end,'analysis_job',a.id,
   jsonb_build_object('reason',case when approved then 'provider_available' else 'current_gate_or_attempt_denied' end));
 return case when approved then 'queued' else 'failed' end;
end $$;
revoke all on function ai_analysis.requeue_job(uuid,text,text) from public,anon,authenticated;
grant execute on function ai_analysis.requeue_job(uuid,text,text) to service_role;

create function ai_analysis.claim_worker_job(p_worker_id text,p_lease_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; expiry timestamptz:=now()+interval '60 seconds';
begin
 if not exists(select 1 from ai_analysis.worker_health where worker_id=p_worker_id and accepting_jobs and last_heartbeat_at>now()-interval '60 seconds') then return null; end if;
 for a in select * from ai_analysis.analysis_requests where processing_mode='local_worker' and deleted_at is null
   and lease_token_hash is null and (status='queued' or (status='analyzing_emotions' and exists(
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
revoke all on function ai_analysis.claim_worker_job(text,text) from public,anon,authenticated;
grant execute on function ai_analysis.claim_worker_job(text,text) to service_role;

create function ai_analysis.release_expired_worker_leases() returns integer
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; released integer:=0;
begin
 for a in select * from ai_analysis.analysis_requests where processing_mode='local_worker'
   and lease_expires_at<=now() and status not in ('completed','failed') for update skip locked loop
   update ai_analysis.analysis_requests set lease_worker_id=null,lease_token_hash=null,lease_expires_at=null,
     status=case when a.status='safety_action_required' then a.status when a.attempt_count>=3 then 'failed' else 'retrying' end,
     progress=case when a.status='safety_action_required' or a.attempt_count>=3 then a.progress else greatest(a.progress,case when a.attempt_count<=1 then 70 else 92 end) end,
     completed_at=case when a.attempt_count>=3 and a.status<>'safety_action_required' then now() else null end,
     failure_code='LEASE_EXPIRED' where id=a.id;
   insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,metadata)
     values(a.user_id,'analysis.lease_expired','analysis_job',a.id,'{}');
   released:=released+1;
 end loop;
 return released;
end $$;
revoke all on function ai_analysis.release_expired_worker_leases() from public,anon,authenticated;
grant execute on function ai_analysis.release_expired_worker_leases() to service_role;

create table ai_analysis.safety_reviewers(user_id uuid primary key references auth.users(id) on delete cascade, active boolean not null default false);
alter table ai_analysis.safety_reviewers enable row level security;
create function ai_analysis.resolve_safety_review(p_reviewer uuid,p_job_id uuid,p_decision text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; r ai_analysis.safety_reviews%rowtype; event_id uuid; next_status text;
begin
 if not exists(select 1 from ai_analysis.safety_reviewers where user_id=p_reviewer and active) then raise exception 'SAFETY_REVIEW_PERMISSION_REQUIRED'; end if;
 if p_decision not in ('approved_continue','end_analysis') then raise exception 'INVALID_DECISION'; end if;
 select * into a from ai_analysis.analysis_requests where id=p_job_id for update;
 if not found or a.deleted_at is not null then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
 select * into r from ai_analysis.safety_reviews where job_id=p_job_id and decision_key=p_key;
 if found then
   if r.decision<>p_decision then raise exception 'CALLBACK_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('status',case when r.decision='approved_continue' then 'analyzing_emotions' else 'failed' end,'replayed',true);
 end if;
 if a.status<>'safety_action_required' then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
 if p_decision='approved_continue' and not ai_analysis.job_gates_allow(a.id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 select id into event_id from ai_analysis.safety_events where analysis_request_id=p_job_id order by created_at desc limit 1;
 if event_id is null then raise exception 'SAFETY_EVENT_REQUIRED'; end if;
 insert into ai_analysis.safety_reviews(safety_event_id,job_id,reviewer_id,decision,decision_key) values(event_id,a.id,p_reviewer,p_decision,p_key);
 next_status:=case when p_decision='approved_continue' then 'analyzing_emotions' else 'failed' end;
 update ai_analysis.analysis_requests set status=next_status,lease_worker_id=null,lease_token_hash=null,lease_expires_at=null,
   completed_at=case when next_status='failed' then now() else null end,
   failure_code=case when next_status='failed' then 'SAFETY_REVIEW_ENDED_ANALYSIS' else null end where id=a.id;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,metadata)
   values(a.user_id,p_reviewer,'analysis.safety_review_resolved','analysis_job',a.id,jsonb_build_object('decision',p_decision));
 return jsonb_build_object('status',next_status,'replayed',false);
end $$;
revoke all on function ai_analysis.resolve_safety_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function ai_analysis.resolve_safety_review(uuid,uuid,text,text) to service_role;

create function ai_analysis.guard_job_transition() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('completed','failed') and (new.status<>old.status or new.progress<>old.progress
   or new.lease_token_hash is not null or new.lease_expires_at is not null) then raise exception 'ANALYSIS_JOB_TERMINAL'; end if;
 if new.progress<old.progress then raise exception 'PROGRESS_CANNOT_DECREASE'; end if;
 if old.status<>new.status and new.deleted_at is null then
   if not (case old.status
     when 'queued' then new.status in ('safety_checking','retrying','failed','waiting_for_provider')
     when 'waiting_for_provider' then new.status in ('queued','failed')
     when 'safety_checking' then new.status in ('safety_action_required','analyzing_emotions','retrying','failed')
     when 'safety_action_required' then new.status in ('analyzing_emotions','failed') and exists(select 1 from ai_analysis.safety_reviews where job_id=old.id)
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
create trigger guard_job_transition before update on ai_analysis.analysis_requests for each row execute function ai_analysis.guard_job_transition();

create function ai_analysis.advance_stub_job(p_job_id uuid,p_expected text,p_status text,p_attempt integer,p_progress integer) returns void
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype;
begin
 select * into a from ai_analysis.analysis_requests where id=p_job_id for update;
 if not found or a.processing_mode<>'development_stub' or a.status<>p_expected or a.deleted_at is not null then raise exception 'INVALID_ANALYSIS_TRANSITION'; end if;
 if p_status not in ('failed','retrying','safety_action_required') and not ai_analysis.job_gates_allow(a.id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 update ai_analysis.analysis_requests set status=p_status,attempt_count=p_attempt,progress=greatest(progress,p_progress),
   completed_at=case when p_status='failed' then now() else completed_at end,
   failure_code=case when p_status='failed' then 'ANALYSIS_FAILED' else failure_code end where id=a.id;
 if p_status='safety_action_required' then
   insert into ai_analysis.safety_events(user_id,analysis_request_id,event_type,severity,summary,metadata)
     values(a.user_id,a.id,'self_harm_support','high','Development safety-support fixture requested review.','{"simulated":true}');
 end if;
end $$;
revoke all on function ai_analysis.advance_stub_job(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function ai_analysis.advance_stub_job(uuid,text,text,integer,integer) to service_role;

create or replace function journal_service.submit_journal(
  p_user_id uuid, p_title_sentinel text, p_content_ciphertext text, p_encryption_iv text,
  p_encryption_auth_tag text, p_encryption_key_version integer, p_word_count integer,
  p_mood text, p_emotions jsonb, p_tags jsonb, p_privacy_status text,
  p_analysis_requested boolean, p_initial_status text, p_fixture text, p_processing_mode text,
  p_idempotency_key_version text, p_idempotency_hmac text, p_request_hash text
) returns table (journal_id uuid, analysis_job_id uuid, result_status text, replayed boolean)
language plpgsql security definer set search_path = public, journal_service, ai_analysis, user_service as $$
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
    encryption_key_version,word_count,mood,emotions,tags,privacy_status,analysis_consent)
  values(v_journal_id,p_user_id,p_title_sentinel,p_content_ciphertext,p_encryption_iv,p_encryption_auth_tag,
    p_encryption_key_version,p_word_count,p_mood,p_emotions,p_tags,p_privacy_status,p_analysis_requested);

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
end $$;

revoke all on function journal_service.submit_journal(uuid,text,text,text,text,integer,integer,text,jsonb,jsonb,text,boolean,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function journal_service.submit_journal(uuid,text,text,text,text,integer,integer,text,jsonb,jsonb,text,boolean,text,text,text,text,text,text) to service_role;

create function ai_analysis.reserve_rejected_submission(p_user_id uuid,p_version text,p_hmac text,p_hash text,p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare r ai_analysis.idempotency_records%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':journal.create:'||p_version||':'||p_hmac,0));
 delete from ai_analysis.idempotency_records where user_id=p_user_id and operation='journal.create' and key_version=p_version and key_hmac=p_hmac and expires_at<=now();
 select * into r from ai_analysis.idempotency_records where user_id=p_user_id and operation='journal.create' and key_version=p_version and key_hmac=p_hmac for update;
 if found then
   if r.request_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return; -- No extension of the original 24-hour window, and never overwrite a success.
 end if;
 insert into ai_analysis.idempotency_records(user_id,operation,key_version,key_hmac,request_hash,state,rejection_code,expires_at)
   values(p_user_id,'journal.create',p_version,p_hmac,p_hash,'rejected',p_code,now()+interval '24 hours');
end $$;
revoke all on function ai_analysis.reserve_rejected_submission(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function ai_analysis.reserve_rejected_submission(uuid,text,text,text,text) to service_role;

create or replace function ai_analysis.complete_journal_analysis(p_job_id uuid, p_result jsonb)
returns uuid language plpgsql security definer set search_path=public,ai_analysis,user_service as $$
declare
  v_job ai_analysis.analysis_requests%rowtype;
  v_result_id uuid := gen_random_uuid();
  v_rule_id uuid;
  v_feature text := p_result->'recommendationFeatures'->>0;
  v_period date := date_trunc('week', now())::date;
begin
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
    round((((p_result->'depressiveSymptomRange'->>'lower')::numeric+(p_result->'depressiveSymptomRange'->>'upper')::numeric)/2))::integer,
    case p_result->>'distressBand' when 'low' then 'minimal' when 'high' then 'moderately_severe' else p_result->>'distressBand' end,
    false,'Structured journal analysis result',(p_result->>'distressConfidence')::numeric,
    (p_result->>'isSimulated')::boolean,p_result,p_result->>'schemaVersion',p_result->>'thresholdVersion',
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

create or replace function ai_analysis.complete_worker_callback(
  p_job_id uuid, p_result jsonb, p_callback_type text, p_key_hmac text, p_payload_hash text,
  p_worker_id text, p_lease_token_hash text
) returns uuid language plpgsql security definer set search_path=public,ai_analysis as $$
declare v_result uuid; a ai_analysis.analysis_requests%rowtype; receipt ai_analysis.callback_receipts%rowtype;
begin
  select * into a from ai_analysis.analysis_requests where id=p_job_id for update;
  if not found or a.deleted_at is not null then raise exception 'LEASE_REJECTED'; end if;
  select * into receipt from ai_analysis.callback_receipts where job_id=p_job_id and key_hmac=p_key_hmac and (expires_at is null or expires_at>now());
  if found then
    if receipt.payload_hash<>p_payload_hash or receipt.callback_type<>p_callback_type then raise exception 'CALLBACK_IDEMPOTENCY_CONFLICT'; end if;
    if receipt.worker_id<>p_worker_id or receipt.lease_token_hash<>p_lease_token_hash then raise exception 'LEASE_REJECTED'; end if;
    if a.status not in ('completed','failed') and (a.lease_worker_id is distinct from p_worker_id or a.lease_token_hash is distinct from p_lease_token_hash or a.lease_expires_at<=now()) then raise exception 'LEASE_REJECTED'; end if;
    return (receipt.outcome_payload->>'resultId')::uuid;
  end if;
  if a.status in ('completed','failed') or a.processing_mode<>'local_worker' or a.lease_worker_id is distinct from p_worker_id
    or a.lease_token_hash is distinct from p_lease_token_hash or a.lease_expires_at is null or a.lease_expires_at<=now() then raise exception 'LEASE_REJECTED'; end if;
  if p_callback_type<>'final_result' then raise exception 'INVALID_CALLBACK_TYPE'; end if;
  v_result := ai_analysis.complete_journal_analysis(p_job_id,p_result);
  insert into ai_analysis.callback_receipts(job_id,callback_type,key_hmac,payload_hash,worker_id,
    lease_token_hash,outcome_status,outcome_payload,expires_at)
  values(p_job_id,p_callback_type,p_key_hmac,p_payload_hash,p_worker_id,p_lease_token_hash,200,
    jsonb_build_object('resultId',v_result,'status','completed'),now()+interval '30 days');
  return v_result;
end $$;
revoke all on function ai_analysis.complete_worker_callback(uuid,jsonb,text,text,text,text,text) from public,anon,authenticated;
grant execute on function ai_analysis.complete_worker_callback(uuid,jsonb,text,text,text,text,text) to service_role;

-- Every worker mutation and receipt is serialized with deletion, expiry, and completion.
create function ai_analysis.apply_worker_callback(p_job_id uuid,p_type text,p_key_hmac text,p_payload_hash text,
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
   next_status:=case when a.attempt_count<3 then 'retrying' else 'failed' end;
   next_progress:=case when next_status='failed' then a.progress else greatest(a.progress,case when a.attempt_count<=1 then 70 else 92 end) end;
 else raise exception 'INVALID_CALLBACK_TYPE';
 end if;
 if p_type<>'heartbeat' then
   stage:=array_position(array['safety_checking','analyzing_emotions','classifying_distress','estimating_screening','generating_recommendation'],next_status);
   if stage is not null then next_progress:=greatest(next_progress,case when a.attempt_count<=1 then (array[10,25,35,45,55])[stage]
     when a.attempt_count=2 then (array[72,76,80,84,87])[stage] else (array[93,94,95,96,97])[stage] end); end if;
   update ai_analysis.analysis_requests set status=next_status,progress=next_progress,
     completed_at=case when next_status='failed' then now() else completed_at end,
     failure_code=case when p_type='failure' then 'WORKER_FAILURE' else failure_code end,
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

create function ai_analysis.lookup_worker_receipt(p_job_id uuid,p_type text,p_key_hmac text,p_payload_hash text,p_worker_id text,p_lease_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a ai_analysis.analysis_requests%rowtype; r ai_analysis.callback_receipts%rowtype;
begin
 select * into a from ai_analysis.analysis_requests where id=p_job_id for share;
 if not found or a.deleted_at is not null then raise exception 'LEASE_REJECTED'; end if;
 select * into r from ai_analysis.callback_receipts where job_id=p_job_id and key_hmac=p_key_hmac and (expires_at is null or expires_at>now());
 if found then
   if r.payload_hash<>p_payload_hash or r.callback_type<>p_type then raise exception 'CALLBACK_IDEMPOTENCY_CONFLICT'; end if;
   if r.worker_id<>p_worker_id or r.lease_token_hash<>p_lease_hash then raise exception 'LEASE_REJECTED'; end if;
   if a.status in ('completed','failed') then return jsonb_build_object('replay',true,'outcome',r.outcome_payload); end if;
 end if;
 if a.status in ('completed','failed') or a.processing_mode<>'local_worker' or a.lease_worker_id is distinct from p_worker_id
   or a.lease_token_hash is distinct from p_lease_hash or a.lease_expires_at is null or a.lease_expires_at<=now() then raise exception 'LEASE_REJECTED'; end if;
 if r.id is not null then return jsonb_build_object('replay',true,'outcome',r.outcome_payload); end if;
 return null;
end $$;
revoke all on function ai_analysis.lookup_worker_receipt(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function ai_analysis.lookup_worker_receipt(uuid,text,text,text,text,text) to service_role;

-- Browser roles have no direct private-schema access. Express retains explicit service-role access.
revoke all on all tables in schema journal_service, ai_analysis, insights_service, buddy_service,
  verification_service, notification_service, grounding_service, user_service, auth_provisioning from anon, authenticated;
revoke usage on schema journal_service, ai_analysis, insights_service, buddy_service,
  verification_service, notification_service, grounding_service, user_service, auth_provisioning from anon, authenticated;
grant usage on schema journal_service, ai_analysis, insights_service, buddy_service,
  verification_service, notification_service, grounding_service, user_service, auth_provisioning to service_role;
grant select, insert, update, delete on all tables in schema journal_service, ai_analysis, insights_service,
  buddy_service, verification_service, notification_service, grounding_service, user_service, auth_provisioning to service_role;

alter role authenticator set pgrst.db_schemas = 'public,graphql_public,user_service,journal_service,buddy_service,verification_service,notification_service,grounding_service,insights_service,ai_analysis,auth_provisioning';
notify pgrst, 'reload config';

alter table ai_analysis.idempotency_records enable row level security;
alter table ai_analysis.callback_receipts enable row level security;
alter table ai_analysis.transition_receipts enable row level security;
alter table ai_analysis.recommendation_rules enable row level security;
alter table ai_analysis.recommendation_selections enable row level security;
alter table ai_analysis.aggregation_tasks enable row level security;
alter table ai_analysis.worker_health enable row level security;
alter table ai_analysis.safety_reviews enable row level security;
alter table insights_service.weekly_analysis_metrics enable row level security;
alter table buddy_service.recommendation_handoffs enable row level security;
alter table notification_service.support_contact_requests enable row level security;

insert into ai_analysis.recommendation_rules(rule_version,feature,title,description,activity,reviewed_at)
values
 ('echo-cbt-rules-v1','paced_breathing','Make room for one slower breath','Try a brief paced-breathing exercise without forcing the breath.','paced-breathing',now()),
 ('echo-cbt-rules-v1','grounding','Return to what is here','Use a short sensory grounding exercise to reconnect with the present moment.','five-senses-grounding',now()),
 ('echo-cbt-rules-v1','behavioral_activation','Choose one gentle next step','Pick one small, realistic activity that supports your routine.','gentle-next-step',now()),
 ('echo-cbt-rules-v1','thought_reframing','Look at the thought with care','Explore another balanced way to describe what happened.','balanced-perspective',now()),
 ('echo-cbt-rules-v1','support_connection','Reach toward safe support','Consider contacting someone you trust when it feels appropriate.','support-connection',now())
on conflict (rule_version,feature) do nothing;

create index if not exists idempotency_expiry_idx on ai_analysis.idempotency_records(expires_at);
create index if not exists callback_receipts_expiry_idx on ai_analysis.callback_receipts(expires_at);
create index if not exists handoffs_expiry_idx on buddy_service.recommendation_handoffs(expires_at);

create function insights_service.recompute_analysis_week(p_user uuid,p_period date) returns void
language plpgsql security definer set search_path='' as $$
declare emotions jsonb; distress jsonb; sources integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_period::text||':weekly-analysis-v1',0));
 select count(*) into sources from ai_analysis.analysis_results r join ai_analysis.analysis_requests a on a.id=r.analysis_request_id
 join journal_service.journals j on j.id=a.journal_id where r.user_id=p_user and not r.is_simulated and r.result_payload is not null
 and j.deleted_at is null and a.status='completed' and r.created_at>=p_period::timestamptz and r.created_at<(p_period+7)::timestamptz;
 select coalesce(jsonb_object_agg(emotion,value),'{}') into emotions from (
   select e->>'emotion' emotion,avg((e->>'value')::numeric) value
   from ai_analysis.analysis_results r join ai_analysis.analysis_requests a on a.id=r.analysis_request_id
   join journal_service.journals j on j.id=a.journal_id cross join lateral jsonb_array_elements(r.result_payload->'emotionDistribution') e
   where r.user_id=p_user and not r.is_simulated and j.deleted_at is null and a.status='completed'
     and r.created_at>=p_period::timestamptz and r.created_at<(p_period+7)::timestamptz group by e->>'emotion') values_by_emotion;
 select coalesce(jsonb_object_agg(band,total),'{}') into distress from (
   select r.result_payload->>'distressBand' band,count(*) total
   from ai_analysis.analysis_results r join ai_analysis.analysis_requests a on a.id=r.analysis_request_id
   join journal_service.journals j on j.id=a.journal_id where r.user_id=p_user and not r.is_simulated and r.result_payload is not null
   and j.deleted_at is null and a.status='completed' and r.created_at>=p_period::timestamptz and r.created_at<(p_period+7)::timestamptz
   group by r.result_payload->>'distressBand') values_by_band;
 insert into insights_service.weekly_analysis_metrics(user_id,period_start,aggregate_version,emotion_payload,distress_payload,source_count)
 values(p_user,p_period,'weekly-analysis-v1',emotions,distress,sources)
 on conflict(user_id,period_start,aggregate_version) do update set emotion_payload=excluded.emotion_payload,
   distress_payload=excluded.distress_payload,source_count=excluded.source_count,updated_at=now();
end $$;
revoke all on function insights_service.recompute_analysis_week(uuid,date) from public,anon,authenticated;
grant execute on function insights_service.recompute_analysis_week(uuid,date) to service_role;

create function ai_analysis.run_aggregation_tasks(p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$
declare task ai_analysis.aggregation_tasks%rowtype; processed integer:=0;
begin
 for task in select * from ai_analysis.aggregation_tasks where status in ('queued','retrying') and attempt_count<5
   and (next_attempt_at is null or next_attempt_at<=now()) order by created_at for update skip locked limit least(p_limit,100) loop
   begin
     perform insights_service.recompute_analysis_week(task.user_id,task.period_start);
     update ai_analysis.aggregation_tasks set status='completed',attempt_count=attempt_count+1,updated_at=now() where id=task.id;
     processed:=processed+1;
   exception when others then
     update ai_analysis.aggregation_tasks set status=case when attempt_count>=4 then 'failed' else 'retrying' end,
       attempt_count=attempt_count+1,next_attempt_at=now()+interval '1 minute',updated_at=now() where id=task.id;
   end;
 end loop;
 return processed;
end $$;
revoke all on function ai_analysis.run_aggregation_tasks(integer) from public,anon,authenticated;
grant execute on function ai_analysis.run_aggregation_tasks(integer) to service_role;

-- All source-owned records have explicit lifecycle ownership. Restricted retained
-- records become anonymous on purge, rather than becoming identifiable orphans.
alter table journal_service.journals add constraint journals_auth_user_fk foreign key(user_id) references auth.users(id) on delete cascade;
alter table journal_service.journal_drafts add constraint journal_drafts_auth_user_fk foreign key(user_id) references auth.users(id) on delete cascade;
alter table ai_analysis.analysis_requests add constraint analysis_requests_auth_user_fk foreign key(user_id) references auth.users(id) on delete cascade;
alter table ai_analysis.analysis_results add constraint analysis_results_auth_user_fk foreign key(user_id) references auth.users(id) on delete cascade;
alter table ai_analysis.safety_events alter column user_id drop not null;
alter table ai_analysis.safety_events add constraint safety_events_auth_user_fk foreign key(user_id) references auth.users(id) on delete set null;
alter table ai_analysis.analysis_audit_log alter column user_id drop not null;
alter table ai_analysis.analysis_audit_log drop constraint if exists analysis_audit_log_analysis_request_id_fkey;
alter table ai_analysis.analysis_audit_log add constraint analysis_audit_log_analysis_request_id_fkey foreign key(analysis_request_id) references ai_analysis.analysis_requests(id) on delete set null;
alter table ai_analysis.analysis_audit_log add constraint analysis_audit_user_fk foreign key(user_id) references auth.users(id) on delete set null;

create function buddy_service.guard_analysis_handoff() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from ai_analysis.analysis_results r join ai_analysis.analysis_requests a on a.id=r.analysis_request_id
 join journal_service.journals j on j.id=a.journal_id where r.id=new.analysis_result_id and r.user_id=new.user_id
 and j.deleted_at is null and a.status='completed' for share of j;
 if not found then raise exception 'HANDOFF_SOURCE_UNAVAILABLE'; end if;
 if not exists(select 1 from ai_analysis.recommendation_selections where id=new.recommendation_selection_id
   and analysis_result_id=new.analysis_result_id and user_id=new.user_id) then raise exception 'HANDOFF_SELECTION_MISMATCH'; end if;
 return new;
end $$;
create trigger guard_analysis_handoff before insert on buddy_service.recommendation_handoffs for each row execute function buddy_service.guard_analysis_handoff();

create function notification_service.guard_support_contact_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from user_service.trusted_contacts where id=new.trusted_contact_id and user_id=new.user_id) then raise exception 'CONTACT_OWNER_MISMATCH'; end if;
 if new.safety_event_id is not null then
   perform 1 from ai_analysis.safety_events s join ai_analysis.analysis_requests a on a.id=s.analysis_request_id
     join journal_service.journals j on j.id=a.journal_id where s.id=new.safety_event_id and s.user_id=new.user_id
     and a.deleted_at is null and j.deleted_at is null for share of j;
   if not found then raise exception 'SUPPORT_SOURCE_UNAVAILABLE'; end if;
 end if;
 if new.status<>'denied' and not exists(select 1 from user_service.trusted_contacts c join user_service.profiles p on p.user_id=c.user_id
   where c.id=new.trusted_contact_id and c.verified and c.permission_acknowledged_at is not null and length(c.relationship)>0
     and p.eligible_18_plus and p.account_status='active') then raise exception 'CONTACT_POLICY_DENIED'; end if;
 if new.status<>'denied' then new.status:='review_required'; end if;
 return new;
end $$;
create trigger guard_support_contact_request before insert on notification_service.support_contact_requests
 for each row execute function notification_service.guard_support_contact_request();

create function journal_service.anonymize_journal_purge() returns trigger language plpgsql security definer set search_path='' as $$
declare period date;
begin
 delete from notification_service.support_contact_requests where safety_event_id in (select id from ai_analysis.safety_events
   where analysis_request_id in(select id from ai_analysis.analysis_requests where journal_id=old.id));
 update user_service.audit_events set user_id=null,actor_user_id=null,resource_id=null,request_id=null,metadata='{}'
   where (resource_type='journal' and resource_id=old.id) or (resource_type='analysis_job' and resource_id in
   (select id from ai_analysis.analysis_requests where journal_id=old.id));
 update ai_analysis.safety_events set user_id=null,analysis_request_id=null,metadata='{}',summary='Restricted safety record retained under the one-year policy.'
   where analysis_request_id in(select id from ai_analysis.analysis_requests where journal_id=old.id);
 update ai_analysis.analysis_audit_log set user_id=null,analysis_request_id=null,actor='system',metadata='{}'
   where analysis_request_id in(select id from ai_analysis.analysis_requests where journal_id=old.id);
 -- Legacy mutable records are removed as part of source purge, never updated as results.
 delete from journal_service.journal_analyses where journal_id=old.id;
 for period in select distinct date_trunc('week',r.created_at)::date from ai_analysis.analysis_results r
   join ai_analysis.analysis_requests a on a.id=r.analysis_request_id where a.journal_id=old.id loop
   perform insights_service.recompute_analysis_week(old.user_id,period);
 end loop;
 return old;
end $$;
create trigger anonymize_journal_purge before delete on journal_service.journals for each row execute function journal_service.anonymize_journal_purge();

create function user_service.anonymize_analysis_account_purge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update user_service.audit_events set user_id=null,actor_user_id=null,resource_id=null,request_id=null,metadata='{}' where user_id=old.id or actor_user_id=old.id;
 update ai_analysis.safety_events set user_id=null,analysis_request_id=null,metadata='{}',summary='Restricted safety record retained under the one-year policy.' where user_id=old.id;
 update ai_analysis.analysis_audit_log set user_id=null,analysis_request_id=null,actor='system',metadata='{}' where user_id=old.id;
 update public.audit_events set user_id=null,resource_id=null,metadata='{}' where user_id=old.id;
 update public.safety_events set user_id=null,journal_id=null,analysis_id=null,matched_rule_id=null,detection_source='retained_anonymous' where user_id=old.id;
 return old;
end $$;
create trigger anonymize_analysis_account_purge before delete on auth.users for each row execute function user_service.anonymize_analysis_account_purge();

-- Keep historical safety records anonymous, too; their old source-required check
-- otherwise prevented the existing SET NULL foreign keys from doing their job.
alter table public.safety_events alter column user_id drop not null;
alter table public.safety_events drop constraint if exists safety_events_user_id_fkey;
alter table public.safety_events add constraint safety_events_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;
alter table public.safety_events drop constraint if exists safety_events_check;
alter table public.safety_events add constraint safety_events_source_or_anonymous check(user_id is null or journal_id is not null or analysis_id is not null);
alter table public.audit_events alter column request_id drop not null;
revoke all on public.audit_events from anon,authenticated;
create function journal_service.anonymize_legacy_journal_purge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.audit_events set user_id=null,resource_id=null,request_id=null,metadata='{}'
   where resource_id=old.id or resource_id in(select id from public.journal_analyses where journal_id=old.id);
 update public.safety_events set user_id=null,journal_id=null,analysis_id=null,matched_rule_id=null,detection_source='retained_anonymous'
   where journal_id=old.id or analysis_id in(select id from public.journal_analyses where journal_id=old.id);
 return old;
end $$;
create trigger anonymize_legacy_journal_purge before delete on public.journals for each row execute function journal_service.anonymize_legacy_journal_purge();

create or replace function ai_analysis.run_retention(p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path=public,ai_analysis,journal_service,buddy_service,user_service as $$
declare
  v_idempotency bigint; v_callbacks bigint; v_handoffs bigint; v_journals bigint; v_audits bigint; v_safety bigint; v_legacy_journals bigint;
begin
  select count(*) into v_idempotency from ai_analysis.idempotency_records where expires_at <= now();
  select count(*) into v_callbacks from ai_analysis.callback_receipts where expires_at <= now();
  select count(*) into v_handoffs from buddy_service.recommendation_handoffs where expires_at <= now();
  select count(*) into v_journals from journal_service.journals where deleted_at <= now()-interval '30 days';
  select count(*) into v_legacy_journals from public.journals where deleted_at <= now()-interval '30 days';
  select sum(total) into v_audits from (
    select count(*) total from user_service.audit_events where created_at <= now()-interval '1 year'
    union all select count(*) from public.audit_events where created_at <= now()-interval '1 year'
    union all select count(*) from ai_analysis.analysis_audit_log where created_at <= now()-interval '1 year') counts;
  select sum(total) into v_safety from (
    select count(*) total from ai_analysis.safety_events where created_at <= now()-interval '1 year'
    union all select count(*) from public.safety_events where created_at <= now()-interval '1 year') counts;
  if not p_dry_run then
    delete from ai_analysis.idempotency_records where expires_at <= now();
    delete from ai_analysis.callback_receipts where expires_at <= now();
    delete from buddy_service.recommendation_handoffs where expires_at <= now();
    -- Deleting the source invokes anonymization before cascading jobs/results.
    delete from journal_service.journals where deleted_at <= now()-interval '30 days';
    delete from public.journals where deleted_at <= now()-interval '30 days';
    delete from public.audit_events where created_at <= now()-interval '1 year';
    delete from public.safety_events where created_at <= now()-interval '1 year';
    delete from user_service.audit_events where created_at <= now()-interval '1 year';
    delete from ai_analysis.analysis_audit_log where created_at <= now()-interval '1 year';
    delete from ai_analysis.safety_events where created_at <= now()-interval '1 year';
  end if;
  return jsonb_build_object('dryRun',p_dry_run,'idempotency',v_idempotency,'callbacks',v_callbacks,
    'handoffs',v_handoffs,'journals',v_journals,'legacyJournals',v_legacy_journals,'audits',v_audits,'safety',v_safety);
end $$;
revoke all on function ai_analysis.run_retention(boolean) from public,anon,authenticated;
grant execute on function ai_analysis.run_retention(boolean) to service_role;
