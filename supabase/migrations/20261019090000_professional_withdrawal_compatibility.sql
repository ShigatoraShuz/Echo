-- Additive compatibility correction; never rewrite applied cloud history.
-- Keep withdraw_request cancellation, sharing revocation and audit behavior intact.
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
    -- Preserve the existing service-only owner RPC's withdrawn state.
    -- Actor/ownership checks remain in withdraw_request; sharing must stop and
    -- the assignment/organization/owner guards above still apply.
    old.status in ('submitted','assigned','scheduled') and new.status='withdrawn'
      and new.sharing_revoked_at is not null or
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
