-- BE-022 local proposal. Tasks are professional records, not new case states.
create table professional_service.follow_ups (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references professional_service.support_requests(id),
  organization_id uuid not null references professional_service.organizations(id),
  created_by uuid not null references auth.users(id), responsible_user_id uuid not null references auth.users(id),
  title_encrypted text not null check(title_encrypted like 'echo:encrypted:v1:%'), due_at timestamptz not null check(isfinite(due_at)),
  status text not null default 'pending' check(status in ('pending','completed')),
  revision integer not null default 1 check(revision>0), submission_id uuid not null,
  completed_at timestamptz, completed_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(request_id,created_by,submission_id),
  check((status='pending' and completed_at is null and completed_by is null) or (status='completed' and completed_at is not null and completed_by is not null))
);
create index professional_follow_ups_case_idx on professional_service.follow_ups(request_id,status,due_at,id);
create index professional_follow_ups_due_idx on professional_service.follow_ups(organization_id,responsible_user_id,due_at,id) where status='pending';
alter table professional_service.follow_ups enable row level security;
revoke all on professional_service.follow_ups from public,anon,authenticated,service_role;

create function professional_service.require_case_actor(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found or r.assigned_to is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  perform 1 from professional_service.organizations where id=r.organization_id and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from user_service.profiles where user_id=p_actor and account_status='active' and eligible_18_plus and onboarding_completed for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from professional_service.memberships where organization_id=r.organization_id and user_id=p_actor and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  return r;
end $$;
revoke all on function professional_service.require_case_actor(uuid,uuid) from public,anon,authenticated,service_role;

create function professional_service.case_follow_ups(p_request_id uuid)
returns jsonb language sql stable set search_path = professional_service, pg_catalog as $$
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(f)-'total'-'submission_id' order by f.status desc,f.due_at,f.id),'[]'::jsonb),
    'total',coalesce(max(f.total),0),'hasMore',coalesce(bool_or(f.total>100),false),'limit',100)
  from (select *,count(*) over() total from professional_service.follow_ups where request_id=p_request_id order by status desc,due_at,id limit 100) f
$$;
revoke all on function professional_service.case_follow_ups(uuid) from public,anon,authenticated,service_role;

create function professional_service.list_follow_ups(p_request_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; result jsonb;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  result := professional_service.case_follow_ups(r.id);
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) values(r.organization_id,r.id,p_actor,'followup.viewed');
  return result;
end $$;

create function professional_service.create_follow_up(p_request_id uuid,p_actor uuid,p_title_encrypted text,p_due_at timestamptz,p_submission_id uuid)
returns professional_service.follow_ups language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; f professional_service.follow_ups;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  if p_submission_id is null then raise exception 'INVALID_FOLLOW_UP'; end if;
  select * into f from professional_service.follow_ups where request_id=r.id and created_by=p_actor and submission_id=p_submission_id;
  if found then return f; end if;
  if r.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if p_due_at is null or not isfinite(p_due_at) or p_due_at<=clock_timestamp()
    or p_title_encrypted is null or p_title_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_FOLLOW_UP'; end if;
  insert into professional_service.follow_ups(request_id,organization_id,created_by,responsible_user_id,title_encrypted,due_at,submission_id)
    values(r.id,r.organization_id,p_actor,p_actor,p_title_encrypted,p_due_at,p_submission_id) returning * into f;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) values(r.organization_id,r.id,p_actor,'followup.created');
  return f;
end $$;

create function professional_service.update_follow_up(p_request_id uuid,p_follow_up_id uuid,p_actor uuid,p_expected_revision integer,p_complete boolean,p_title_encrypted text,p_due_at timestamptz)
returns professional_service.follow_ups language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; f professional_service.follow_ups;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  select * into f from professional_service.follow_ups where id=p_follow_up_id and request_id=r.id and organization_id=r.organization_id and responsible_user_id=p_actor for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_complete=true and f.status='completed' and f.completed_by=p_actor and f.revision=p_expected_revision+1 then return f; end if;
  if p_complete is null or p_expected_revision is null then raise exception 'INVALID_FOLLOW_UP'; end if;
  if f.status<>'pending' or f.revision<>p_expected_revision then raise exception 'FOLLOW_UP_CONFLICT'; end if;
  -- Completion is permitted after closure; new tasks/edits are not. No reopening.
  if not p_complete then
    if r.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
    if p_due_at is null or not isfinite(p_due_at) or p_due_at<=clock_timestamp()
      or p_title_encrypted is null or p_title_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_FOLLOW_UP'; end if;
  end if;
  update professional_service.follow_ups set title_encrypted=case when p_complete then title_encrypted else p_title_encrypted end,
    due_at=case when p_complete then due_at else p_due_at end,status=case when p_complete then 'completed' else 'pending' end,
    completed_at=case when p_complete then clock_timestamp() end,completed_by=case when p_complete then p_actor end,
    revision=revision+1,updated_at=clock_timestamp() where id=f.id returning * into f;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,case when p_complete then 'followup.completed' else 'followup.updated' end);
  return f;
end $$;

create function professional_service.transfer_follow_ups() returns trigger language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
begin
  if old.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
    update professional_service.follow_ups set responsible_user_id=new.assigned_to,revision=revision+1,updated_at=clock_timestamp()
      where request_id=new.id and status='pending';
    if found then insert into professional_service.audit_events(organization_id,request_id,actor_user_id,subject_user_id,action)
      values(new.organization_id,new.id,old.assigned_to,new.assigned_to,'followup.reassigned'); end if;
  end if;
  return new;
end $$;
create trigger professional_follow_up_transfer after update of assigned_to on professional_service.support_requests
  for each row execute function professional_service.transfer_follow_ups();
revoke all on function professional_service.transfer_follow_ups() from public,anon,authenticated,service_role;
revoke all on function professional_service.list_follow_ups(uuid,uuid),professional_service.create_follow_up(uuid,uuid,text,timestamptz,uuid),professional_service.update_follow_up(uuid,uuid,uuid,integer,boolean,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function professional_service.list_follow_ups(uuid,uuid),professional_service.create_follow_up(uuid,uuid,text,timestamptz,uuid),professional_service.update_follow_up(uuid,uuid,uuid,integer,boolean,text,timestamptz) to service_role;
