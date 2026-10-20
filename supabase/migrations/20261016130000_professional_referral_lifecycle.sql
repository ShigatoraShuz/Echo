-- BE-023: internal referral records only. No external sending/acceptance is implied.
alter table professional_service.referrals
  add column status text not null default 'recorded' check(status in ('recorded','completed','canceled')),
  add column revision integer not null default 1 check(revision>0),
  add column submission_id uuid,
  add column updated_at timestamptz not null default clock_timestamp();
create unique index professional_referral_submission_idx on professional_service.referrals(request_id,author_user_id,submission_id) where submission_id is not null;
create index professional_referrals_case_idx on professional_service.referrals(request_id,created_at desc,id);
create table professional_service.referral_history (
  id uuid primary key default gen_random_uuid(), referral_id uuid not null references professional_service.referrals(id),
  actor_user_id uuid not null references auth.users(id), status text not null check(status in ('recorded','completed','canceled')),
  revision integer not null, created_at timestamptz not null default clock_timestamp(), unique(referral_id,revision)
);
alter table professional_service.referral_history enable row level security;
revoke all on professional_service.referral_history from public,anon,authenticated,service_role;
-- Existing owner/detail SELECT remains compatible; all new writes use authorized RPCs.
revoke insert on professional_service.referrals from service_role;

create function professional_service.record_referral(p_request_id uuid,p_actor uuid,p_name text,p_url text,p_submission_id uuid)
returns professional_service.referrals language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; f professional_service.referrals;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  if p_submission_id is null then raise exception 'INVALID_REFERRAL'; end if;
  select * into f from professional_service.referrals where request_id=r.id and author_user_id=p_actor and submission_id=p_submission_id;
  if found then
    if f.resource_name is distinct from p_name or f.resource_url is distinct from p_url then raise exception 'REFERRAL_CONFLICT'; end if;
    return f;
  end if;
  if r.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 160 or (p_url is not null and (p_url !~ '^https://[^/[:space:]]+' or char_length(p_url)>2048)) then raise exception 'INVALID_REFERRAL'; end if;
  insert into professional_service.referrals(request_id,author_user_id,resource_name,resource_url,submission_id)
    values(r.id,p_actor,p_name,p_url,p_submission_id) returning * into f;
  -- Existing insert trigger writes referral.created atomically.
  insert into professional_service.referral_history(referral_id,actor_user_id,status,revision) values(f.id,p_actor,'recorded',1);
  return f;
end $$;

create function professional_service.set_referral_status(p_request_id uuid,p_referral_id uuid,p_actor uuid,p_status text,p_expected_revision integer)
returns professional_service.referrals language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; f professional_service.referrals;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  if p_status is null or p_status not in ('completed','canceled') or p_expected_revision is null or p_expected_revision<1 then raise exception 'INVALID_REFERRAL'; end if;
  select * into f from professional_service.referrals where id=p_referral_id and request_id=r.id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if f.status=p_status and f.revision=p_expected_revision+1 then return f; end if;
  if f.status<>'recorded' or f.revision<>p_expected_revision then raise exception 'REFERRAL_CONFLICT'; end if;
  update professional_service.referrals set status=p_status,revision=revision+1,updated_at=clock_timestamp() where id=f.id returning * into f;
  insert into professional_service.referral_history(referral_id,actor_user_id,status,revision) values(f.id,p_actor,f.status,f.revision);
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) values(r.organization_id,r.id,p_actor,'referral.'||p_status);
  return f;
end $$;

create function professional_service.list_referrals(p_request_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; result jsonb;
begin
  select * into r from professional_service.require_case_actor(p_request_id,p_actor);
  select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',f.id,'resourceName',f.resource_name,'resourceUrl',f.resource_url,
    'status',f.status,'revision',f.revision,'createdAt',f.created_at,'updatedAt',f.updated_at,'delivery','not_integrated',
    'history',(select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'at',h.created_at,'revision',h.revision) order by h.revision),'[]'::jsonb) from professional_service.referral_history h where h.referral_id=f.id)
  ) order by f.created_at desc,f.id),'[]'::jsonb),'total',coalesce(max(f.total),0),'limit',100,'hasMore',coalesce(bool_or(f.total>100),false)) into result
  from (select *,count(*) over() total from professional_service.referrals where request_id=r.id order by created_at desc,id limit 100) f;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action) values(r.organization_id,r.id,p_actor,'referral.viewed');
  return result;
end $$;
revoke all on function professional_service.record_referral(uuid,uuid,text,text,uuid),professional_service.set_referral_status(uuid,uuid,uuid,text,integer),professional_service.list_referrals(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function professional_service.record_referral(uuid,uuid,text,text,uuid),professional_service.set_referral_status(uuid,uuid,uuid,text,integer),professional_service.list_referrals(uuid,uuid) to service_role;
