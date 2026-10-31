-- LOCAL PROPOSAL ONLY. Do not apply or process shared events without separate approval.
-- No preference changes, event replay, data backfill, grants to browsers or role changes.
-- Generic inbox resource IDs are routing hints; current actor/org/assignment is authority.
-- Legacy notices can have IDs distinct from message IDs. Never project their title/body.
create or replace function professional_service.list_notifications(p_organization_id uuid,p_actor uuid,p_unread_only boolean)
returns jsonb language plpgsql security definer set search_path=professional_service,pg_catalog as $$
declare result jsonb;
begin
  perform professional_service.require_notification_actor(p_organization_id,p_actor);
  with eligible as (
    select n.id,n.read_at,n.created_at,l.kind,l.request_id
    from notification_service.notifications n
    join professional_service.notification_links l on l.notification_id=n.id
    join professional_service.support_requests r on r.id=l.request_id and r.organization_id=l.organization_id
    where n.user_id=p_actor and l.recipient_id=p_actor and l.organization_id=p_organization_id and r.assigned_to=p_actor
    union
    select n.id,n.read_at,n.created_at,'case_message'::text,r.id
    from notification_service.notifications n
    join professional_service.support_requests r on r.id=n.resource_id
    where n.user_id=p_actor and n.notification_type='professional_case_message' and n.resource_type='professional_case'
      and r.organization_id=p_organization_id and r.assigned_to=p_actor
      and not exists(select 1 from professional_service.notification_links l where l.notification_id=n.id)
  ), filtered as (
    select * from eligible where not p_unread_only or read_at is null
  ), page as (
    select * from filtered order by created_at desc,id limit 50
  )
  select jsonb_build_object(
    'items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'caseId',request_id,'readAt',read_at,'createdAt',created_at) order by created_at desc,id),'[]'::jsonb) from page),
    'total',(select count(*) from filtered),'unreadCount',(select count(*) from eligible where read_at is null),
    'hasMore',(select count(*)>50 from filtered),'limit',50,
    'inAppEnabled',coalesce((select in_app_enabled from user_service.notification_preferences where user_id=p_actor),false)
  ) into result;
  insert into professional_service.audit_events(organization_id,actor_user_id,action) values(p_organization_id,p_actor,'notifications.viewed');
  return result;
end $$;

create or replace function professional_service.read_notification(p_organization_id uuid,p_notification_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=professional_service,pg_catalog as $$
declare target_request uuid; read_time timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select r.id into target_request
    from notification_service.notifications n
    join professional_service.support_requests r on r.organization_id=p_organization_id and r.assigned_to=p_actor
    left join professional_service.notification_links l on l.notification_id=n.id and l.organization_id=r.organization_id
      and l.request_id=r.id and l.recipient_id=p_actor
    where n.id=p_notification_id and n.user_id=p_actor and (
      l.notification_id is not null or
      (n.notification_type='professional_case_message' and n.resource_type='professional_case' and n.resource_id=r.id)
    );
  if target_request is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- Lock request before membership; prevents a reassignment racing the acknowledgement.
  perform professional_service.require_case_actor(target_request,p_actor);
  update notification_service.notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_notification_id and user_id=p_actor returning read_at into read_time;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  return jsonb_build_object('id',p_notification_id,'readAt',read_time);
end $$;
revoke all on function professional_service.list_notifications(uuid,uuid,boolean),professional_service.read_notification(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function professional_service.list_notifications(uuid,uuid,boolean),professional_service.read_notification(uuid,uuid,uuid) to service_role;
