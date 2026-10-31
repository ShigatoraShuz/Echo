create table if not exists user_service.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_on date not null,
  scheduled_time time,
  kind text not null check (kind in ('reminder', 'note')),
  content_ciphertext text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_items_user_day_idx
  on user_service.calendar_items (user_id, scheduled_on, scheduled_time);

alter table user_service.calendar_items enable row level security;

create policy calendar_items_owner on user_service.calendar_items
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on user_service.calendar_items to service_role;
