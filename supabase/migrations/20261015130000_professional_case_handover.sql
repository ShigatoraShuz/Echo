-- BE-018 local-only: same-organization handover receipts and encrypted closure reasons.
create table professional_service.case_transfers (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references professional_service.support_requests(id),
  organization_id uuid not null references professional_service.organizations(id),
  from_user_id uuid not null references auth.users(id), to_user_id uuid not null references auth.users(id),
  reason_encrypted text not null check(reason_encrypted like 'echo:encrypted:v1:%'), submission_id uuid not null,
  transaction_id bigint not null default txid_current(), created_at timestamptz not null default clock_timestamp(),
  unique(request_id,from_user_id,submission_id), check(from_user_id<>to_user_id)
);
create table professional_service.case_closures (
  request_id uuid primary key references professional_service.support_requests(id),
  actor_user_id uuid not null references auth.users(id), reason_encrypted text check(reason_encrypted like 'echo:encrypted:v1:%'),
  created_at timestamptz not null default clock_timestamp()
);
alter table professional_service.case_transfers enable row level security;
alter table professional_service.case_closures enable row level security;
revoke all on professional_service.case_transfers,professional_service.case_closures from public,anon,authenticated,service_role;

-- Preserve the existing transition rules. A reassignment additionally requires
-- a receipt created by the service-only transfer RPC in this very transaction.
create or replace function professional_service.enforce_request_transition() returns trigger language plpgsql
set search_path = professional_service, pg_catalog as $$
begin
  if new.status='submitted' and new.assigned_to is not null
    or new.status in ('assigned','scheduled') and new.assigned_to is null then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if tg_op='INSERT' then
    if new.status<>'submitted' then raise exception 'INVALID_CASE_TRANSITION'; end if;
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id or new.user_id is distinct from old.user_id
    then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if new.assigned_to is distinct from old.assigned_to and not (
    old.status='submitted' and old.assigned_to is null and new.status='assigned' and new.assigned_to is not null
  ) then
    if old.status<>'assigned' or new.status<>'assigned' or not exists (
      select 1 from professional_service.case_transfers t where t.request_id=old.id and t.organization_id=old.organization_id
        and t.from_user_id=old.assigned_to and t.to_user_id=new.assigned_to and t.transaction_id=txid_current()
    ) then raise exception 'INVALID_CASE_TRANSITION'; end if;
  end if;
  if new.status is distinct from old.status and not (
    old.status='submitted' and new.status='assigned' or
    old.status='submitted' and new.status='closed' and new.assigned_to is null and new.sharing_revoked_at is not null or
    old.status='assigned' and new.status in ('scheduled','closed','declined') or
    old.status='scheduled' and new.status in ('assigned','closed','declined')
  ) then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if new.status='scheduled' and not exists(select 1 from professional_service.appointments where request_id=new.id and status='confirmed')
    then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if new.status='assigned' and exists(select 1 from professional_service.appointments where request_id=new.id and status='confirmed')
    then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if new.status in ('closed','declined') and exists(select 1 from professional_service.appointments where request_id=new.id and status in ('proposed','confirmed'))
    then raise exception 'APPOINTMENT_ACTIVE'; end if;
  return new;
end $$;

create function professional_service.transfer_case(p_request_id uuid,p_actor uuid,p_target uuid,p_reason_encrypted text,p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; t professional_service.case_transfers;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_target is null or p_target=p_actor or p_submission_id is null or p_reason_encrypted is null
    or p_reason_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_TRANSFER'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- Lock eligibility in deterministic order for both participants.
  perform 1 from professional_service.organizations where id=r.organization_id and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from user_service.profiles where user_id in (p_actor,p_target) order by user_id for share;
  perform 1 from professional_service.memberships where organization_id=r.organization_id and user_id in (p_actor,p_target) order by user_id for share;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if not professional_service.current_clinician(r.organization_id,p_target) then raise exception 'TRANSFER_TARGET_UNAVAILABLE'; end if;
  select * into t from professional_service.case_transfers where request_id=r.id and from_user_id=p_actor and submission_id=p_submission_id;
  if found then
    if t.to_user_id<>p_target or r.assigned_to is distinct from p_target then raise exception 'TRANSFER_CONFLICT'; end if;
    return jsonb_build_object('request',to_jsonb(r),'transferId',t.id,'reasonEncrypted',t.reason_encrypted);
  end if;
  if r.assigned_to is distinct from p_actor then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if r.status<>'assigned' then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if exists(select 1 from professional_service.appointments where request_id=r.id and status in ('proposed','confirmed')) then raise exception 'APPOINTMENT_ACTIVE'; end if;
  if exists(select 1 from professional_service.case_notes where request_id=r.id and author_user_id=p_actor and state='draft') then raise exception 'DRAFT_NOTES_PENDING'; end if;
  insert into professional_service.case_transfers(request_id,organization_id,from_user_id,to_user_id,reason_encrypted,submission_id)
    values(r.id,r.organization_id,p_actor,p_target,p_reason_encrypted,p_submission_id) returning * into t;
  update professional_service.support_requests set assigned_to=p_target,updated_at=clock_timestamp() where id=r.id returning * into r;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,subject_user_id,action)
    values(r.organization_id,r.id,p_actor,p_target,'request.transferred');
  return jsonb_build_object('request',to_jsonb(r),'transferId',t.id,'reasonEncrypted',t.reason_encrypted);
end $$;

create function professional_service.close_case(p_request_id uuid,p_actor uuid,p_reason_encrypted text)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; c professional_service.case_closures;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_reason_encrypted is not null and p_reason_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_CLOSURE'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.assigned_to is distinct from p_actor then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if r.status='closed' then
    select * into c from professional_service.case_closures where request_id=r.id;
    -- Historical closures may have no recorded reason. Never retrofit one.
    if not found and p_reason_encrypted is not null then raise exception 'CLOSURE_CONFLICT'; end if;
    return jsonb_build_object('request',to_jsonb(r),'reasonEncrypted',c.reason_encrypted);
  end if;
  select * into r from professional_service.set_request_status(r.id,p_actor,'closed');
  insert into professional_service.case_closures(request_id,actor_user_id,reason_encrypted)
    values(r.id,p_actor,p_reason_encrypted) returning * into c;
  return jsonb_build_object('request',to_jsonb(r),'reasonEncrypted',c.reason_encrypted);
end $$;
revoke all on function professional_service.transfer_case(uuid,uuid,uuid,text,uuid),professional_service.close_case(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function professional_service.transfer_case(uuid,uuid,uuid,text,uuid),professional_service.close_case(uuid,uuid,text) to service_role;
