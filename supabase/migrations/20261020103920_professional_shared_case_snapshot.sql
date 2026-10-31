-- Integration bridge after the existing 18-migration Professional release.
-- No historical SQL is rewritten. Existing case/role/credential checks and audit
-- transaction remain; only explicit, unexpired user-granted snapshots are added.
create or replace function professional_service.case_snapshot(p_request_id uuid,p_actor uuid)
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
  -- Keep share revocations serialized with the audited case read.
  perform 1 from professional_service.case_shared_records where request_id=r.id for share;
  shared := r.sharing_revoked_at is null and r.sharing_expires_at>clock_timestamp();
  -- Explicit projections prevent future schema additions leaking into the API.
  select jsonb_build_object(
    'notesLifecycleAvailable',to_regprocedure('professional_service.edit_case_note(uuid,uuid,uuid,text,integer,boolean)') is not null,
    'closureReasonAvailable',to_regprocedure('professional_service.close_case(uuid,uuid,text)') is not null,
    'request',jsonb_build_object('id',r.id,'organization_id',r.organization_id,'assigned_to',r.assigned_to,
      'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,'shared_journal_ids',r.shared_journal_ids,
      'consent_version',r.consent_version,'preferred_profile_id',r.preferred_profile_id,
      'sharing_expires_at',r.sharing_expires_at,'sharing_revoked_at',r.sharing_revoked_at,
      'summary_encrypted',case when shared then r.summary_encrypted end,
      'preferred_time_encrypted',case when shared then r.preferred_time_encrypted end),
    'sharedJournals',case when shared and r.consent_version='professional-request-v1' then (select coalesce(jsonb_agg(jsonb_build_object('journal_id',j.journal_id,
      'title_encrypted',j.title_encrypted,'body_encrypted',j.body_encrypted) order by j.journal_id),'[]'::jsonb)
      from professional_service.shared_journals j where j.request_id=r.id and j.journal_id=any(r.shared_journal_ids)
        and not exists(select 1 from professional_service.case_shared_records c where c.request_id=r.id and c.resource_type='journal' and c.source_record_id=j.journal_id)) else '[]'::jsonb end,
    'sharedRecords',case when shared and r.status in ('assigned','scheduled') then (
      select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'resource_type',c.resource_type,'source_record_id',c.source_record_id,
        'label_encrypted',c.label_encrypted,'payload_encrypted',c.payload_encrypted,'expires_at',c.expires_at,'revoked_at',c.revoked_at)
        order by c.granted_at,c.id),'[]'::jsonb)
      from professional_service.case_shared_records c where c.request_id=r.id and c.owner_user_id=r.user_id
        and c.purpose='professional_support' and c.consent_version in ('professional-request-v1','professional-request-v2')
        and c.revoked_at is null and c.expires_at>clock_timestamp()
    ) else '[]'::jsonb end,
    'appointmentChangeRequests',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'appointment_id',c.appointment_id,
      'preferred_time_encrypted',c.preferred_time_encrypted,'status',c.status,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb)
      from professional_service.appointment_change_requests c join professional_service.appointments a on a.id=c.appointment_id where a.request_id=r.id),
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
revoke all on function professional_service.case_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function professional_service.case_snapshot(uuid,uuid) to service_role;

-- Administrative initial assignment must not race around clinical handover.
create or replace function professional_service.assign_request(p_request_id uuid,p_actor uuid,p_profile_id uuid)
returns professional_service.support_requests language plpgsql security definer
set search_path=professional_service,public as $$
declare request professional_service.support_requests; assignee professional_service.memberships;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into request from professional_service.support_requests where id=p_request_id for update;
  if not found or (request.status<>'submitted' or request.assigned_to is not null) then raise exception 'CASE_NOT_ACTIVE'; end if;
  if not exists(select 1 from professional_service.memberships m join professional_service.organizations o on o.id=m.organization_id
    where m.user_id=p_actor and m.organization_id=request.organization_id and m.status='active' and o.status='active'
      and m.role in ('coordinator','org_admin')) then raise exception 'ASSIGNMENT_REQUIRED'; end if;
  select m.* into assignee from professional_service.practitioner_profiles p
    join professional_service.memberships m on m.id=p.membership_id
    where p.id=p_profile_id and m.organization_id=request.organization_id and m.status='active'
      and p.discoverable and p.accepting_requests and professional_service.current_clinician(m.organization_id,m.user_id) and m.role in ('counselor','psychologist','social_worker') and m.credential_expires_at>=current_date;
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
