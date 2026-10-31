-- BE-005: local proposal. Apply only through the project owner's approved release process.
-- Reuses verification_service.verification_admins and the backend encryption envelope.
-- Evidence is an encrypted reference for manual verification, never a public URL/upload.
create table professional_service.credential_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references professional_service.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('counselor','psychologist','social_worker')),
  credential_label text not null check (char_length(btrim(credential_label)) between 2 and 160),
  expires_at date not null,
  evidence_reference_encrypted text not null check (
    evidence_reference_encrypted like 'echo:encrypted:v1:%' and char_length(evidence_reference_encrypted) <= 20000
  ),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reason_code text check (reason_code in ('invalid_evidence','expired_credential','unable_to_verify')),
  constraint credential_review_decision check (
    (status='pending' and reviewed_at is null and reviewed_by is null and reason_code is null) or
    (status='approved' and reviewed_at is not null and reviewed_by is not null and reason_code is null) or
    (status='rejected' and reviewed_at is not null and reviewed_by is not null and reason_code is not null)
  ),
  constraint credential_no_self_review check (reviewed_by is null or reviewed_by <> user_id)
);
create index credential_reviews_owner_idx on professional_service.credential_reviews(user_id,submitted_at desc);
create index credential_reviews_queue_idx on professional_service.credential_reviews(organization_id,status,submitted_at);
alter table professional_service.credential_reviews enable row level security;
revoke all on professional_service.credential_reviews from public, anon, authenticated, service_role;
grant select on professional_service.credential_reviews to service_role;
alter table professional_service.audit_events
  add column credential_review_id uuid references professional_service.credential_reviews(id);

alter table professional_service.memberships
  add column approved_credential_id uuid references professional_service.credential_reviews(id);

-- Do not manufacture evidence or silently grandfather undocumented clinical approval.
-- This is a deliberate release impact: previously active practitioners need review
-- and explicit membership reapproval. Historical approver/expiry metadata is retained.
update professional_service.memberships set status='pending',updated_at=now()
  where status='active' and role in ('counselor','psychologist','social_worker');

create function professional_service.submit_credential(
  p_organization_id uuid,p_actor uuid,p_role text,p_label text,p_expires_at date,p_evidence_encrypted text
) returns professional_service.credential_reviews language plpgsql security definer
set search_path = professional_service, public as $$
declare result professional_service.credential_reviews;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if not exists(select 1 from professional_service.organizations where id=p_organization_id and status='active')
    then raise exception 'CREDENTIAL_UNAVAILABLE'; end if;
  if not exists(select 1 from user_service.profiles where user_id=p_actor and account_status='active'
    and eligible_18_plus=true and onboarding_completed=true) then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
  if p_role is null or p_role not in ('counselor','psychologist','social_worker') or p_label is null
    or char_length(btrim(p_label)) not between 2 and 160 or p_expires_at is null
    or p_expires_at < current_date or p_evidence_encrypted is null
    or p_evidence_encrypted not like 'echo:encrypted:v1:%' or char_length(p_evidence_encrypted)>20000
    then raise exception 'CREDENTIAL_INVALID'; end if;
  insert into professional_service.credential_reviews(organization_id,user_id,role,credential_label,expires_at,evidence_reference_encrypted)
    values(p_organization_id,p_actor,p_role,btrim(p_label),p_expires_at,p_evidence_encrypted) returning * into result;
  insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,credential_review_id,action)
    values(p_organization_id,p_actor,p_actor,result.id,'credential.submitted');
  return result;
end $$;

create function professional_service.read_credential_for_review(p_organization_id uuid,p_credential_id uuid,p_actor uuid)
returns professional_service.credential_reviews language plpgsql security definer
set search_path = professional_service, public as $$
declare result professional_service.credential_reviews;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if not exists(select 1 from verification_service.verification_admins where user_id=p_actor and is_active=true)
    then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
  select * into result from professional_service.credential_reviews
    where id=p_credential_id and organization_id=p_organization_id;
  if not found then raise exception 'CREDENTIAL_UNAVAILABLE'; end if;
  -- Audit failure prevents evidence delivery.
  insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,credential_review_id,action)
    values(result.organization_id,p_actor,result.user_id,result.id,'credential.evidence_viewed');
  return result;
end $$;

create function professional_service.review_credential(
  p_organization_id uuid,p_credential_id uuid,p_actor uuid,p_decision text,p_reason_code text
) returns professional_service.credential_reviews language plpgsql security definer
set search_path = professional_service, public as $$
declare result professional_service.credential_reviews;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if not exists(select 1 from verification_service.verification_admins where user_id=p_actor and is_active=true)
    then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
  select * into result from professional_service.credential_reviews
    where id=p_credential_id and organization_id=p_organization_id for update;
  if not found then raise exception 'CREDENTIAL_UNAVAILABLE'; end if;
  if result.user_id=p_actor then raise exception 'CREDENTIAL_SELF_REVIEW'; end if;
  if result.status<>'pending' then raise exception 'CREDENTIAL_ALREADY_REVIEWED'; end if;
  if p_decision is null or p_decision not in ('approved','rejected')
    or (p_decision='approved' and p_reason_code is not null)
    or (p_decision='rejected' and (p_reason_code is null or p_reason_code not in ('invalid_evidence','expired_credential','unable_to_verify')))
    then raise exception 'CREDENTIAL_INVALID'; end if;
  if p_decision='approved' then
    if result.expires_at < current_date then raise exception 'CREDENTIAL_EXPIRED'; end if;
    if not exists(select 1 from professional_service.organizations where id=result.organization_id and status='active')
      or not exists(select 1 from user_service.profiles where user_id=result.user_id and account_status='active'
        and eligible_18_plus=true and onboarding_completed=true)
      then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
  end if;
  update professional_service.credential_reviews set status=p_decision,reviewed_at=now(),reviewed_by=p_actor,reason_code=p_reason_code
    where id=result.id returning * into result;
  insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,credential_review_id,action)
    values(result.organization_id,p_actor,result.user_id,result.id,'credential.'||p_decision);
  return result;
end $$;

create function professional_service.require_approved_credential() returns trigger language plpgsql security definer
set search_path = professional_service, public as $$
begin
  if new.status='active' then
    -- Reuse the existing application-admin authority, not an org_admin role.
    if new.approved_by is null or new.approved_by=new.user_id
      or not exists(select 1 from verification_service.verification_admins where user_id=new.approved_by and is_active=true)
      then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
    if not exists(select 1 from professional_service.organizations where id=new.organization_id and status='active')
      or not exists(select 1 from user_service.profiles where user_id=new.user_id and account_status='active'
        and eligible_18_plus=true and onboarding_completed=true)
      then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
    if new.role in ('counselor','psychologist','social_worker') and not exists (
      select 1 from professional_service.credential_reviews c where c.id=new.approved_credential_id
        and c.organization_id=new.organization_id and c.user_id=new.user_id and c.role=new.role
        and c.status='approved' and c.reviewed_by<>new.user_id and c.expires_at>=current_date
        and c.expires_at=new.credential_expires_at and c.credential_label=new.credential_label
    ) then raise exception 'CREDENTIAL_APPROVAL_REQUIRED'; end if;
  end if;
  return new;
end $$;
create trigger professional_membership_credential before insert or update on professional_service.memberships
  for each row execute function professional_service.require_approved_credential();

revoke all on function professional_service.submit_credential(uuid,uuid,text,text,date,text),
  professional_service.read_credential_for_review(uuid,uuid,uuid),
  professional_service.review_credential(uuid,uuid,uuid,text,text),
  professional_service.require_approved_credential() from public,anon,authenticated,service_role;
grant execute on function professional_service.submit_credential(uuid,uuid,text,text,date,text),
  professional_service.read_credential_for_review(uuid,uuid,uuid),
  professional_service.review_credential(uuid,uuid,uuid,text,text) to service_role;
