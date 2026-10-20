-- BE-020 local proposal. Preserve proposed/confirmed/canceled and owner acceptance.
alter table professional_service.appointments add column replaces_appointment_id uuid
  unique references professional_service.appointments(id);

create or replace function professional_service.propose_appointment(
  p_request_id uuid,p_actor uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_mode text,p_location_hint_encrypted text
) returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; a professional_service.appointments;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.assigned_to is distinct from p_actor then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if r.status<>'assigned' then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_starts_at<=clock_timestamp() or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '2 hours'
    or p_mode is null or p_mode not in ('in_person','online','phone')
    or p_location_hint_encrypted is null or p_location_hint_encrypted not like 'echo:encrypted:v1:%'
    then raise exception 'INVALID_APPOINTMENT'; end if;
  perform pg_advisory_xact_lock(hashtext(p_actor::text));
  if exists(select 1 from professional_service.appointments where request_id=r.id and status in ('proposed','confirmed'))
    or exists(select 1 from professional_service.appointments booked where booked.professional_user_id=p_actor and booked.status in ('proposed','confirmed')
      and tstzrange(booked.starts_at,booked.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'APPOINTMENT_CONFLICT'; end if;
  insert into professional_service.appointments(request_id,professional_user_id,starts_at,ends_at,mode,location_hint_encrypted)
    values(r.id,p_actor,p_starts_at,p_ends_at,p_mode,p_location_hint_encrypted) returning * into a;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,'appointment.proposed');
  return a;
end $$;

create or replace function professional_service.respond_appointment(p_appointment_id uuid,p_actor uuid,p_accept boolean)
returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; a professional_service.appointments; request_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_accept is null then raise exception 'INVALID_APPOINTMENT'; end if;
  select ap.request_id into request_id from professional_service.appointments ap where ap.id=p_appointment_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- All appointment writers lock request before appointment, then practitioner.
  select * into r from professional_service.support_requests where id=request_id for update;
  if not found or r.user_id is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  select * into a from professional_service.appointments where id=p_appointment_id for update;
  if a.status='canceled' and not p_accept then return a; end if;
  if r.assigned_to is distinct from a.professional_user_id
    or not professional_service.current_clinician(r.organization_id,a.professional_user_id) then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  if a.status='confirmed' and p_accept and r.status='scheduled' then return a; end if;
  if a.status<>'proposed' or r.status<>'assigned' then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  if p_accept and a.starts_at<=clock_timestamp() then raise exception 'APPOINTMENT_EXPIRED'; end if;
  update professional_service.appointments set status=case when p_accept then 'confirmed' else 'canceled' end,updated_at=clock_timestamp()
    where id=a.id returning * into a;
  if p_accept then update professional_service.support_requests set status='scheduled',updated_at=clock_timestamp() where id=r.id; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,case when p_accept then 'appointment.confirmed' else 'appointment.declined' end);
  return a;
end $$;

create or replace function professional_service.cancel_appointment(p_appointment_id uuid,p_actor uuid)
returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; a professional_service.appointments; request_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select ap.request_id into request_id from professional_service.appointments ap where ap.id=p_appointment_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  select * into r from professional_service.support_requests where id=request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_actor is distinct from r.user_id and (p_actor is distinct from r.assigned_to
    or not professional_service.current_clinician(r.organization_id,p_actor)) then raise exception 'REQUEST_NOT_FOUND'; end if;
  select * into a from professional_service.appointments where id=p_appointment_id for update;
  if a.status='canceled' then return a; end if;
  if a.status not in ('proposed','confirmed') then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  update professional_service.appointments set status='canceled',updated_at=clock_timestamp() where id=a.id returning * into a;
  if r.status='scheduled' then update professional_service.support_requests set status='assigned',updated_at=clock_timestamp() where id=r.id; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,'appointment.canceled');
  return a;
end $$;

create function professional_service.reschedule_appointment(
  p_appointment_id uuid,p_actor uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_mode text,p_location_hint_encrypted text
) returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; a professional_service.appointments; replacement professional_service.appointments; request_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select ap.request_id into request_id from professional_service.appointments ap where ap.id=p_appointment_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  select * into r from professional_service.support_requests where id=request_id for update;
  if not found or r.assigned_to is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  select * into a from professional_service.appointments where id=p_appointment_id for update;
  if a.professional_user_id is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  select * into replacement from professional_service.appointments where replaces_appointment_id=a.id;
  if found then
    if replacement.starts_at is distinct from p_starts_at or replacement.ends_at is distinct from p_ends_at or replacement.mode is distinct from p_mode then raise exception 'APPOINTMENT_CONFLICT'; end if;
    -- The service also checks encrypted meeting details on a replay.
    return replacement;
  end if;
  if a.status not in ('proposed','confirmed') or r.status not in ('assigned','scheduled') then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtext(p_actor::text));
  perform professional_service.cancel_appointment(a.id,p_actor);
  select * into replacement from professional_service.propose_appointment(r.id,p_actor,p_starts_at,p_ends_at,p_mode,p_location_hint_encrypted);
  update professional_service.appointments set replaces_appointment_id=a.id where id=replacement.id returning * into replacement;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,'appointment.rescheduled');
  return replacement;
end $$;
revoke all on function professional_service.reschedule_appointment(uuid,uuid,timestamptz,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function professional_service.reschedule_appointment(uuid,uuid,timestamptz,timestamptz,text,text) to service_role;
-- CREATE OR REPLACE retains existing service-only grants for the other RPCs.
