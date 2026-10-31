-- BE-013 local proposal. Requires credential reviews and claim/lifecycle helpers.
create function professional_service.dashboard_overview(p_organization_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare clinical boolean; counts jsonb; scheduled jsonb; agenda jsonb; appointment_count bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  -- Share locks serialize eligibility changes until this read/audit transaction ends.
  perform 1 from professional_service.organizations where id=p_organization_id and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from user_service.profiles where user_id=p_actor and account_status='active' and eligible_18_plus=true and onboarding_completed=true for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from professional_service.memberships where organization_id=p_organization_id and user_id=p_actor and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  clinical := professional_service.current_clinician(p_organization_id,p_actor);
  if not clinical and not exists(select 1 from professional_service.memberships where organization_id=p_organization_id and user_id=p_actor and role in ('coordinator','org_admin'))
    then raise exception 'MEMBERSHIP_REQUIRED'; end if;

  -- All counts and bounded lists share one SQL statement snapshot. No first-page totals.
  with scoped as materialized (
    select id,organization_id,status,assigned_to,created_at,updated_at from professional_service.support_requests where organization_id=p_organization_id
  ), upcoming as materialized (
    select a.id,a.request_id,a.starts_at,a.ends_at,a.mode,a.status from professional_service.appointments a
    join scoped r on r.id=a.request_id where clinical and r.assigned_to=p_actor and a.professional_user_id=p_actor
      and r.status in ('assigned','scheduled') and a.status in ('proposed','confirmed') and a.ends_at>now()
  ) select
    (select jsonb_build_object(
      'pendingCount',count(*) filter(where status='submitted' and assigned_to is null),
      'activeCount',count(*) filter(where clinical and assigned_to=p_actor and status in ('assigned','scheduled')),
      'scheduledCount',count(*) filter(where clinical and assigned_to=p_actor and status='scheduled')
    ) from scoped),
    (select coalesce(jsonb_agg(jsonb_build_object('id',id,'organizationId',organization_id,'status',status,
      'assignedTo',assigned_to,'createdAt',created_at,'updatedAt',updated_at) order by updated_at desc,id),'[]'::jsonb)
      from (select * from scoped where clinical and assigned_to=p_actor and status='scheduled' order by updated_at desc,id limit 3) s),
    (select coalesce(jsonb_agg(jsonb_build_object('id',id,'requestId',request_id,'startsAt',starts_at,
      'endsAt',ends_at,'mode',mode,'status',status) order by starts_at,id),'[]'::jsonb)
      from (select * from upcoming order by starts_at,id limit 5) a),
    (select count(*) from upcoming)
    into counts,scheduled,agenda,appointment_count;
  insert into professional_service.audit_events(organization_id,actor_user_id,action)
    values(p_organization_id,p_actor,'dashboard.viewed');
  return jsonb_build_object('organizationId',p_organization_id,'userId',p_actor,'asOf',now(),'counts',counts,
    'scheduledCases',scheduled,'scheduledLimit',3,'appointments',agenda,'appointmentTotal',appointment_count,
    'appointmentLimit',5,'clinicalAccess',clinical,'followUpsAvailable',false);
end $$;
revoke all on function professional_service.dashboard_overview(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function professional_service.dashboard_overview(uuid,uuid) to service_role;
