create extension if not exists pgcrypto;

create schema if not exists user_service;
create schema if not exists journal_service;
create schema if not exists buddy_service;
create schema if not exists grounding_service;
create schema if not exists insights_service;
create schema if not exists notification_service;
create schema if not exists verification_service;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'user_service_role') then
    create role user_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'journal_service_role') then
    create role journal_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'buddy_service_role') then
    create role buddy_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'grounding_service_role') then
    create role grounding_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'insights_service_role') then
    create role insights_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'notification_service_role') then
    create role notification_service_role noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'verification_service_role') then
    create role verification_service_role noinherit;
  end if;
end
$$;

grant usage on schema user_service to user_service_role;
grant usage on schema journal_service to journal_service_role;
grant usage on schema buddy_service to buddy_service_role;
grant usage on schema grounding_service to grounding_service_role;
grant usage on schema insights_service to insights_service_role;
grant usage on schema notification_service to notification_service_role;
grant usage on schema verification_service to verification_service_role;

create or replace function public.set_updated_at()
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

create table if not exists user_service.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'UTC',
  avatar_path text,
  theme_variant text not null default 'echo-calm' check (theme_variant in ('echo-calm', 'echo-night', 'echo-soft', 'echo-focus')),
  theme_mode text not null default 'system' check (theme_mode in ('light', 'dark', 'system')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists user_service.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consent_version text not null,
  accepted boolean not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  source text not null default 'app',
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_consents_unique unique (user_id, consent_type, consent_version),
  constraint accepted_consent_has_timestamp check (not accepted or accepted_at is not null)
);

create table if not exists user_service.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  journal_reminders_enabled boolean not null default false,
  wellbeing_reminders_enabled boolean not null default false,
  insight_notifications_enabled boolean not null default false,
  reminder_time time,
  reminder_timezone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists user_service.privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  facial_analysis_enabled boolean not null default false,
  crisis_support_visible boolean not null default true,
  lock_screen_private boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists user_service.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  relationship text not null,
  verified boolean not null default false,
  is_primary boolean not null default false,
  permission_acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trusted_contact_has_channel check (contact_email is not null or contact_phone is not null)
);

create table if not exists user_service.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_status text not null default 'requested',
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists user_service.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_status text not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  scheduled_for timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists journal_service.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  content_ciphertext text not null,
  encryption_iv text not null,
  encryption_auth_tag text not null,
  encryption_key_version integer not null,
  word_count integer not null default 0,
  mood text not null,
  emotions jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  privacy_status text not null default 'private',
  analysis_consent boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists journal_service.journal_drafts (
  user_id uuid primary key,
  title text not null default '',
  content_ciphertext text not null,
  encryption_iv text not null,
  encryption_auth_tag text not null,
  encryption_key_version integer not null,
  mood text not null,
  emotions jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  privacy_status text not null default 'private',
  analysis_consent boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists journal_service.journal_analyses (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null,
  user_id uuid not null,
  request_id uuid not null unique,
  status text not null default 'pending',
  phq8_score integer check (phq8_score between 0 and 24),
  severity text check (severity in ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe')),
  urgent_language_detected boolean not null default false,
  processing_time_ms integer check (processing_time_ms >= 0),
  failure_code text,
  started_at timestamptz,
  completed_at timestamptz,
  analyzed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint completed_analysis_has_result check (
    status <> 'completed' or (phq8_score is not null and severity is not null and analyzed_at is not null)
  )
);

create table if not exists buddy_service.buddy_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New conversation',
  last_message_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists buddy_service.buddy_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  is_flagged boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists buddy_service.buddy_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  rating integer check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists grounding_service.grounding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  exercise_type text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  completed boolean not null default false,
  reflection text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists grounding_service.breathing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pattern text not null,
  total_cycles integer not null check (total_cycles > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  completed_at timestamptz not null default timezone('utc', now())
);

create table if not exists insights_service.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mood_score integer not null check (mood_score between 1 and 10),
  energy_score integer check (energy_score between 1 and 10),
  note text,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists insights_service.insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  insight_type text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists notification_service.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notification_type text not null,
  title text not null,
  message text not null,
  resource_type text,
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists notification_service.notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  channel text not null,
  delivery_status text not null default 'pending',
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists verification_service.verification_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists verification_service.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  verification_status text not null default 'not_started',
  is_minor boolean,
  age_at_submission integer,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  decision_reason_code text,
  approved_expires_at timestamptz,
  details_ciphertext text,
  details_iv text,
  details_auth_tag text,
  details_key_version integer,
  review_note_ciphertext text,
  review_note_iv text,
  review_note_auth_tag text,
  review_note_key_version integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists verification_service.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null,
  user_id uuid not null,
  document_kind text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_path text not null,
  uploaded_at timestamptz not null default timezone('utc', now())
);

create table if not exists verification_service.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null,
  admin_user_id uuid not null,
  decision text not null,
  reason_code text,
  note_ciphertext text,
  note_iv text,
  note_auth_tag text,
  note_key_version integer,
  created_at timestamptz not null default timezone('utc', now())
);

alter table user_service.profiles enable row level security;
alter table user_service.user_consents enable row level security;
alter table user_service.notification_preferences enable row level security;
alter table user_service.privacy_preferences enable row level security;
alter table user_service.trusted_contacts enable row level security;
alter table user_service.data_export_requests enable row level security;
alter table user_service.account_deletion_requests enable row level security;
alter table journal_service.journals enable row level security;
alter table journal_service.journal_drafts enable row level security;
alter table journal_service.journal_analyses enable row level security;
alter table buddy_service.buddy_conversations enable row level security;
alter table buddy_service.buddy_messages enable row level security;
alter table buddy_service.buddy_feedback enable row level security;
alter table grounding_service.grounding_sessions enable row level security;
alter table grounding_service.breathing_sessions enable row level security;
alter table insights_service.mood_entries enable row level security;
alter table insights_service.insight_snapshots enable row level security;
alter table notification_service.notifications enable row level security;
alter table notification_service.notification_logs enable row level security;
alter table verification_service.identity_verifications enable row level security;
alter table verification_service.verification_documents enable row level security;
alter table verification_service.verification_reviews enable row level security;
alter table verification_service.verification_admins enable row level security;

grant select, insert, update, delete on all tables in schema user_service to user_service_role;
grant select, insert, update, delete on all tables in schema journal_service to journal_service_role;
grant select, insert, update, delete on all tables in schema buddy_service to buddy_service_role;
grant select, insert, update, delete on all tables in schema grounding_service to grounding_service_role;
grant select, insert, update, delete on all tables in schema insights_service to insights_service_role;
grant select, insert, update, delete on all tables in schema notification_service to notification_service_role;
grant select, insert, update, delete on all tables in schema verification_service to verification_service_role;

grant usage on schema user_service to authenticated;
grant usage on schema journal_service to authenticated;
grant usage on schema buddy_service to authenticated;
grant usage on schema grounding_service to authenticated;
grant usage on schema insights_service to authenticated;
grant usage on schema notification_service to authenticated;
grant usage on schema verification_service to authenticated;

grant select, insert, update, delete on user_service.profiles,
  user_service.user_consents,
  user_service.notification_preferences,
  user_service.privacy_preferences,
  user_service.trusted_contacts,
  user_service.data_export_requests,
  user_service.account_deletion_requests to authenticated;

grant select, insert, update, delete on journal_service.journals,
  journal_service.journal_drafts,
  journal_service.journal_analyses to authenticated;

grant select, insert, update, delete on buddy_service.buddy_conversations,
  buddy_service.buddy_messages,
  buddy_service.buddy_feedback to authenticated;

grant select, insert, update, delete on grounding_service.grounding_sessions,
  grounding_service.breathing_sessions to authenticated;

grant select, insert, update, delete on insights_service.mood_entries,
  insights_service.insight_snapshots to authenticated;

grant select, insert, update, delete on notification_service.notifications,
  notification_service.notification_logs to authenticated;

grant select, insert, update, delete on verification_service.identity_verifications,
  verification_service.verification_documents,
  verification_service.verification_reviews,
  verification_service.verification_admins to authenticated;

create policy profiles_select_own on user_service.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_insert_own on user_service.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on user_service.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy consents_select_own on user_service.user_consents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy consents_insert_own on user_service.user_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy notification_preferences_select_own on user_service.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on user_service.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on user_service.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy privacy_preferences_select_own on user_service.privacy_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy privacy_preferences_insert_own on user_service.privacy_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy privacy_preferences_update_own on user_service.privacy_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy trusted_contacts_select_own on user_service.trusted_contacts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy trusted_contacts_insert_own on user_service.trusted_contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy trusted_contacts_update_own on user_service.trusted_contacts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy trusted_contacts_delete_own on user_service.trusted_contacts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy journals_select_own on journal_service.journals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy journals_insert_own on journal_service.journals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy journals_update_own on journal_service.journals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journals_delete_own on journal_service.journals for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy journal_drafts_select_own on journal_service.journal_drafts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy journal_drafts_insert_own on journal_service.journal_drafts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy journal_drafts_update_own on journal_service.journal_drafts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journal_drafts_delete_own on journal_service.journal_drafts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy journal_analyses_select_own on journal_service.journal_analyses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy journal_analyses_insert_own on journal_service.journal_analyses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy buddy_conversations_select_own on buddy_service.buddy_conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy buddy_conversations_insert_own on buddy_service.buddy_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy buddy_conversations_update_own on buddy_service.buddy_conversations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy buddy_conversations_delete_own on buddy_service.buddy_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy buddy_messages_select_own on buddy_service.buddy_messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy buddy_messages_insert_own on buddy_service.buddy_messages for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy buddy_feedback_select_own on buddy_service.buddy_feedback for select to authenticated
  using ((select auth.uid()) = user_id);
create policy buddy_feedback_insert_own on buddy_service.buddy_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy grounding_sessions_select_own on grounding_service.grounding_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy grounding_sessions_insert_own on grounding_service.grounding_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy grounding_sessions_update_own on grounding_service.grounding_sessions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy breathing_sessions_select_own on grounding_service.breathing_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy breathing_sessions_insert_own on grounding_service.breathing_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy mood_entries_select_own on insights_service.mood_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mood_entries_insert_own on insights_service.mood_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy mood_entries_update_own on insights_service.mood_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy mood_entries_delete_own on insights_service.mood_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy notifications_select_own on notification_service.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_insert_own on notification_service.notifications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notifications_update_own on notification_service.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy verification_admins_select_own on verification_service.verification_admins for select to authenticated
  using ((select auth.uid()) = user_id);
create policy identity_verifications_select_own on verification_service.identity_verifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy identity_verifications_insert_own on verification_service.identity_verifications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy identity_verifications_update_own on verification_service.identity_verifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy verification_documents_select_own on verification_service.verification_documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy verification_documents_insert_own on verification_service.verification_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy verification_reviews_select_admin on verification_service.verification_reviews for select to authenticated
  using (
    exists (
      select 1
      from verification_service.verification_admins admin
      where admin.user_id = (select auth.uid())
        and admin.is_active = true
    )
  );

create index if not exists profiles_updated_at_idx on user_service.profiles (updated_at desc);
create index if not exists user_consents_user_id_idx on user_service.user_consents (user_id, consent_type);
create index if not exists notification_preferences_user_id_idx on user_service.notification_preferences (user_id);
create index if not exists privacy_preferences_user_id_idx on user_service.privacy_preferences (user_id);
create index if not exists trusted_contacts_user_id_idx on user_service.trusted_contacts (user_id, is_primary desc, created_at asc);
create index if not exists data_export_requests_user_id_idx on user_service.data_export_requests (user_id, created_at desc);
create index if not exists account_deletion_requests_user_id_idx on user_service.account_deletion_requests (user_id, created_at desc);

create index if not exists journals_user_id_created_at_idx on journal_service.journals (user_id, created_at desc);
create index if not exists journal_analyses_user_id_created_at_idx on journal_service.journal_analyses (user_id, created_at desc);
create index if not exists journal_analyses_journal_id_idx on journal_service.journal_analyses (journal_id, created_at desc);

create index if not exists buddy_conversations_user_id_updated_at_idx on buddy_service.buddy_conversations (user_id, updated_at desc);
create index if not exists buddy_messages_conversation_id_created_at_idx on buddy_service.buddy_messages (conversation_id, created_at asc);

create index if not exists grounding_sessions_user_id_started_at_idx on grounding_service.grounding_sessions (user_id, started_at desc);
create index if not exists breathing_sessions_user_id_completed_at_idx on grounding_service.breathing_sessions (user_id, completed_at desc);

create index if not exists mood_entries_user_id_recorded_at_idx on insights_service.mood_entries (user_id, recorded_at desc);
create index if not exists insight_snapshots_user_id_window_idx on insights_service.insight_snapshots (user_id, window_start desc, window_end desc);

create index if not exists notifications_user_id_created_at_idx on notification_service.notifications (user_id, created_at desc);
create index if not exists notification_logs_notification_id_created_at_idx on notification_service.notification_logs (notification_id, created_at desc);

create index if not exists identity_verifications_user_id_idx on verification_service.identity_verifications (user_id, created_at desc);
create index if not exists verification_documents_verification_id_idx on verification_service.verification_documents (verification_id, uploaded_at asc);
create index if not exists verification_reviews_verification_id_idx on verification_service.verification_reviews (verification_id, created_at desc);
