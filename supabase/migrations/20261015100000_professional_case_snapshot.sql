-- BE-014/015: local-only proposal, after the credential and lifecycle migrations.
-- A professional read and its audit commit together. Browser roles cannot execute.
create function professional_service.case_note_snapshot(p_request_id uuid,p_actor uuid)
returns jsonb language sql stable set search_path = professional_service, pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'body_encrypted',n.body_encrypted,'created_at',n.created_at)
    order by n.created_at desc,n.id),'[]'::jsonb) from professional_service.case_notes n where n.request_id=p_request_id
$$;
revoke all on function professional_service.case_note_snapshot(uuid,uuid) from public,anon,authenticated,service_role;

create function professional_service.case_snapshot(p_request_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; shared boolean; payload jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for share;
  if not found or r.assigned_to is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  perform 1 from professional_service.organizations where id=r.organization_id and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from user_service.profiles where user_id=p_actor and account_status='active' and eligible_18_plus and onboarding_completed for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from professional_service.memberships where organization_id=r.organization_id and user_id=p_actor and status='active' for share;
  if not found or not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  shared := r.sharing_revoked_at is null and r.sharing_expires_at>clock_timestamp();
  -- Explicit projections prevent future schema additions leaking into the API.
  select jsonb_build_object(
    'notesLifecycleAvailable',to_regprocedure('professional_service.edit_case_note(uuid,uuid,uuid,text,integer,boolean)') is not null,
    'closureReasonAvailable',to_regprocedure('professional_service.close_case(uuid,uuid,text)') is not null,
    'request',jsonb_build_object('id',r.id,'organization_id',r.organization_id,'assigned_to',r.assigned_to,
      'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,'shared_journal_ids',r.shared_journal_ids,
      'sharing_expires_at',r.sharing_expires_at,'sharing_revoked_at',r.sharing_revoked_at,
      'summary_encrypted',case when shared then r.summary_encrypted end,
      'preferred_time_encrypted',case when shared then r.preferred_time_encrypted end),
    'sharedJournals',case when shared then (select coalesce(jsonb_agg(jsonb_build_object('journal_id',j.journal_id,
      'title_encrypted',j.title_encrypted,'body_encrypted',j.body_encrypted) order by j.journal_id),'[]'::jsonb)
      from professional_service.shared_journals j where j.request_id=r.id and j.journal_id=any(r.shared_journal_ids)) else '[]'::jsonb end,
    'appointments',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,
      'mode',a.mode,'status',a.status,'location_hint_encrypted',a.location_hint_encrypted) order by a.created_at desc,a.id),'[]'::jsonb)
      from professional_service.appointments a where a.request_id=r.id),
    'notes',professional_service.case_note_snapshot(r.id,p_actor),
    'referrals',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'resource_name',f.resource_name,'resource_url',f.resource_url,
      'created_at',f.created_at) order by f.created_at desc,f.id),'[]'::jsonb) from professional_service.referrals f where f.request_id=r.id),
    'timeline',(select jsonb_build_object('events',coalesce(jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.created_at)
      order by e.created_at,e.id),'[]'::jsonb),'hasMore',coalesce(bool_or(e.total>200),false),'limit',200)
      from (select id,action,created_at,count(*) over() total from professional_service.audit_events
        where request_id=r.id and organization_id=r.organization_id and action in (
          'request.created','request.updated','request.withdrawn','request.claimed','request.closed','request.declined','request.transferred',
          'sharing.revoked','appointment.proposed','appointment.confirmed','appointment.declined','appointment.canceled','appointment.rescheduled',
          'note.created','note.finalized','referral.created') order by created_at desc,id desc limit 200) e)
  ) into payload;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,'case.opened');
  return payload;
end $$;
revoke all on function professional_service.case_snapshot(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function professional_service.case_snapshot(uuid,uuid) to service_role;
