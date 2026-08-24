create extension if not exists pgcrypto;

create table if not exists public.lab_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  text_emotion text not null,
  face_emotion text,
  risk_level text,
  recommendation text,
  top_emotions jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists lab_entries_owner_created_at_idx
  on public.lab_entries (owner_id, created_at desc);

create table if not exists public.user_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  timezone text not null default '',
  dark_mode boolean not null default true
);

create table if not exists public.user_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder boolean not null default true,
  weekly_insights boolean not null default true,
  new_messages boolean not null default true,
  crisis_alerts boolean not null default true,
  email_digest boolean not null default false,
  share_anonymous_data boolean not null default false,
  show_online_status boolean not null default true,
  allow_ai_analysis boolean not null default true
);

alter table public.lab_entries enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "lab_entries_select_own" on public.lab_entries;
drop policy if exists "lab_entries_insert_own" on public.lab_entries;
drop policy if exists "lab_entries_update_own" on public.lab_entries;
drop policy if exists "lab_entries_delete_own" on public.lab_entries;
drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_preferences_select_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;

create policy "lab_entries_select_own"
  on public.lab_entries
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "lab_entries_insert_own"
  on public.lab_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "lab_entries_update_own"
  on public.lab_entries
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lab_entries_delete_own"
  on public.lab_entries
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "user_preferences_select_own"
  on public.user_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_preferences_insert_own"
  on public.user_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_preferences_update_own"
  on public.user_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
