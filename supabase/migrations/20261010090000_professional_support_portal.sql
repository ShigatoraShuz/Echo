-- Professional support is separate from identity verification and private journaling.
-- Only the backend service role may read these tables; every API action checks the
-- authenticated actor, organization membership, assignment, and sharing state.
create schema if not exists professional_service;
revoke all on schema professional_service from public, anon, authenticated;
grant usage on schema professional_service to service_role;

create table professional_service.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 600),
  service_hours text not null default '' check (char_length(service_hours) <= 240),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_by uuid references auth.users(id),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_organization_verified check (status <> 'active' or verified_at is not null)
);

create table professional_service.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references professional_service.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('counselor','psychologist','social_worker','coordinator','org_admin')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  credential_label text,
  credential_expires_at date,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id),
  constraint active_member_reviewed check (status <> 'active' or approved_at is not null),
  constraint practitioner_credential_check check (
    status <> 'active' or role in ('coordinator','org_admin') or
    (credential_label is not null and credential_expires_at is not null)
  )
);

create table professional_service.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references professional_service.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_encrypted text not null check (summary_encrypted like 'echo:encrypted:v1:%'),
  preferred_time_encrypted text not null check (preferred_time_encrypted like 'echo:encrypted:v1:%'),
  shared_journal_ids uuid[] not null default '{}',
  consent_version text not null,
  consented_at timestamptz not null default now(),
  sharing_expires_at timestamptz not null default (now() + interval '30 days'),
  sharing_revoked_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted','assigned','scheduled','closed','declined')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint at_most_three_shared_journals check (coalesce(array_length(shared_journal_ids,1),0) <= 3)
);

create index support_requests_organization_queue_idx on professional_service.support_requests(organization_id,status,created_at desc);
create index support_requests_owner_idx on professional_service.support_requests(user_id,created_at desc);

create table professional_service.shared_journals (
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  journal_id uuid not null,
  title_encrypted text not null check (title_encrypted like 'echo:encrypted:v1:%'),
  body_encrypted text not null check (body_encrypted like 'echo:encrypted:v1:%'),
  primary key (request_id,journal_id)
);

create table professional_service.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('in_person','online','phone')),
  location_hint_encrypted text not null check (location_hint_encrypted like 'echo:encrypted:v1:%'),
  status text not null default 'proposed' check (status in ('proposed','confirmed','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '2 hours')
);
create unique index appointments_one_active_per_request_idx on professional_service.appointments(request_id)
  where status in ('proposed','confirmed');
create index appointments_professional_idx on professional_service.appointments(professional_user_id,starts_at)
  where status in ('proposed','confirmed');

create table professional_service.case_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body_encrypted text not null check (body_encrypted like 'echo:encrypted:v1:%'),
  created_at timestamptz not null default now()
);
create index case_notes_request_idx on professional_service.case_notes(request_id,created_at);

create table professional_service.referrals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  resource_name text not null check (char_length(btrim(resource_name)) between 2 and 160),
  resource_url text,
  created_at timestamptz not null default now()
);

create table professional_service.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references professional_service.organizations(id),
  request_id uuid references professional_service.support_requests(id),
  actor_user_id uuid not null references auth.users(id),
  subject_user_id uuid references auth.users(id),
  action text not null,
  created_at timestamptz not null default now()
);
create index professional_audit_request_idx on professional_service.audit_events(request_id,created_at);
create index professional_audit_organization_idx on professional_service.audit_events(organization_id,created_at desc);

create function professional_service.audit_admin_change() returns trigger language plpgsql security definer
set search_path = professional_service, public as $$
begin
  if tg_table_name='organizations' then
    if tg_op='INSERT' and new.created_by is not null then
      insert into professional_service.audit_events(organization_id,actor_user_id,action)
        values(new.id,new.created_by,'organization.created');
    elsif tg_op='UPDATE' and new.status is distinct from old.status and new.verified_by is not null then
      insert into professional_service.audit_events(organization_id,actor_user_id,action)
        values(new.id,new.verified_by,'organization.'||new.status);
    end if;
  elsif new.status='active' and new.approved_by is not null then
    insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,action)
      values(new.organization_id,new.approved_by,new.user_id,
        case when tg_op='INSERT' or new.status is distinct from old.status then 'membership.approved' else 'membership.updated' end);
  end if;
  return new;
end $$;
create trigger professional_org_audit after insert or update on professional_service.organizations
  for each row execute function professional_service.audit_admin_change();
create trigger professional_membership_audit after insert or update on professional_service.memberships
  for each row execute function professional_service.audit_admin_change();

create function professional_service.audit_case_insert() returns trigger language plpgsql security definer
set search_path = professional_service, public as $$
declare organization uuid;
begin
  select organization_id into organization from professional_service.support_requests where id=new.request_id;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(organization,new.request_id,new.author_user_id,case when tg_table_name='case_notes' then 'note.created' else 'referral.created' end);
  return new;
end $$;
create function professional_service.require_assigned_author() returns trigger language plpgsql security definer
set search_path = professional_service, public as $$
begin
  if not exists(select 1 from professional_service.support_requests r
    join professional_service.memberships m on m.organization_id=r.organization_id and m.user_id=new.author_user_id
    join professional_service.organizations o on o.id=r.organization_id
    where r.id=new.request_id and r.assigned_to=new.author_user_id and r.status in ('assigned','scheduled')
      and m.status='active' and m.role in ('counselor','psychologist','social_worker')
      and m.credential_expires_at >= current_date and o.status='active')
    then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  return new;
end $$;
create trigger professional_note_author before insert on professional_service.case_notes
  for each row execute function professional_service.require_assigned_author();
create trigger professional_referral_author before insert on professional_service.referrals
  for each row execute function professional_service.require_assigned_author();
create trigger professional_note_audit after insert on professional_service.case_notes
  for each row execute function professional_service.audit_case_insert();
create trigger professional_referral_audit after insert on professional_service.referrals
  for each row execute function professional_service.audit_case_insert();

alter table professional_service.organizations enable row level security;
alter table professional_service.memberships enable row level security;
alter table professional_service.support_requests enable row level security;
alter table professional_service.shared_journals enable row level security;
alter table professional_service.appointments enable row level security;
alter table professional_service.case_notes enable row level security;
alter table professional_service.referrals enable row level security;
alter table professional_service.audit_events enable row level security;

revoke all on all tables in schema professional_service from public, anon, authenticated;
grant select,insert,update on professional_service.organizations, professional_service.memberships to service_role;
grant select on professional_service.support_requests, professional_service.appointments,
  professional_service.shared_journals to service_role;
grant select,insert on professional_service.case_notes, professional_service.referrals to service_role;
grant select,insert on professional_service.audit_events to service_role;

create function professional_service.create_request(
  p_organization_id uuid,p_user_id uuid,p_summary_encrypted text,p_preferred_time_encrypted text,
  p_consent_version text,p_shared_items jsonb
) returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests; item jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if not exists(select 1 from professional_service.organizations where id=p_organization_id and status='active')
    then raise exception 'ORGANIZATION_UNAVAILABLE'; end if;
  if not exists(select 1 from user_service.profiles where user_id=p_user_id and account_status='active'
    and eligible_18_plus=true and onboarding_completed=true)
    then raise exception 'USER_NOT_ELIGIBLE'; end if;
  if p_summary_encrypted not like 'echo:encrypted:v1:%'
    or p_preferred_time_encrypted not like 'echo:encrypted:v1:%' or p_consent_version <> 'professional-request-v1'
    or jsonb_typeof(p_shared_items) <> 'array' or jsonb_array_length(p_shared_items) > 3
    then raise exception 'INVALID_REQUEST'; end if;
  insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,
    shared_journal_ids,consent_version)
  values(p_organization_id,p_user_id,p_summary_encrypted,p_preferred_time_encrypted,
    array(select (value->>'journalId')::uuid from jsonb_array_elements(p_shared_items)),p_consent_version)
  returning * into row;
  for item in select value from jsonb_array_elements(p_shared_items) loop
    if item->>'titleEncrypted' not like 'echo:encrypted:v1:%' or item->>'bodyEncrypted' not like 'echo:encrypted:v1:%'
      then raise exception 'INVALID_SHARED_ITEM'; end if;
    insert into professional_service.shared_journals(request_id,journal_id,title_encrypted,body_encrypted)
      values(row.id,(item->>'journalId')::uuid,item->>'titleEncrypted',item->>'bodyEncrypted');
  end loop;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_user_id,'request.created');
  return row;
end $$;

create function professional_service.claim_request(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into row from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if row.status <> 'submitted' or row.assigned_to is not null then raise exception 'REQUEST_ALREADY_ASSIGNED'; end if;
  if not exists (
    select 1 from professional_service.memberships m join professional_service.organizations o on o.id=m.organization_id
    where m.organization_id=row.organization_id and m.user_id=p_actor and m.status='active'
      and o.status='active' and m.role in ('counselor','psychologist','social_worker')
      and m.credential_expires_at >= current_date
  ) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  update professional_service.support_requests set assigned_to=p_actor,status='assigned',updated_at=now()
    where id=p_request_id returning * into row;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'request.claimed');
  return row;
end $$;

create function professional_service.revoke_sharing(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.support_requests set sharing_revoked_at=coalesce(sharing_revoked_at,now()),updated_at=now()
    where id=p_request_id and user_id=p_actor returning * into row;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'sharing.revoked');
  return row;
end $$;

create function professional_service.set_request_status(p_request_id uuid,p_actor uuid,p_status text)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_status not in ('closed','declined') then raise exception 'INVALID_STATUS'; end if;
  select * into row from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if row.assigned_to <> p_actor or row.status not in ('assigned','scheduled') then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if exists(select 1 from professional_service.appointments a where a.request_id=row.id
    and a.status in ('proposed','confirmed')) then raise exception 'APPOINTMENT_ACTIVE'; end if;
  if not exists(select 1 from professional_service.memberships m
    join professional_service.organizations o on o.id=m.organization_id
    where m.organization_id=row.organization_id and m.user_id=p_actor and m.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at >= current_date and o.status='active')
    then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  update professional_service.support_requests set status=p_status,updated_at=now()
    where id=p_request_id returning * into row;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'request.'||p_status);
  return row;
end $$;

create function professional_service.propose_appointment(
  p_request_id uuid,p_actor uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_mode text,p_location_hint_encrypted text
) returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests; appointment professional_service.appointments;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into row from professional_service.support_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if row.assigned_to <> p_actor or row.status <> 'assigned' then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  if not exists(select 1 from professional_service.memberships m
    join professional_service.organizations o on o.id=m.organization_id
    where m.organization_id=row.organization_id and m.user_id=p_actor and m.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at >= current_date and o.status='active')
    then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '2 hours'
    or p_mode not in ('in_person','online','phone') or p_location_hint_encrypted not like 'echo:encrypted:v1:%'
    then raise exception 'INVALID_APPOINTMENT'; end if;
  perform pg_advisory_xact_lock(hashtext(p_actor::text));
  if exists(select 1 from professional_service.appointments a where a.professional_user_id=p_actor
    and a.status in ('proposed','confirmed') and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)'))
    then raise exception 'APPOINTMENT_CONFLICT'; end if;
  insert into professional_service.appointments(request_id,professional_user_id,starts_at,ends_at,mode,location_hint_encrypted)
    values(p_request_id,p_actor,p_starts_at,p_ends_at,p_mode,p_location_hint_encrypted) returning * into appointment;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'appointment.proposed');
  return appointment;
end $$;

create function professional_service.respond_appointment(p_appointment_id uuid,p_actor uuid,p_accept boolean)
returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests; appointment professional_service.appointments;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into appointment from professional_service.appointments where id=p_appointment_id for update;
  if not found or appointment.status <> 'proposed' then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  select * into row from professional_service.support_requests where id=appointment.request_id for update;
  if row.user_id <> p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  if row.status <> 'assigned' or row.assigned_to <> appointment.professional_user_id
    or not exists(select 1 from professional_service.memberships m
      join professional_service.organizations o on o.id=m.organization_id
      where m.organization_id=row.organization_id and m.user_id=appointment.professional_user_id
        and m.status='active' and m.role in ('counselor','psychologist','social_worker')
        and m.credential_expires_at >= current_date and o.status='active')
    then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  update professional_service.appointments set status=case when p_accept then 'confirmed' else 'canceled' end,updated_at=now()
    where id=p_appointment_id returning * into appointment;
  if p_accept then update professional_service.support_requests set status='scheduled',updated_at=now() where id=row.id; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,case when p_accept then 'appointment.confirmed' else 'appointment.declined' end);
  return appointment;
end $$;

create function professional_service.cancel_appointment(p_appointment_id uuid,p_actor uuid)
returns professional_service.appointments language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.support_requests; appointment professional_service.appointments;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into appointment from professional_service.appointments where id=p_appointment_id for update;
  if not found or appointment.status not in ('proposed','confirmed') then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  select * into row from professional_service.support_requests where id=appointment.request_id for update;
  if p_actor <> row.user_id and (
    p_actor <> row.assigned_to or not exists(select 1 from professional_service.memberships m
      join professional_service.organizations o on o.id=m.organization_id
      where m.organization_id=row.organization_id and m.user_id=p_actor and m.status='active'
        and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at >= current_date and o.status='active')
  ) then raise exception 'REQUEST_NOT_FOUND'; end if;
  update professional_service.appointments set status='canceled',updated_at=now()
    where id=p_appointment_id returning * into appointment;
  if row.status='scheduled' then
    update professional_service.support_requests set status='assigned',updated_at=now() where id=row.id;
  end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'appointment.canceled');
  return appointment;
end $$;

create function professional_service.suspend_member(p_membership_id uuid,p_actor uuid)
returns professional_service.memberships language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.memberships;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.memberships set status='suspended',updated_at=now()
    where id=p_membership_id and status='active' returning * into row;
  if not found then raise exception 'MEMBERSHIP_UNAVAILABLE'; end if;
  insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,action)
    values(row.organization_id,p_actor,row.user_id,'membership.suspended');
  return row;
end $$;

create function professional_service.suspend_organization(p_organization_id uuid,p_actor uuid)
returns professional_service.organizations language plpgsql security definer
set search_path = professional_service, public as $$
declare row professional_service.organizations;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.organizations set status='suspended',verified_by=p_actor,updated_at=now()
    where id=p_organization_id and status='active' returning * into row;
  if not found then raise exception 'ORGANIZATION_UNAVAILABLE'; end if;
  update professional_service.memberships set status='suspended',updated_at=now()
    where organization_id=p_organization_id and status='active';
  insert into professional_service.audit_events(organization_id,actor_user_id,action)
    values(p_organization_id,p_actor,'organization.staff_suspended');
  return row;
end $$;

revoke all on all functions in schema professional_service from public, anon, authenticated;
revoke all on function professional_service.audit_case_insert() from public, anon, authenticated;
revoke all on function professional_service.require_assigned_author() from public, anon, authenticated;
revoke all on function professional_service.audit_admin_change() from public, anon, authenticated;
grant execute on function professional_service.create_request(uuid,uuid,text,text,text,jsonb),
  professional_service.claim_request(uuid,uuid),
  professional_service.revoke_sharing(uuid,uuid),professional_service.set_request_status(uuid,uuid,text),
  professional_service.propose_appointment(uuid,uuid,timestamptz,timestamptz,text,text),
  professional_service.respond_appointment(uuid,uuid,boolean),
  professional_service.cancel_appointment(uuid,uuid),
  professional_service.suspend_member(uuid,uuid),
  professional_service.suspend_organization(uuid,uuid) to service_role;
