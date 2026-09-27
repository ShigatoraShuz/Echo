begin;
create table user_service.security_events (
 id uuid primary key default gen_random_uuid(),
 event_type text not null check(event_type in ('authentication.denied','authorization.denied','rate_limit.denied',
   'administrator.access','privacy.export','privacy.deletion','consent.access','verification.access','account.security')),
 request_id uuid not null,
 actor_hash text check(actor_hash ~ '^[a-f0-9]{64}$'),
 outcome text not null check(outcome in ('allowed','denied','failed')),
 status_code integer not null check(status_code between 100 and 599),
 created_at timestamptz not null default now()
);
alter table user_service.security_events enable row level security;
revoke all on user_service.security_events from public,anon,authenticated,service_role;
grant select,insert on user_service.security_events to service_role;
create index security_events_event_time on user_service.security_events(event_type,created_at);
commit;
