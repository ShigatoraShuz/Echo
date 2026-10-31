-- BE-009 local proposal. Never apply remotely without owner approval.
-- Additive RPCs; existing states and claim/assignment behavior remain intact.
-- Owner withdrawal uses closed + no assignee, and revokes further sharing.
create function professional_service.update_own_request(
  p_request_id uuid, p_actor uuid, p_summary_encrypted text, p_preferred_time_encrypted text
) returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare result professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into result from professional_service.support_requests
    where id=p_request_id and user_id=p_actor for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if result.status <> 'submitted' or result.assigned_to is not null then raise exception 'REQUEST_NOT_EDITABLE'; end if;
  if not exists(select 1 from professional_service.organizations where id=result.organization_id and status='active')
    or not exists(select 1 from user_service.profiles where user_id=p_actor and account_status='active'
      and eligible_18_plus=true and onboarding_completed=true) then raise exception 'REQUEST_NOT_EDITABLE'; end if;
  if result.sharing_revoked_at is not null or result.sharing_expires_at <= now() then raise exception 'SHARING_UNAVAILABLE'; end if;
  if p_summary_encrypted is null or p_summary_encrypted not like 'echo:encrypted:v1:%' or char_length(p_summary_encrypted)>30000
    or p_preferred_time_encrypted is null or p_preferred_time_encrypted not like 'echo:encrypted:v1:%' or char_length(p_preferred_time_encrypted)>5000
    then raise exception 'REQUEST_INVALID'; end if;
  update professional_service.support_requests set summary_encrypted=p_summary_encrypted,
    preferred_time_encrypted=p_preferred_time_encrypted,updated_at=now() where id=result.id returning * into result;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(result.organization_id,result.id,p_actor,'request.updated');
  return result;
end $$;

create function professional_service.withdraw_own_request(p_request_id uuid,p_actor uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare result professional_service.support_requests;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into result from professional_service.support_requests
    where id=p_request_id and user_id=p_actor for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- Retrying an acknowledged or uncertain withdrawal is safe and adds no audit duplicate.
  if result.status='closed' and result.assigned_to is null and exists (
    select 1 from professional_service.audit_events where request_id=result.id
      and action='request.withdrawn' and actor_user_id=p_actor
  ) then return result; end if;
  if result.status <> 'submitted' or result.assigned_to is not null then raise exception 'REQUEST_NOT_EDITABLE'; end if;
  update professional_service.support_requests set status='closed',
    sharing_revoked_at=coalesce(sharing_revoked_at,now()),updated_at=now()
    where id=result.id returning * into result;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(result.organization_id,result.id,p_actor,'request.withdrawn');
  return result;
end $$;

revoke all on function professional_service.update_own_request(uuid,uuid,text,text),
  professional_service.withdraw_own_request(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function professional_service.update_own_request(uuid,uuid,text,text),
  professional_service.withdraw_own_request(uuid,uuid) to service_role;
