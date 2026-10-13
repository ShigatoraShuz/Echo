-- User-side professional support workspace. Browser roles remain denied; the
-- backend service role is the only data path for this sensitive domain.
alter table professional_service.organizations
  add column location_label text not null default '',
  add column service_types text[] not null default '{}',
  add column consultation_methods text[] not null default '{}',
  add column accepting_requests boolean not null default true;

create table professional_service.practitioner_profiles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references professional_service.memberships(id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 1200),
  specialties text[] not null default '{}',
  service_types text[] not null default '{}',
  consultation_methods text[] not null default '{}',
  location_label text not null default '' check (char_length(location_label) <= 160),
  response_hours text not null default '' check (char_length(response_hours) <= 240),
  accepting_requests boolean not null default true,
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into professional_service.practitioner_profiles(membership_id)
select id from professional_service.memberships
where status='active' and role in ('counselor','psychologist','social_worker')
on conflict (membership_id) do nothing;
create index practitioner_profiles_specialties_gin on professional_service.practitioner_profiles using gin(specialties);
create index practitioner_profiles_service_types_gin on professional_service.practitioner_profiles using gin(service_types);

create function professional_service.sync_practitioner_profile() returns trigger language plpgsql security definer
set search_path=professional_service,public as $$
begin
  if new.status='active' and new.role in ('counselor','psychologist','social_worker') then
    insert into professional_service.practitioner_profiles(membership_id,discoverable,accepting_requests)
      values(new.id,true,true)
      on conflict (membership_id) do update set discoverable=true,accepting_requests=true,updated_at=now();
  elsif tg_op='UPDATE' then
    if new.status is distinct from old.status or new.role is distinct from old.role then
      update professional_service.practitioner_profiles
        set discoverable=false,accepting_requests=false,updated_at=now() where membership_id=new.id;
    end if;
  end if;
  return new;
end $$;
create trigger professional_membership_profile_sync after insert or update of status,role
  on professional_service.memberships for each row execute function professional_service.sync_practitioner_profile();

alter table professional_service.support_requests
  add column submission_id uuid,
  add column preferred_profile_id uuid references professional_service.practitioner_profiles(id);
create unique index support_requests_submission_idx
  on professional_service.support_requests(user_id,submission_id) where submission_id is not null;
create index support_requests_owner_status_idx
  on professional_service.support_requests(user_id,status,updated_at desc);
alter table professional_service.support_requests drop constraint support_requests_status_check;
alter table professional_service.support_requests add constraint support_requests_status_check
  check (status in ('submitted','assigned','scheduled','closed','declined','withdrawn'));

create table professional_service.case_shared_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('journal','phq8')),
  source_record_id uuid not null,
  label_encrypted text not null check (label_encrypted like 'echo:encrypted:v1:%'),
  payload_encrypted text not null check (payload_encrypted like 'echo:encrypted:v1:%'),
  purpose text not null default 'professional_support',
  consent_version text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  constraint shared_record_expiry check (expires_at > granted_at)
);
create unique index case_shared_records_active_source_idx
  on professional_service.case_shared_records(request_id,resource_type,source_record_id)
  where revoked_at is null;
create index case_shared_records_access_idx
  on professional_service.case_shared_records(request_id,revoked_at,expires_at);

insert into professional_service.case_shared_records(
  request_id,owner_user_id,resource_type,source_record_id,label_encrypted,payload_encrypted,
  consent_version,granted_at,expires_at,revoked_at
)
select j.request_id,r.user_id,'journal',j.journal_id,j.title_encrypted,j.body_encrypted,
  r.consent_version,r.consented_at,r.sharing_expires_at,r.sharing_revoked_at
from professional_service.shared_journals j
join professional_service.support_requests r on r.id=j.request_id
on conflict do nothing;

create table professional_service.case_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null check (char_length(event_type) between 2 and 80),
  label text not null check (char_length(label) between 2 and 160),
  created_at timestamptz not null default now()
);
create index case_events_timeline_idx on professional_service.case_events(request_id,created_at desc,id);

insert into professional_service.case_events(request_id,actor_user_id,event_type,label,created_at)
select id,user_id,'request_submitted','Support request submitted',created_at
from professional_service.support_requests;

create table professional_service.case_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id),
  sender_kind text not null check (sender_kind in ('user','professional')),
  body_encrypted text not null check (body_encrypted like 'echo:encrypted:v1:%'),
  client_message_id uuid not null,
  created_at timestamptz not null default now(),
  unique(sender_user_id,client_message_id)
);
create index case_messages_page_idx on professional_service.case_messages(request_id,created_at desc,id desc);

create table professional_service.case_message_read_state (
  request_id uuid not null references professional_service.support_requests(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(request_id,participant_user_id)
);

alter table professional_service.appointments drop constraint appointments_status_check;
alter table professional_service.appointments add constraint appointments_status_check
  check (status in ('proposed','confirmed','declined','canceled','completed'));

create table professional_service.appointment_change_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references professional_service.appointments(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id),
  preferred_time_encrypted text not null check (preferred_time_encrypted like 'echo:encrypted:v1:%'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index appointment_change_one_pending_idx
  on professional_service.appointment_change_requests(appointment_id) where status='pending';

alter table professional_service.practitioner_profiles enable row level security;
alter table professional_service.case_shared_records enable row level security;
alter table professional_service.case_events enable row level security;
alter table professional_service.case_messages enable row level security;
alter table professional_service.case_message_read_state enable row level security;
alter table professional_service.appointment_change_requests enable row level security;

revoke all on professional_service.practitioner_profiles,professional_service.case_shared_records,
  professional_service.case_events,professional_service.case_messages,
  professional_service.case_message_read_state,professional_service.appointment_change_requests
  from public,anon,authenticated;
revoke all on function professional_service.sync_practitioner_profile() from public,anon,authenticated;
grant select,insert,update on professional_service.practitioner_profiles,
  professional_service.case_shared_records,professional_service.case_events,
  professional_service.case_messages,professional_service.case_message_read_state,
  professional_service.appointment_change_requests to service_role;
grant update on professional_service.support_requests,professional_service.appointments to service_role;

create or replace function professional_service.revoke_sharing(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path=professional_service,public as $$
declare row professional_service.support_requests;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.support_requests set sharing_revoked_at=coalesce(sharing_revoked_at,now()),updated_at=now()
    where id=p_request_id and user_id=p_actor returning * into row;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  update professional_service.case_shared_records set revoked_at=coalesce(revoked_at,now()),revoked_by=p_actor
    where request_id=row.id and revoked_at is null;
  insert into professional_service.case_events(request_id,actor_user_id,event_type,label)
    values(row.id,p_actor,'sharing_revoked','All future sharing stopped');
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'sharing.revoked');
  return row;
end $$;

create or replace function professional_service.respond_appointment(p_appointment_id uuid,p_actor uuid,p_accept boolean)
returns professional_service.appointments language plpgsql security definer
set search_path=professional_service,public as $$
declare request professional_service.support_requests; appointment professional_service.appointments;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into appointment from professional_service.appointments where id=p_appointment_id for update;
  if not found or appointment.status<>'proposed' then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  select * into request from professional_service.support_requests where id=appointment.request_id for update;
  if request.user_id<>p_actor or request.status<>'assigned' or request.assigned_to<>appointment.professional_user_id
    then raise exception 'REQUEST_NOT_FOUND'; end if;
  update professional_service.appointments set status=case when p_accept then 'confirmed' else 'declined' end,updated_at=now()
    where id=p_appointment_id returning * into appointment;
  if p_accept then update professional_service.support_requests set status='scheduled',updated_at=now() where id=request.id; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(request.organization_id,request.id,p_actor,case when p_accept then 'appointment.confirmed' else 'appointment.declined' end);
  return appointment;
end $$;

create function professional_service.complete_appointment(p_appointment_id uuid,p_actor uuid)
returns professional_service.appointments language plpgsql security definer
set search_path=professional_service,public as $$
declare request professional_service.support_requests; appointment professional_service.appointments;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into appointment from professional_service.appointments where id=p_appointment_id for update;
  if not found or appointment.status<>'confirmed' then raise exception 'APPOINTMENT_UNAVAILABLE'; end if;
  select * into request from professional_service.support_requests where id=appointment.request_id for update;
  if request.assigned_to<>p_actor or not exists(select 1 from professional_service.memberships m
    where m.user_id=p_actor and m.organization_id=request.organization_id and m.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at>=current_date)
    then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  update professional_service.appointments set status='completed',updated_at=now()
    where id=p_appointment_id returning * into appointment;
  update professional_service.support_requests set status='assigned',updated_at=now() where id=request.id and status='scheduled';
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(request.organization_id,request.id,p_actor,'appointment.completed');
  return appointment;
end $$;

create function professional_service.create_request_v2(
  p_submission_id uuid,p_organization_id uuid,p_user_id uuid,p_preferred_profile_id uuid,
  p_summary_encrypted text,p_preferred_time_encrypted text,p_consent_version text,p_shared_items jsonb
) returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service,public as $$
declare row professional_service.support_requests; item jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into row from professional_service.support_requests
    where user_id=p_user_id and submission_id=p_submission_id;
  if found then return row; end if;
  if not exists(select 1 from professional_service.organizations
    where id=p_organization_id and status='active' and accepting_requests)
    then raise exception 'ORGANIZATION_UNAVAILABLE'; end if;
  if not exists(select 1 from user_service.profiles where user_id=p_user_id and account_status='active'
    and eligible_18_plus=true and onboarding_completed=true)
    then raise exception 'USER_NOT_ELIGIBLE'; end if;
  if p_preferred_profile_id is not null and not exists(
    select 1 from professional_service.practitioner_profiles p
    join professional_service.memberships m on m.id=p.membership_id
    where p.id=p_preferred_profile_id and m.organization_id=p_organization_id
      and p.discoverable and p.accepting_requests and m.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at>=current_date
  ) then raise exception 'PRACTITIONER_UNAVAILABLE'; end if;
  if p_summary_encrypted not like 'echo:encrypted:v1:%'
    or p_preferred_time_encrypted not like 'echo:encrypted:v1:%'
    or p_consent_version<>'professional-request-v2' or jsonb_typeof(p_shared_items)<>'array'
    or jsonb_array_length(p_shared_items)>6 then raise exception 'INVALID_REQUEST'; end if;
  insert into professional_service.support_requests(
    submission_id,organization_id,user_id,preferred_profile_id,summary_encrypted,
    preferred_time_encrypted,shared_journal_ids,consent_version
  ) values(
    p_submission_id,p_organization_id,p_user_id,p_preferred_profile_id,p_summary_encrypted,
    p_preferred_time_encrypted,array(select (value->>'sourceRecordId')::uuid
      from jsonb_array_elements(p_shared_items) where value->>'resourceType'='journal'),p_consent_version
  ) returning * into row;
  for item in select value from jsonb_array_elements(p_shared_items) loop
    if item->>'resourceType' not in ('journal','phq8')
      or item->>'labelEncrypted' not like 'echo:encrypted:v1:%'
      or item->>'payloadEncrypted' not like 'echo:encrypted:v1:%'
      then raise exception 'INVALID_SHARED_ITEM'; end if;
    insert into professional_service.case_shared_records(
      request_id,owner_user_id,resource_type,source_record_id,label_encrypted,payload_encrypted,consent_version
    ) values(
      row.id,p_user_id,item->>'resourceType',(item->>'sourceRecordId')::uuid,
      item->>'labelEncrypted',item->>'payloadEncrypted',p_consent_version
    );
  end loop;
  insert into professional_service.case_events(request_id,actor_user_id,event_type,label)
    values(row.id,p_user_id,'request_submitted','Support request submitted');
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_user_id,'request.created');
  return row;
end $$;

create function professional_service.withdraw_request(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service,public as $$
declare row professional_service.support_requests;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.support_requests set status='withdrawn',sharing_revoked_at=coalesce(sharing_revoked_at,now()),updated_at=now()
    where id=p_request_id and user_id=p_actor and status in ('submitted','assigned','scheduled') returning * into row;
  if not found then raise exception 'CASE_NOT_ACTIVE'; end if;
  update professional_service.appointments set status='canceled',updated_at=now()
    where request_id=row.id and status in ('proposed','confirmed');
  update professional_service.case_shared_records set revoked_at=coalesce(revoked_at,now()),revoked_by=p_actor
    where request_id=row.id and revoked_at is null;
  insert into professional_service.case_events(request_id,actor_user_id,event_type,label)
    values(row.id,p_actor,'request_withdrawn','Support request withdrawn');
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(row.organization_id,row.id,p_actor,'request.withdrawn');
  return row;
end $$;

create function professional_service.send_case_message(
  p_request_id uuid,p_actor uuid,p_client_message_id uuid,p_body_encrypted text
) returns professional_service.case_messages language plpgsql security definer
set search_path = professional_service,public as $$
declare request professional_service.support_requests; message professional_service.case_messages; kind text;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into message from professional_service.case_messages
    where sender_user_id=p_actor and client_message_id=p_client_message_id;
  if found then return message; end if;
  select * into request from professional_service.support_requests where id=p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if request.status not in ('assigned','scheduled') then raise exception 'MESSAGE_NOT_ALLOWED'; end if;
  if request.user_id=p_actor then kind:='user';
  elsif request.assigned_to=p_actor and exists(
    select 1 from professional_service.memberships m join professional_service.organizations o on o.id=m.organization_id
    where m.user_id=p_actor and m.organization_id=request.organization_id and m.status='active' and o.status='active'
      and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at>=current_date
  ) then kind:='professional'; else raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_body_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_MESSAGE'; end if;
  insert into professional_service.case_messages(request_id,sender_user_id,sender_kind,body_encrypted,client_message_id)
    values(p_request_id,p_actor,kind,p_body_encrypted,p_client_message_id) returning * into message;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(request.organization_id,request.id,p_actor,'message.sent');
  return message;
end $$;

create function professional_service.revoke_shared_record(p_share_id uuid,p_actor uuid)
returns professional_service.case_shared_records language plpgsql security definer
set search_path = professional_service,public as $$
declare shared professional_service.case_shared_records; request professional_service.support_requests;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update professional_service.case_shared_records set revoked_at=coalesce(revoked_at,now()),revoked_by=p_actor
    where id=p_share_id and owner_user_id=p_actor returning * into shared;
  if not found then raise exception 'SHARING_NOT_FOUND'; end if;
  select * into request from professional_service.support_requests where id=shared.request_id;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(request.organization_id,request.id,p_actor,'sharing.record_revoked');
  return shared;
end $$;

create function professional_service.assign_request(p_request_id uuid,p_actor uuid,p_profile_id uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path=professional_service,public as $$
declare request professional_service.support_requests; assignee professional_service.memberships;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into request from professional_service.support_requests where id=p_request_id for update;
  if not found or request.status not in ('submitted','assigned','scheduled') then raise exception 'CASE_NOT_ACTIVE'; end if;
  if not exists(select 1 from professional_service.memberships m join professional_service.organizations o on o.id=m.organization_id
    where m.user_id=p_actor and m.organization_id=request.organization_id and m.status='active' and o.status='active'
      and m.role in ('coordinator','org_admin')) then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  select m.* into assignee from professional_service.practitioner_profiles p
    join professional_service.memberships m on m.id=p.membership_id
    where p.id=p_profile_id and m.organization_id=request.organization_id and m.status='active'
      and p.discoverable and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at>=current_date;
  if not found then raise exception 'PRACTITIONER_UNAVAILABLE'; end if;
  update professional_service.support_requests set assigned_to=assignee.user_id,status='assigned',updated_at=now()
    where id=request.id returning * into request;
  update professional_service.appointments set status='canceled',updated_at=now()
    where request_id=request.id and status in ('proposed','confirmed') and professional_user_id<>assignee.user_id;
  insert into professional_service.case_events(request_id,actor_user_id,event_type,label)
    values(request.id,p_actor,'practitioner_assigned','Practitioner assigned');
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,subject_user_id,action)
    values(request.organization_id,request.id,p_actor,assignee.user_id,'request.assigned');
  return request;
end $$;

revoke all on function professional_service.create_request_v2(uuid,uuid,uuid,uuid,text,text,text,jsonb),
  professional_service.withdraw_request(uuid,uuid),
  professional_service.send_case_message(uuid,uuid,uuid,text),
  professional_service.revoke_shared_record(uuid,uuid),
  professional_service.assign_request(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function professional_service.create_request_v2(uuid,uuid,uuid,uuid,text,text,text,jsonb),
  professional_service.withdraw_request(uuid,uuid),
  professional_service.send_case_message(uuid,uuid,uuid,text),
  professional_service.revoke_shared_record(uuid,uuid),
  professional_service.assign_request(uuid,uuid,uuid) to service_role;

revoke all on function professional_service.complete_appointment(uuid,uuid)
  from public,anon,authenticated;
grant execute on function professional_service.complete_appointment(uuid,uuid) to service_role;

create function professional_service.run_retention(p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path=professional_service,public as $$
declare eligible integer; removed integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select count(*) into eligible from professional_service.case_shared_records
    where expires_at<=now() or revoked_at is not null;
  if not p_dry_run then
    delete from professional_service.case_shared_records where expires_at<=now() or revoked_at is not null;
    get diagnostics removed=row_count;
  end if;
  return jsonb_build_object('dryRun',p_dry_run,'eligible',eligible,'removed',removed,'checkedAt',now());
end $$;
revoke all on function professional_service.run_retention(boolean) from public,anon,authenticated;
grant execute on function professional_service.run_retention(boolean) to service_role;
