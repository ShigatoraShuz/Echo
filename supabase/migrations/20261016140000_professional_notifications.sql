-- BE-024: reuse notification_service storage and user preferences; protected context stays private.
create table professional_service.notification_links (
  notification_id uuid primary key references notification_service.notifications(id) on delete cascade,
  event_id uuid not null unique, organization_id uuid not null references professional_service.organizations(id),
  request_id uuid not null references professional_service.support_requests(id),
  recipient_id uuid not null references auth.users(id), kind text not null
);
alter table professional_service.notification_links enable row level security;
revoke all on professional_service.notification_links from public,anon,authenticated,service_role;
create index professional_notifications_recipient_idx on professional_service.notification_links(organization_id,recipient_id,request_id);

create function professional_service.deliver_notification(p_event_id uuid,p_request_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; notification uuid;
begin
  if p_kind is null or p_kind not in ('case_updated','appointment_changed','follow_up','referral_updated') then raise exception 'INVALID_PROFESSIONAL_EVENT'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for share;
  if not found or r.assigned_to is null or not professional_service.current_clinician(r.organization_id,r.assigned_to) then return false; end if;
  if not exists(select 1 from user_service.notification_preferences where user_id=r.assigned_to and in_app_enabled) then return false; end if;
  if exists(select 1 from professional_service.notification_links where event_id=p_event_id) then return true; end if;
  -- Generic personal inbox rows intentionally have NO case/org/actor IDs or content.
  insert into notification_service.notifications(user_id,notification_type,title,message,resource_type,resource_id)
    values(r.assigned_to,'professional_update','Professional workspace update','Open your authorized Professional workspace to review updates.',null,null) returning id into notification;
  insert into professional_service.notification_links(notification_id,event_id,organization_id,request_id,recipient_id,kind)
    values(notification,p_event_id,r.organization_id,r.id,r.assigned_to,p_kind);
  return true;
end $$;
revoke all on function professional_service.deliver_notification(uuid,uuid,text) from public,anon,authenticated,service_role;

create function professional_service.notify_case_event() returns trigger language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare kind text;
begin
  kind := case
    when new.action in ('request.claimed','request.closed','request.transferred') then 'case_updated'
    when new.action in ('appointment.proposed','appointment.confirmed','appointment.declined','appointment.canceled','appointment.rescheduled') then 'appointment_changed'
    when new.action in ('followup.created','followup.updated','followup.completed') then 'follow_up'
    when new.action in ('referral.created','referral.completed','referral.canceled') then 'referral_updated' end;
  if kind is not null and new.request_id is not null then perform professional_service.deliver_notification(new.id,new.request_id,kind); end if;
  return new;
end $$;
create trigger professional_case_notification after insert on professional_service.audit_events for each row execute function professional_service.notify_case_event();
revoke all on function professional_service.notify_case_event() from public,anon,authenticated,service_role;

create function professional_service.require_notification_actor(p_organization_id uuid,p_actor uuid) returns void
language plpgsql security definer set search_path = professional_service, pg_catalog as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  perform 1 from professional_service.organizations where id=p_organization_id and status='active' for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from user_service.profiles where user_id=p_actor and account_status='active' and eligible_18_plus and onboarding_completed for share;
  if not found then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  perform 1 from professional_service.memberships where organization_id=p_organization_id and user_id=p_actor and status='active' for share;
  if not found or not professional_service.current_clinician(p_organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
end $$;
revoke all on function professional_service.require_notification_actor(uuid,uuid) from public,anon,authenticated,service_role;

create function professional_service.list_notifications(p_organization_id uuid,p_actor uuid,p_unread_only boolean)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare result jsonb;
begin
  perform professional_service.require_notification_actor(p_organization_id,p_actor);
  select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'caseId',n.request_id,'readAt',n.read_at,'createdAt',n.created_at) order by n.created_at desc,n.id),'[]'::jsonb),
    'total',coalesce(max(n.total),0),'hasMore',coalesce(bool_or(n.total>50),false),'limit',50) into result
  from (select n.id,n.read_at,n.created_at,l.kind,l.request_id,count(*) over() total from notification_service.notifications n
    join professional_service.notification_links l on l.notification_id=n.id
    join professional_service.support_requests r on r.id=l.request_id and r.organization_id=l.organization_id and r.assigned_to=p_actor
    where l.organization_id=p_organization_id and l.recipient_id=p_actor and n.user_id=p_actor and (not p_unread_only or n.read_at is null)
    order by n.created_at desc,n.id limit 50) n;
  insert into professional_service.audit_events(organization_id,actor_user_id,action) values(p_organization_id,p_actor,'notifications.viewed');
  return result;
end $$;

create function professional_service.read_notification(p_organization_id uuid,p_notification_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare l professional_service.notification_links; read_time timestamptz;
begin
  -- Request-before-membership lock order matches workflow mutations.
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into l from professional_service.notification_links where notification_id=p_notification_id and organization_id=p_organization_id and recipient_id=p_actor;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  perform professional_service.require_case_actor(l.request_id,p_actor);
  update notification_service.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=l.notification_id and user_id=p_actor returning read_at into read_time;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  return jsonb_build_object('id',l.notification_id,'readAt',read_time);
end $$;
revoke all on function professional_service.list_notifications(uuid,uuid,boolean),professional_service.read_notification(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function professional_service.list_notifications(uuid,uuid,boolean),professional_service.read_notification(uuid,uuid,uuid) to service_role;
