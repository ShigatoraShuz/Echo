create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  timezone text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in ('terms_of_use', 'privacy_policy', 'journal_analysis')),
  consent_version text not null,
  accepted boolean not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint accepted_consent_has_timestamp check (not accepted or accepted_at is not null),
  constraint user_consents_user_type_version_unique unique (user_id, consent_type, consent_version)
);

create table public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 20000),
  entry_date date not null default current_date,
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  base_model text not null,
  adapter_version text not null,
  adapter_checksum text,
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  deployed_at timestamptz not null default timezone('utc', now()),
  retired_at timestamptz
);

create table public.journal_analyses (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model_version_id uuid references public.model_versions (id),
  phq8_score integer check (phq8_score between 0 and 24),
  severity text check (severity in ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe')),
  urgent_language_detected boolean not null default false,
  processing_time_ms integer check (processing_time_ms >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  failure_code text,
  request_id uuid not null unique,
  analyzed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint completed_analysis_has_result check (
    status <> 'completed' or (phq8_score is not null and severity is not null and analyzed_at is not null)
  )
);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mood_score integer not null check (mood_score between 1 and 10),
  energy_score integer check (energy_score between 1 and 10),
  note text check (note is null or char_length(note) <= 2000),
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 1 and 200),
  contact_email text,
  contact_phone text,
  relationship text not null check (char_length(relationship) between 1 and 100),
  verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trusted_contact_has_channel check (contact_email is not null or contact_phone is not null)
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  journal_reminders_enabled boolean not null default false,
  insight_notifications_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  resource_type text not null,
  resource_id uuid,
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_metadata_excludes_sensitive_text check (
    not (metadata ?| array['journal_text', 'content', 'body', 'prompt'])
  )
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger journals_set_updated_at before update on public.journals
for each row execute function public.set_updated_at();
create trigger trusted_contacts_set_updated_at before update on public.trusted_contacts
for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.journals enable row level security;
alter table public.journal_analyses enable row level security;
alter table public.mood_entries enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
alter table public.model_versions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.user_consents, public.journals,
  public.journal_analyses, public.mood_entries, public.trusted_contacts,
  public.notification_preferences, public.notifications to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

create policy "user_consents_select_own" on public.user_consents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_consents_insert_own" on public.user_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_consents_update_own" on public.user_consents for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_consents_delete_own" on public.user_consents for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "journals_select_own" on public.journals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journals_insert_own" on public.journals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "journals_update_own" on public.journals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journals_delete_own" on public.journals for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "journal_analyses_select_own" on public.journal_analyses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "journal_analyses_insert_own" on public.journal_analyses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "journal_analyses_update_own" on public.journal_analyses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_analyses_delete_own" on public.journal_analyses for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "mood_entries_select_own" on public.mood_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "mood_entries_insert_own" on public.mood_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "mood_entries_update_own" on public.mood_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mood_entries_delete_own" on public.mood_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "trusted_contacts_select_own" on public.trusted_contacts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "trusted_contacts_insert_own" on public.trusted_contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "trusted_contacts_update_own" on public.trusted_contacts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trusted_contacts_delete_own" on public.trusted_contacts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "notification_preferences_select_own" on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notification_preferences_insert_own" on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notification_preferences_delete_own" on public.notification_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications_select_own" on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notifications_delete_own" on public.notifications for delete to authenticated
  using ((select auth.uid()) = user_id);

create index user_consents_user_id_consent_type_idx on public.user_consents (user_id, consent_type);
create index journals_user_id_entry_date_idx on public.journals (user_id, entry_date desc) where deleted_at is null;
create index journals_user_id_analysis_status_idx on public.journals (user_id, analysis_status) where deleted_at is null;
create index journal_analyses_journal_id_idx on public.journal_analyses (journal_id);
create index journal_analyses_user_id_status_idx on public.journal_analyses (user_id, status);
create index mood_entries_user_id_recorded_at_idx on public.mood_entries (user_id, recorded_at desc);
create index trusted_contacts_user_id_idx on public.trusted_contacts (user_id);
create index notifications_user_id_read_at_idx on public.notifications (user_id, read_at);
create index audit_events_user_id_idx on public.audit_events (user_id);
create index audit_events_request_id_idx on public.audit_events (request_id);
create unique index model_versions_one_active_idx on public.model_versions (active) where active;
