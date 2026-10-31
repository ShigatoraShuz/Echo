-- BE-010/011 local proposal, after credential reviews and owner request actions.
-- Retains the five existing request states. No transfer/reopening API is added.
create function professional_service.current_clinician(p_organization_id uuid,p_actor uuid)
returns boolean language sql stable security definer
set search_path = professional_service, pg_catalog as $$
  select exists (
    select 1 from professional_service.memberships m
    join professional_service.organizations o on o.id=m.organization_id
    join user_service.profiles p on p.user_id=m.user_id
    join professional_service.credential_reviews c on c.id=m.approved_credential_id
    where m.organization_id=p_organization_id and m.user_id=p_actor and m.status='active' and o.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.approved_at is not null
      and p.account_status='active' and p.eligible_18_plus=true and p.onboarding_completed=true
      and c.status='approved' and c.user_id=m.user_id and c.organization_id=m.organization_id and c.role=m.role
      and c.reviewed_by is not null and c.reviewed_by<>m.user_id and c.expires_at>=current_date
      and c.expires_at=m.credential_expires_at and c.credential_label=m.credential_label
  );
$$;
revoke all on function professional_service.current_clinician(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function professional_service.claim_request(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare result professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into result from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not professional_service.current_clinician(result.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  -- A lost response may be retried by the same eligible assignee, never another actor.
  if result.assigned_to=p_actor and result.status in ('assigned','scheduled') then return result; end if;
  if result.status <> 'submitted' or result.assigned_to is not null then raise exception 'REQUEST_ALREADY_ASSIGNED'; end if;
  update professional_service.support_requests set assigned_to=p_actor,status='assigned',updated_at=now()
    where id=result.id returning * into result;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(result.organization_id,result.id,p_actor,'request.claimed');
  return result;
end $$;

create or replace function professional_service.set_request_status(p_request_id uuid,p_actor uuid,p_status text)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare result professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_status is null or p_status not in ('closed','declined') then raise exception 'INVALID_STATUS'; end if;
  select * into result from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if result.assigned_to is distinct from p_actor then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if not professional_service.current_clinician(result.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if result.status=p_status then return result; end if;
  if result.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if exists(select 1 from professional_service.appointments where request_id=result.id and status in ('proposed','confirmed'))
    then raise exception 'APPOINTMENT_ACTIVE'; end if;
  update professional_service.support_requests set status=p_status,updated_at=now() where id=result.id returning * into result;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(result.organization_id,result.id,p_actor,'request.'||p_status);
  return result;
end $$;

create function professional_service.enforce_request_transition() returns trigger language plpgsql
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
  ) then raise exception 'INVALID_CASE_TRANSITION'; end if;
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
create trigger professional_request_transition before insert or update on professional_service.support_requests
  for each row execute function professional_service.enforce_request_transition();
revoke all on function professional_service.enforce_request_transition() from public,anon,authenticated,service_role;

-- Serialize notes/referrals against closure, in addition to checking current access.
create or replace function professional_service.require_assigned_author() returns trigger language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare result professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into result from professional_service.support_requests where id=new.request_id for update;
  if not found or result.assigned_to is distinct from new.author_user_id or result.status not in ('assigned','scheduled')
    or not professional_service.current_clinician(result.organization_id,new.author_user_id)
    then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  return new;
end $$;
-- CREATE OR REPLACE preserves the existing service-only RPC grants.
