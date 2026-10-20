-- BE-030 operational visibility: aggregate counters only, no patient/event identifiers.
create function professional_service.event_health()
returns jsonb language plpgsql security definer set search_path = professional_service, pg_catalog as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select jsonb_build_object('pending',count(*) filter(where status='pending'),
    'ready',count(*) filter(where status='pending' and next_attempt_at<=clock_timestamp()),
    'failed',count(*) filter(where status='failed'),
    'oldestPendingAt',min(created_at) filter(where status='pending')) into result
    from professional_service.event_outbox where status in ('pending','failed');
  return result;
end $$;
revoke all on function professional_service.event_health() from public,anon,authenticated,service_role;
grant execute on function professional_service.event_health() to service_role;
