begin;

-- Policy approval is deliberately absent from this migration. A later,
-- reviewed migration must set approved_at and approval_reference.
create table user_service.retention_policy_approvals (
  policy_version text primary key,
  approved_at timestamptz,
  approval_reference text,
  created_at timestamptz not null default now(),
  check ((approved_at is null) = (approval_reference is null))
);
insert into user_service.retention_policy_approvals(policy_version) values('category-retention-v1');
alter table user_service.retention_policy_approvals enable row level security;
revoke all on user_service.retention_policy_approvals from public,anon,authenticated,service_role;
grant select on user_service.retention_policy_approvals to service_role;

create function user_service.category_retention_approved() returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 return exists(select 1 from user_service.retention_policy_approvals
  where policy_version='category-retention-v1' and approved_at is not null and approval_reference is not null);
end $$;

create function user_service.run_category_retention(p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare drafts bigint; notices bigint; metadata bigint; buddy_review bigint;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if not p_dry_run and not user_service.category_retention_approved() then raise exception 'RETENTION_POLICY_NOT_APPROVED'; end if;
 select (select count(*) from journal_service.journal_drafts where updated_at<=now()-interval '90 days')+
  (select count(*) from public.journal_drafts where updated_at<=now()-interval '90 days') into drafts;
 select (select count(*) from notification_service.notifications where created_at<=now()-interval '90 days')+
  (select count(*) from public.notifications where created_at<=now()-interval '90 days') into notices;
 select count(*) into metadata from ai_analysis.analysis_requests
  where status in ('completed','failed') and completed_at<=now()-interval '30 days'
   and (failure_message is not null or fixture is not null or lease_token_hash is not null or lease_worker_id is not null);
 select count(*) into buddy_review from buddy_service.buddy_conversations
  where coalesce(last_message_at,created_at)<=now()-interval '1 year';
 if not p_dry_run then
  delete from journal_service.journal_drafts where updated_at<=now()-interval '90 days' and user_id in
   (select user_id from journal_service.journal_drafts where updated_at<=now()-interval '90 days' order by updated_at,user_id limit 500);
  delete from public.journal_drafts where updated_at<=now()-interval '90 days' and id in
   (select id from public.journal_drafts where updated_at<=now()-interval '90 days' order by updated_at,id limit 500);
  delete from notification_service.notification_logs where notification_id in
   (select id from notification_service.notifications where created_at<=now()-interval '90 days' order by created_at,id limit 500);
  delete from notification_service.notifications where id in
   (select id from notification_service.notifications where created_at<=now()-interval '90 days' order by created_at,id limit 500);
  delete from public.notifications where id in
   (select id from public.notifications where created_at<=now()-interval '90 days' order by created_at,id limit 500);
  update ai_analysis.analysis_requests set failure_message=null,fixture=null,
   lease_token_hash=null,lease_worker_id=null,lease_expires_at=null
   where id in (select id from ai_analysis.analysis_requests
    where status in ('completed','failed') and completed_at<=now()-interval '30 days'
     and (failure_message is not null or fixture is not null or lease_token_hash is not null or lease_worker_id is not null)
    order by completed_at,id limit 500);
 end if;
 return jsonb_build_object('dryRun',p_dry_run,'abandonedDrafts',drafts,'notifications',notices,
  'analysisOperationalMetadata',metadata,'buddyInactivityReviewOnly',buddy_review,'checkedAt',now());
end $$;

create function user_service.eligible_verification_document_retention(p_limit integer default 100)
returns table(document_id uuid,source_schema text,user_id uuid,storage_path text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if p_limit<1 or p_limit>500 then raise exception 'INVALID_LIMIT'; end if;
 return query
  select d.id,'verification_service'::text,d.user_id,d.storage_path
   from verification_service.verification_documents d
   join verification_service.identity_verifications v on v.id=d.verification_id
   where v.verification_status in ('approved','rejected','expired')
    and v.reviewed_at<=now()-interval '30 days'
  union all
  select d.id,'public'::text,d.user_id,d.storage_path
   from public.verification_documents d
   join public.identity_verifications v on v.id=d.verification_id
   where v.verification_status in ('approved','rejected','expired')
    and v.reviewed_at<=now()-interval '30 days'
  limit p_limit;
end $$;

create function user_service.finish_verification_document_retention(p_id uuid,p_source_schema text,p_path text)
returns boolean language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if not user_service.category_retention_approved() then raise exception 'RETENTION_POLICY_NOT_APPROVED'; end if;
 if p_source_schema='verification_service' then
  delete from verification_service.verification_documents d using verification_service.identity_verifications v
   where d.id=p_id and d.storage_path=p_path and v.id=d.verification_id
    and v.verification_status in ('approved','rejected','expired') and v.reviewed_at<=now()-interval '30 days';
 elsif p_source_schema='public' then
  delete from public.verification_documents d using public.identity_verifications v
   where d.id=p_id and d.storage_path=p_path and v.id=d.verification_id
    and v.verification_status in ('approved','rejected','expired') and v.reviewed_at<=now()-interval '30 days';
 else raise exception 'INVALID_SOURCE'; end if;
 get diagnostics removed=row_count;
 return removed=1;
end $$;

revoke all on function user_service.category_retention_approved(),user_service.run_category_retention(boolean),
 user_service.eligible_verification_document_retention(integer),
 user_service.finish_verification_document_retention(uuid,text,text) from public,anon,authenticated;
grant execute on function user_service.category_retention_approved(),user_service.run_category_retention(boolean),
 user_service.eligible_verification_document_retention(integer),
 user_service.finish_verification_document_retention(uuid,text,text) to service_role;

-- The active Privacy Notice already limits sanitized audit records to one year.
-- Professional audit rows were introduced after the analysis retention routine.
create function professional_service.run_audit_retention(p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eligible bigint; removed bigint:=0;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 select count(*) into eligible from professional_service.audit_events
  where created_at<=now()-interval '1 year';
 if not p_dry_run then
  delete from professional_service.audit_events where created_at<=now()-interval '1 year';
  get diagnostics removed=row_count;
 end if;
 return jsonb_build_object('dryRun',p_dry_run,'eligible',eligible,'removed',removed);
end $$;
revoke all on function professional_service.run_audit_retention(boolean) from public,anon,authenticated;
grant execute on function professional_service.run_audit_retention(boolean) to service_role;

commit;
