-- BE-015: immutable selected-record grant and retry-safe owner revocation.
-- Local proposal only. No existing grants are renewed or expanded.
create function professional_service.preserve_consent() returns trigger language plpgsql
set search_path = professional_service, pg_catalog as $$
begin
  if new.shared_journal_ids is distinct from old.shared_journal_ids
    or new.consent_version is distinct from old.consent_version
    or new.consented_at is distinct from old.consented_at
    or new.sharing_expires_at is distinct from old.sharing_expires_at
    or (old.sharing_revoked_at is not null and new.sharing_revoked_at is distinct from old.sharing_revoked_at)
    then raise exception 'CONSENT_IMMUTABLE'; end if;
  return new;
end $$;
create trigger professional_consent_immutable before update on professional_service.support_requests
  for each row execute function professional_service.preserve_consent();
revoke all on function professional_service.preserve_consent() from public,anon,authenticated,service_role;

create or replace function professional_service.revoke_sharing(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into r from professional_service.support_requests where id=p_request_id and user_id=p_actor for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.sharing_revoked_at is not null then return r; end if;
  update professional_service.support_requests set sharing_revoked_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=r.id returning * into r;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,'sharing.revoked');
  return r;
end $$;

create or replace function professional_service.create_request(
  p_organization_id uuid,p_user_id uuid,p_summary_encrypted text,p_preferred_time_encrypted text,
  p_consent_version text,p_shared_items jsonb
) returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; item jsonb; selected uuid[];
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  perform 1 from professional_service.organizations where id=p_organization_id and status='active' for share;
  if not found then raise exception 'ORGANIZATION_UNAVAILABLE'; end if;
  perform 1 from user_service.profiles where user_id=p_user_id and account_status='active' and eligible_18_plus and onboarding_completed for share;
  if not found then raise exception 'USER_NOT_ELIGIBLE'; end if;
  if p_summary_encrypted is null or p_summary_encrypted not like 'echo:encrypted:v1:%'
    or p_preferred_time_encrypted is null or p_preferred_time_encrypted not like 'echo:encrypted:v1:%'
    or p_consent_version is distinct from 'professional-request-v1'
    or jsonb_typeof(p_shared_items) is distinct from 'array' then raise exception 'INVALID_REQUEST'; end if;
  if jsonb_array_length(p_shared_items)>3 then raise exception 'INVALID_SHARED_ITEM'; end if;
  for item in select value from jsonb_array_elements(p_shared_items) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'INVALID_SHARED_ITEM'; end if;
    if item->>'journalId' is null or item->>'journalId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or item->>'titleEncrypted' is null or item->>'titleEncrypted' not like 'echo:encrypted:v1:%'
      or item->>'bodyEncrypted' is null or item->>'bodyEncrypted' not like 'echo:encrypted:v1:%'
      or (item - 'journalId' - 'titleEncrypted' - 'bodyEncrypted') <> '{}'::jsonb
      then raise exception 'INVALID_SHARED_ITEM'; end if;
  end loop;
  selected := array(select (value->>'journalId')::uuid from jsonb_array_elements(p_shared_items));
  if cardinality(selected)<>(select count(distinct id) from unnest(selected) id) then raise exception 'INVALID_SHARED_ITEM'; end if;
  -- The existing JournalService resolves each selected original for the owner;
  -- the service-only RPC accepts only those encrypted snapshots, never analysis.
  insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,shared_journal_ids,consent_version)
    values(p_organization_id,p_user_id,p_summary_encrypted,p_preferred_time_encrypted,selected,p_consent_version) returning * into r;
  for item in select value from jsonb_array_elements(p_shared_items) loop
    insert into professional_service.shared_journals(request_id,journal_id,title_encrypted,body_encrypted)
      values(r.id,(item->>'journalId')::uuid,item->>'titleEncrypted',item->>'bodyEncrypted');
  end loop;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_user_id,'request.created');
  return r;
end $$;
revoke all on function professional_service.create_request(uuid,uuid,text,text,text,jsonb),professional_service.revoke_sharing(uuid,uuid) from public,anon,authenticated;
grant execute on function professional_service.create_request(uuid,uuid,text,text,text,jsonb),professional_service.revoke_sharing(uuid,uuid) to service_role;
