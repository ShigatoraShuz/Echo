-- LOCAL PROPOSAL: approval required before shared-cloud application.
-- Appointment transaction records owner delivery durably; existing bounded retry worker delivers it.
alter table professional_service.event_outbox add column audience text not null default 'clinician' check(audience in ('clinician','owner'));
create function professional_service.deliver_owner_appointment_notification(p_id uuid,p_request uuid,p_owner uuid)
returns boolean language plpgsql security definer set search_path=professional_service,pg_catalog as $$
begin
 if not exists(select 1 from professional_service.support_requests where id=p_request and user_id=p_owner) then return false; end if;
 if not exists(select 1 from user_service.notification_preferences where user_id=p_owner and in_app_enabled) then return false; end if;
 insert into notification_service.notifications(id,user_id,notification_type,title,message,resource_type,resource_id)
 values(p_id,p_owner,'professional_appointment_update','Appointment updated','Open your support workspace to review an appointment update.','professional_case',p_request) on conflict(id) do nothing;
 return true;
end $$;
revoke all on function professional_service.deliver_owner_appointment_notification(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function professional_service.queue_owner_appointment() returns trigger language plpgsql security definer set search_path=professional_service,pg_catalog as $$
declare owner_id uuid; delivery_id uuid;
begin
 if TG_OP='UPDATE' and old.status is not distinct from new.status then return new; end if;
 select user_id into owner_id from professional_service.support_requests where id=new.request_id;
 delivery_id := case when new.status='proposed' then new.id else overlay(overlay(md5(new.id::text||':'||new.status) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid end;
 if owner_id is not null then
  insert into professional_service.event_outbox(id,request_id,recipient_id,kind,audience)
   values(delivery_id,new.request_id,owner_id,'appointment_changed','owner') on conflict(id) do nothing;
 end if;
 return new;
end $$;
revoke all on function professional_service.queue_owner_appointment() from public,anon,authenticated,service_role;
create trigger appointment_owner_delivery after insert or update of status on professional_service.appointments for each row execute function professional_service.queue_owner_appointment();
create or replace function professional_service.process_events(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare e professional_service.event_outbox; r professional_service.support_requests; delivered integer:=0; suppressed integer:=0; failures integer:=0; valid boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_EVENT_BATCH'; end if;
  for e in select * from professional_service.event_outbox where status='pending' and next_attempt_at<=clock_timestamp() order by next_attempt_at,created_at,id limit p_limit for update skip locked loop
    begin
      select * into r from professional_service.support_requests where id=e.request_id for share;
      valid := found and (case when e.audience='owner' then r.user_id=e.recipient_id else r.assigned_to=e.recipient_id end);
      if e.source_follow_up_id is not null then
        valid := valid and exists(select 1 from professional_service.follow_ups where id=e.source_follow_up_id and request_id=e.request_id and responsible_user_id=e.recipient_id and revision=e.source_revision and status='pending' and due_at<=clock_timestamp());
      end if;
      if valid and (case when e.audience='owner' then professional_service.deliver_owner_appointment_notification(e.id,e.request_id,e.recipient_id) else professional_service.deliver_notification(e.id,e.request_id,e.kind) end) then
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


revoke all on function professional_service.process_events(integer) from public,anon,authenticated;
grant execute on function professional_service.process_events(integer) to service_role;

-- Trusted, bounded delivery for one authorized workflow; never flush unrelated cases.
create or replace function professional_service.process_case_events(p_request_id uuid,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare e professional_service.event_outbox; r professional_service.support_requests; delivered integer:=0; suppressed integer:=0; failures integer:=0; valid boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_EVENT_BATCH'; end if;
  for e in select * from professional_service.event_outbox where request_id=p_request_id and status='pending' and next_attempt_at<=clock_timestamp() order by next_attempt_at,created_at,id limit p_limit for update skip locked loop
    begin
      select * into r from professional_service.support_requests where id=e.request_id for share;
      valid := found and (case when e.audience='owner' then r.user_id=e.recipient_id else r.assigned_to=e.recipient_id end);
      if e.source_follow_up_id is not null then
        valid := valid and exists(select 1 from professional_service.follow_ups where id=e.source_follow_up_id and request_id=e.request_id and responsible_user_id=e.recipient_id and revision=e.source_revision and status='pending' and due_at<=clock_timestamp());
      end if;
      if valid and (case when e.audience='owner' then professional_service.deliver_owner_appointment_notification(e.id,e.request_id,e.recipient_id) else professional_service.deliver_notification(e.id,e.request_id,e.kind) end) then
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
  return jsonb_build_object('delivered',delivered,'suppressed',suppressed,'failures',failures,'pending',(select count(*) from professional_service.event_outbox where request_id=p_request_id and status='pending'));
end $$;



revoke all on function professional_service.process_case_events(uuid,integer) from public,anon,authenticated;
grant execute on function professional_service.process_case_events(uuid,integer) to service_role;
