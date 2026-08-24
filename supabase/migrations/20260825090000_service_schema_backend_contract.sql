-- Backend runtime contract for the service-schema cutover.
-- The Supabase service-role key maps to the `service_role` database role, so
-- explicit grants are required for PostgREST access outside `public`.

grant usage on schema user_service to service_role;
grant usage on schema journal_service to service_role;
grant usage on schema buddy_service to service_role;
grant usage on schema verification_service to service_role;
grant usage on schema notification_service to service_role;
grant usage on schema grounding_service to service_role;
grant usage on schema insights_service to service_role;
grant usage on schema ai_analysis to service_role;

grant select, insert, update, delete on all tables in schema user_service to service_role;
grant select, insert, update, delete on all tables in schema journal_service to service_role;
grant select, insert, update, delete on all tables in schema buddy_service to service_role;
grant select, insert, update, delete on all tables in schema verification_service to service_role;
grant select, insert, update, delete on all tables in schema notification_service to service_role;
grant select, insert, update, delete on all tables in schema grounding_service to service_role;
grant select, insert, update, delete on all tables in schema insights_service to service_role;
grant select, insert, update, delete on all tables in schema ai_analysis to service_role;

create table if not exists user_service.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  resource_type text,
  resource_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table user_service.audit_events enable row level security;

create policy audit_events_select_own on user_service.audit_events for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = actor_user_id);

grant select on user_service.audit_events to authenticated;
grant select, insert, update, delete on user_service.audit_events to service_role;

create index if not exists audit_events_user_id_created_at_idx
  on user_service.audit_events (user_id, created_at desc);
create index if not exists audit_events_actor_user_id_created_at_idx
  on user_service.audit_events (actor_user_id, created_at desc);
create index if not exists audit_events_request_id_idx
  on user_service.audit_events (request_id);

create table if not exists grounding_service.support_resources (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  support_resource_type text not null,
  organization_name text not null,
  resource_name text not null,
  description text,
  phone_number text,
  sms_number text,
  website_url text,
  availability_text text,
  is_active boolean not null default false,
  is_verified boolean not null default false,
  display_priority integer not null default 100 check (display_priority >= 0),
  verification_source text,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (phone_number is not null or sms_number is not null or website_url is not null),
  check (not is_active or (is_verified and verification_source is not null and last_verified_at is not null))
);

alter table grounding_service.support_resources enable row level security;

create policy support_resources_read_verified_active
  on grounding_service.support_resources for select to anon, authenticated
  using (is_active and is_verified);

grant select on grounding_service.support_resources to anon, authenticated;
grant select, insert, update, delete on grounding_service.support_resources to service_role;

create index if not exists support_resources_lookup_idx
  on grounding_service.support_resources (country_code, region_code, is_active, display_priority);

insert into grounding_service.support_resources (
  id,
  country_code,
  region_code,
  support_resource_type,
  organization_name,
  resource_name,
  description,
  phone_number,
  sms_number,
  website_url,
  availability_text,
  is_active,
  is_verified,
  display_priority,
  verification_source,
  last_verified_at,
  created_at,
  updated_at
)
select
  id,
  country_code,
  region_code,
  support_resource_type,
  organization_name,
  resource_name,
  description,
  phone_number,
  sms_number,
  website_url,
  availability_text,
  is_active,
  is_verified,
  display_priority,
  verification_source,
  last_verified_at,
  created_at,
  updated_at
from public.support_resources
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'support_resources'
)
on conflict (id) do update set
  country_code = excluded.country_code,
  region_code = excluded.region_code,
  support_resource_type = excluded.support_resource_type,
  organization_name = excluded.organization_name,
  resource_name = excluded.resource_name,
  description = excluded.description,
  phone_number = excluded.phone_number,
  sms_number = excluded.sms_number,
  website_url = excluded.website_url,
  availability_text = excluded.availability_text,
  is_active = excluded.is_active,
  is_verified = excluded.is_verified,
  display_priority = excluded.display_priority,
  verification_source = excluded.verification_source,
  last_verified_at = excluded.last_verified_at,
  updated_at = excluded.updated_at;
