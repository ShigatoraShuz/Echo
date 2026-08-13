-- Persist the user-controlled Settings surfaces introduced by the authenticated app.
-- Service-managed workflows still use the backend; owner-scoped RLS keeps browser
-- access private if these tables are queried with an authenticated Supabase client.

alter table public.profiles
  add column if not exists theme_variant text not null default 'echo-calm',
  add column if not exists theme_mode text not null default 'system';

alter table public.profiles
  add constraint profiles_theme_variant_allowed
    check (theme_variant in ('echo-calm', 'echo-night', 'echo-soft', 'echo-focus')) not valid,
  add constraint profiles_theme_mode_allowed
    check (theme_mode in ('light', 'dark', 'system')) not valid;

alter table public.profiles validate constraint profiles_theme_variant_allowed;
alter table public.profiles validate constraint profiles_theme_mode_allowed;

create table public.privacy_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  facial_analysis_enabled boolean not null default false,
  crisis_support_visible boolean not null default true,
  lock_screen_private boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger privacy_preferences_set_updated_at
  before update on public.privacy_preferences
  for each row execute function private.set_updated_at();

insert into public.privacy_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.privacy_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

alter table public.privacy_preferences enable row level security;

create policy privacy_preferences_select_own
  on public.privacy_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy privacy_preferences_update_own
  on public.privacy_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.privacy_preferences to authenticated;

