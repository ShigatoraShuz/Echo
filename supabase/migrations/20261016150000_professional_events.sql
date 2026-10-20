-- BE-025: small transactional queue; existing notification storage remains the delivery sink.
create table professional_service.event_outbox (
  id uuid primary key, request_id uuid not null references professional_service.support_requests(id),
  recipient_id uuid not null references auth.users(id), kind text not null check(kind in ('case_updated','appointment_changed','follow_up','referral_updated')),
  source_follow_up_id uuid references professional_service.follow_ups(id), source_revision integer,
  status text not null default 'pending' check(status in ('pending','delivered','suppressed','failed')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default clock_timestamp(),
  last_error_code text check(last_error_code is null or last_error_code='DELIVERY_FAILED'),
  created_at timestamptz not null default clock_timestamp(), processed_at timestamptz,
  check((source_follow_up_id is null)=(source_revision is null)), unique(source_follow_up_id,source_revision)
);
alter table professional_service.event_outbox enable row level security;
revoke all on professional_service.event_outbox from public,anon,authenticated,service_role;
create index professional_outbox_pending_idx on professional_service.event_outbox(next_attempt_at,created_at,id) where status='pending';

create or replace function professional_service.notify_case_event() returns trigger language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare kind text; recipient uuid;
begin
  kind := case
    when new.action in ('request.claimed','request.closed','request.transferred') then 'case_updated'
    when new.action in ('appointment.proposed','appointment.confirmed','appointment.declined','appointment.canceled','appointment.rescheduled') then 'appointment_changed'
    when new.action in ('followup.created','followup.updated','followup.completed') then 'follow_up'
    when new.action in ('referral.created','referral.completed','referral.canceled') then 'referral_updated' end;
  if kind is not null and new.request_id is not null then
    select assigned_to into recipient from professional_service.support_requests where id=new.request_id;
    if recipient is not null then
      insert into professional_service.event_outbox(id,request_id,recipient_id,kind) values(new.id,new.request_id,recipient,kind) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

create function professional_service.enqueue_follow_up_reminders(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare inserted integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_EVENT_BATCH'; end if;
  insert into professional_service.event_outbox(id,request_id,recipient_id,kind,source_follow_up_id,source_revision)
    select gen_random_uuid(),f.request_id,f.responsible_user_id,'follow_up',f.id,f.revision from professional_service.follow_ups f
    join professional_service.support_requests r on r.id=f.request_id and r.assigned_to=f.responsible_user_id
    where f.status='pending' and f.due_at<=clock_timestamp()
      and not exists(select 1 from professional_service.event_outbox e where e.source_follow_up_id=f.id and e.source_revision=f.revision)
    order by f.due_at,f.id limit p_limit on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

create function professional_service.process_events(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare e professional_service.event_outbox; r professional_service.support_requests; delivered integer:=0; suppressed integer:=0; failures integer:=0; valid boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_EVENT_BATCH'; end if;
  for e in select * from professional_service.event_outbox where status='pending' and next_attempt_at<=clock_timestamp() order by next_attempt_at,created_at,id limit p_limit for update skip locked loop
    begin
      select * into r from professional_service.support_requests where id=e.request_id for share;
      valid := found and r.assigned_to=e.recipient_id;
      if e.source_follow_up_id is not null then
        valid := valid and exists(select 1 from professional_service.follow_ups where id=e.source_follow_up_id and request_id=e.request_id and responsible_user_id=e.recipient_id and revision=e.source_revision and status='pending' and due_at<=clock_timestamp());
      end if;
      if valid and professional_service.deliver_notification(e.id,e.request_id,e.kind) then
        update professional_service.event_outbox set status='delivered',processed_at=clock_timestamp(),last_error_code=null,attempts=attempts+1 where id=e.id;
        delivered := delivered+1;
      else
        update professional_service.event_outbox set status='suppressed',processed_at=clock_timestamp(),last_error_code=null,attempts=attempts+1 where id=e.id;
        suppressed := suppressed+1;
      end if;
    exception when others then
      -- The failed delivery subtransaction is rolled back before recording a fixed error code.
      update professional_service.event_outbox set attempts=attempts+1,status=case when attempts+1>=8 then 'failed' else 'pending' end,
        next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),last_error_code='DELIVERY_FAILED' where id=e.id;
      failures := failures+1;
    end;
  end loop;
  return jsonb_build_object('delivered',delivered,'suppressed',suppressed,'failures',failures);
end $$;

create function professional_service.retry_failed_events(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare retried integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_EVENT_BATCH'; end if;
  update professional_service.event_outbox set status='pending',attempts=0,next_attempt_at=clock_timestamp(),last_error_code=null
    where id in (select id from professional_service.event_outbox where status='failed' order by created_at,id limit p_limit for update skip locked);
  get diagnostics retried = row_count; return retried;
end $$;
revoke all on function professional_service.enqueue_follow_up_reminders(integer),professional_service.process_events(integer),professional_service.retry_failed_events(integer) from public,anon,authenticated,service_role;
grant execute on function professional_service.enqueue_follow_up_reminders(integer),professional_service.process_events(integer),professional_service.retry_failed_events(integer) to service_role;
