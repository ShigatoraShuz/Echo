-- Non-destructive reconciliation of the initial schema with the Echo ERD.
-- Existing migration history remains untouched. New application writes use encrypted
-- fields; legacy plaintext columns are retained only to avoid destructive migration.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

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

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function public.phq8_severity(score smallint)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when score between 0 and 4 then 'minimal'
    when score between 5 and 9 then 'mild'
    when score between 10 and 14 then 'moderate'
    when score between 15 and 19 then 'moderately_severe'
    when score between 20 and 24 then 'severe'
    else null
  end;
$$;

revoke all on function public.phq8_severity(smallint) from public;

alter table public.user_consents
  add column if not exists source text not null default 'application';
alter table public.user_consents
  add constraint user_consents_version_not_blank check (btrim(consent_version) <> '') not valid,
  add constraint user_consents_active_accepted_has_timestamp
    check (not (accepted and revoked_at is null) or accepted_at is not null) not valid;
alter table public.user_consents validate constraint user_consents_version_not_blank;
alter table public.user_consents validate constraint user_consents_active_accepted_has_timestamp;

alter table public.notification_preferences
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists wellbeing_reminders_enabled boolean not null default false,
  add column if not exists reminder_time time,
  add column if not exists reminder_timezone text;
alter table public.notification_preferences
  add constraint notification_preferences_reminder_consistency
    check (
      (journal_reminders_enabled or wellbeing_reminders_enabled)
      is false
      or (reminder_time is not null and nullif(btrim(coalesce(reminder_timezone, '')), '') is not null)
    ) not valid;

alter table public.journals
  alter column title drop not null,
  alter column content drop not null,
  add column if not exists title_ciphertext bytea,
  add column if not exists content_ciphertext bytea,
  add column if not exists encryption_iv bytea,
  add column if not exists encryption_auth_tag bytea,
  add column if not exists encryption_key_version smallint,
  add column if not exists journal_status text not null default 'active',
  add column if not exists word_count integer,
  add column if not exists language_code text not null default 'en',
  add column if not exists mood text not null default 'neutral',
  add column if not exists emotions jsonb not null default '[]'::jsonb,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists privacy_status text not null default 'private',
  add column if not exists analysis_consent boolean not null default false,
  add column if not exists archived_at timestamptz;
alter table public.journals
  add constraint journals_owner_unique unique (id, user_id),
  add constraint journals_encryption_fields_grouped check (
    (content_ciphertext is null and encryption_iv is null and encryption_auth_tag is null and encryption_key_version is null)
    or (content_ciphertext is not null and encryption_iv is not null and encryption_auth_tag is not null and encryption_key_version is not null)
  ) not valid,
  add constraint journals_positive_key_version check (encryption_key_version is null or encryption_key_version > 0) not valid,
  add constraint journals_non_negative_word_count check (word_count is null or word_count >= 0) not valid,
  add constraint journals_mood_valid check (mood in ('calm', 'happy', 'neutral', 'sad', 'anxious', 'angry')) not valid,
  add constraint journals_privacy_valid check (privacy_status in ('private', 'shared')) not valid,
  add constraint journals_archive_consistency check (
    (journal_status = 'archived') = (archived_at is not null)
  ) not valid,
  add constraint journals_status_valid check (journal_status in ('active', 'archived')) not valid;
alter table public.journals validate constraint journals_encryption_fields_grouped;
alter table public.journals validate constraint journals_positive_key_version;
alter table public.journals validate constraint journals_non_negative_word_count;
alter table public.journals validate constraint journals_mood_valid;
alter table public.journals validate constraint journals_privacy_valid;
alter table public.journals validate constraint journals_archive_consistency;
alter table public.journals validate constraint journals_status_valid;

alter table public.model_versions
  add column if not exists model_purpose text not null default 'journal_analysis',
  add column if not exists adapter_name text,
  add column if not exists tokenizer_checksum text,
  add column if not exists prompt_version text,
  add column if not exists aggregation_method text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());
drop index if exists public.model_versions_one_active_idx;
create unique index if not exists model_versions_one_active_per_purpose_idx
  on public.model_versions (model_purpose) where active;

alter table public.journal_analyses
  add column if not exists window_count integer not null default 0,
  add column if not exists input_token_count integer,
  add column if not exists output_token_count integer,
  add column if not exists prompt_version text,
  add column if not exists aggregation_method text,
  add column if not exists requested_at timestamptz not null default timezone('utc', now()),
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.journal_analyses
  add constraint journal_analyses_journal_owner_fkey
    foreign key (journal_id, user_id) references public.journals (id, user_id) on delete cascade,
  add constraint journal_analyses_non_negative_window_count check (window_count >= 0) not valid,
  add constraint journal_analyses_non_negative_input_tokens check (input_token_count is null or input_token_count >= 0) not valid,
  add constraint journal_analyses_non_negative_output_tokens check (output_token_count is null or output_token_count >= 0) not valid,
  add constraint journal_analyses_failed_has_code check (status <> 'failed' or failure_code is not null) not valid,
  add constraint journal_analyses_score_matches_severity check (
    phq8_score is null or severity = public.phq8_severity(phq8_score::smallint)
  ) not valid;
alter table public.journal_analyses validate constraint journal_analyses_non_negative_window_count;
alter table public.journal_analyses validate constraint journal_analyses_non_negative_input_tokens;
alter table public.journal_analyses validate constraint journal_analyses_non_negative_output_tokens;
alter table public.journal_analyses validate constraint journal_analyses_failed_has_code;
alter table public.journal_analyses validate constraint journal_analyses_score_matches_severity;

alter table public.mood_entries
  drop constraint if exists mood_entries_mood_score_check,
  drop constraint if exists mood_entries_energy_score_check;
alter table public.mood_entries
  alter column note drop not null,
  add column if not exists anxiety_score smallint,
  add column if not exists note_ciphertext bytea,
  add column if not exists encryption_iv bytea,
  add column if not exists encryption_auth_tag bytea,
  add column if not exists encryption_key_version smallint;
alter table public.mood_entries
  add constraint mood_entries_mood_score_range check (mood_score between 1 and 5) not valid,
  add constraint mood_entries_energy_score_range check (energy_score is null or energy_score between 1 and 5) not valid,
  add constraint mood_entries_anxiety_score_range check (anxiety_score is null or anxiety_score between 1 and 5) not valid,
  add constraint mood_entries_note_encryption_grouped check (
    (note_ciphertext is null and encryption_iv is null and encryption_auth_tag is null and encryption_key_version is null)
    or (note_ciphertext is not null and encryption_iv is not null and encryption_auth_tag is not null and encryption_key_version is not null)
  ) not valid,
  add constraint mood_entries_key_version_positive check (encryption_key_version is null or encryption_key_version > 0) not valid;
alter table public.mood_entries validate constraint mood_entries_mood_score_range;
alter table public.mood_entries validate constraint mood_entries_energy_score_range;
alter table public.mood_entries validate constraint mood_entries_anxiety_score_range;
alter table public.mood_entries validate constraint mood_entries_note_encryption_grouped;
alter table public.mood_entries validate constraint mood_entries_key_version_positive;

alter table public.trusted_contacts
  add column if not exists is_primary boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists permission_acknowledged_at timestamptz,
  add column if not exists preferred_locale text;
alter table public.trusted_contacts
  add constraint trusted_contacts_verified_has_timestamp
    check (not verified or verified_at is not null) not valid;
alter table public.trusted_contacts validate constraint trusted_contacts_verified_has_timestamp;
create unique index if not exists trusted_contacts_one_primary_per_user_idx
  on public.trusted_contacts (user_id) where is_primary;

alter table public.notifications
  add column if not exists resource_type text,
  add column if not exists resource_id uuid;

create table if not exists public.analysis_windows (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.journal_analyses (id) on delete cascade,
  window_index integer not null,
  token_count integer not null default 0 check (token_count >= 0),
  predicted_score smallint check (predicted_score between 0 and 24),
  urgent_language_detected boolean not null default false,
  processing_time_ms integer check (processing_time_ms is null or processing_time_ms >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, window_index),
  check (window_index >= 0)
);

create table if not exists public.analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.journal_analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_rating smallint not null check (feedback_rating between 1 and 5),
  corrected_score smallint check (corrected_score between 0 and 24),
  comment_ciphertext bytea,
  encryption_iv bytea,
  encryption_auth_tag bytea,
  encryption_key_version smallint,
  consent_for_model_improvement boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (analysis_id, user_id),
  check (
    (comment_ciphertext is null and encryption_iv is null and encryption_auth_tag is null and encryption_key_version is null)
    or (comment_ciphertext is not null and encryption_iv is not null and encryption_auth_tag is not null and encryption_key_version is not null)
  ),
  check (encryption_key_version is null or encryption_key_version > 0)
);

create table if not exists public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  journal_id uuid references public.journals (id) on delete set null,
  analysis_id uuid references public.journal_analyses (id) on delete set null,
  safety_level text not null check (safety_level in ('low', 'medium', 'high')),
  detection_source text not null,
  matched_rule_id text,
  crisis_message_shown boolean not null default false,
  support_resources_shown boolean not null default false,
  trusted_contact_option_shown boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (journal_id is not null or analysis_id is not null)
);

create table if not exists public.support_resources (
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

create table if not exists public.safety_event_resources (
  safety_event_id uuid not null references public.safety_events (id) on delete cascade,
  support_resource_id uuid not null references public.support_resources (id) on delete restrict,
  clicked_at timestamptz,
  primary key (safety_event_id, support_resource_id)
);

create table if not exists public.buddy_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title_ciphertext bytea,
  encryption_iv bytea,
  encryption_auth_tag bytea,
  encryption_key_version smallint,
  conversation_status text not null default 'active' check (conversation_status in ('active', 'archived')),
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (title_ciphertext is null and encryption_iv is null and encryption_auth_tag is null and encryption_key_version is null)
    or (title_ciphertext is not null and encryption_iv is not null and encryption_auth_tag is not null and encryption_key_version is not null)
  )
);

create table if not exists public.buddy_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.buddy_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model_version_id uuid references public.model_versions (id) on delete restrict,
  message_role text not null check (message_role in ('user', 'assistant', 'system')),
  content_ciphertext bytea not null,
  encryption_iv bytea not null,
  encryption_auth_tag bytea not null,
  encryption_key_version smallint not null check (encryption_key_version > 0),
  input_token_count integer check (input_token_count is null or input_token_count >= 0),
  output_token_count integer check (output_token_count is null or output_token_count >= 0),
  processing_time_ms integer check (processing_time_ms is null or processing_time_ms >= 0),
  urgent_language_detected boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  check (message_role <> 'user' or model_version_id is null)
);

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_status text not null default 'requested' check (request_status in ('requested', 'processing', 'completed', 'failed', 'cancelled')),
  storage_path text,
  failure_code text,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (request_status <> 'completed' or storage_path is not null)
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_status text not null default 'pending' check (request_status in ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default timezone('utc', now()),
  scheduled_for timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (request_status <> 'cancelled' or cancelled_at is not null)
);

alter table public.audit_events
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null;
alter table public.audit_events
  add constraint audit_events_metadata_excludes_sensitive_values
  check (not (metadata ?| array['journal_text', 'content', 'body', 'prompt', 'token', 'ciphertext', 'encryption_key'])) not valid;
alter table public.audit_events validate constraint audit_events_metadata_excludes_sensitive_values;

-- All mutable ERD tables receive a private, non-publicly executable update trigger.
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists journals_set_updated_at on public.journals;
drop trigger if exists trusted_contacts_set_updated_at on public.trusted_contacts;
drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger journals_set_updated_at before update on public.journals for each row execute function private.set_updated_at();
create trigger trusted_contacts_set_updated_at before update on public.trusted_contacts for each row execute function private.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function private.set_updated_at();
create trigger model_versions_set_updated_at before update on public.model_versions for each row execute function private.set_updated_at();
create trigger journal_analyses_set_updated_at before update on public.journal_analyses for each row execute function private.set_updated_at();
create trigger analysis_feedback_set_updated_at before update on public.analysis_feedback for each row execute function private.set_updated_at();
create trigger support_resources_set_updated_at before update on public.support_resources for each row execute function private.set_updated_at();
create trigger buddy_conversations_set_updated_at before update on public.buddy_conversations for each row execute function private.set_updated_at();
create trigger data_export_requests_set_updated_at before update on public.data_export_requests for each row execute function private.set_updated_at();
create trigger account_deletion_requests_set_updated_at before update on public.account_deletion_requests for each row execute function private.set_updated_at();

alter table public.analysis_windows enable row level security;
alter table public.analysis_feedback enable row level security;
alter table public.safety_events enable row level security;
alter table public.support_resources enable row level security;
alter table public.safety_event_resources enable row level security;
alter table public.buddy_conversations enable row level security;
alter table public.buddy_messages enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Replace initial policies that permit private lifecycle or service-managed writes.
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
drop policy if exists journal_analyses_insert_own on public.journal_analyses;
drop policy if exists journal_analyses_update_own on public.journal_analyses;
drop policy if exists journal_analyses_delete_own on public.journal_analyses;
drop policy if exists notification_preferences_delete_own on public.notification_preferences;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_mark_own_read on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id and read_at is null)
  with check ((select auth.uid()) = user_id);

create policy analysis_feedback_select_own on public.analysis_feedback for select to authenticated
  using ((select auth.uid()) = user_id);
create policy analysis_feedback_insert_for_owned_analysis on public.analysis_feedback for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.journal_analyses analysis
      where analysis.id = analysis_id and analysis.user_id = (select auth.uid())
    )
  );
create policy analysis_feedback_update_own on public.analysis_feedback for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy analysis_feedback_delete_own on public.analysis_feedback for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy safety_events_select_own on public.safety_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy support_resources_read_verified_active on public.support_resources for select to anon, authenticated
  using (is_active and is_verified and verification_source is not null and last_verified_at is not null);
create policy safety_event_resources_read_owned on public.safety_event_resources for select to authenticated
  using (exists (
    select 1 from public.safety_events event
    where event.id = safety_event_id and event.user_id = (select auth.uid())
  ));

create policy buddy_conversations_select_own on public.buddy_conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy buddy_conversations_insert_own on public.buddy_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy buddy_conversations_update_own on public.buddy_conversations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy buddy_conversations_delete_own on public.buddy_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy buddy_messages_select_from_owned_conversation on public.buddy_messages for select to authenticated
  using (exists (
    select 1 from public.buddy_conversations conversation
    where conversation.id = conversation_id and conversation.user_id = (select auth.uid())
  ));
create policy buddy_messages_insert_user_role_only on public.buddy_messages for insert to authenticated
  with check (
    message_role = 'user'
    and model_version_id is null
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.buddy_conversations conversation
      where conversation.id = conversation_id and conversation.user_id = (select auth.uid())
    )
  );

create policy data_export_requests_select_own on public.data_export_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy data_export_requests_insert_own on public.data_export_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and storage_path is null and request_status = 'requested');
create policy account_deletion_requests_select_own on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy account_deletion_requests_insert_own on public.account_deletion_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and request_status = 'pending');
create policy account_deletion_requests_cancel_own_pending on public.account_deletion_requests for update to authenticated
  using ((select auth.uid()) = user_id and request_status = 'pending')
  with check ((select auth.uid()) = user_id and request_status = 'cancelled' and cancelled_at is not null);

-- Table privileges and column privileges are a second layer beside RLS.
revoke insert, delete on public.profiles from authenticated;
revoke delete on public.notification_preferences from authenticated;
revoke insert, update, delete on public.journal_analyses from authenticated;
revoke update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Prevent browser clients from ever reading or writing legacy plaintext columns.
revoke all on public.journals from authenticated;
grant select (id, user_id, content_ciphertext, encryption_iv, encryption_auth_tag, encryption_key_version,
  journal_status, word_count, language_code, mood, emotions, tags, privacy_status, analysis_consent,
  entry_date, archived_at, analysis_status, created_at, updated_at, deleted_at) on public.journals to authenticated;
grant insert (user_id, content_ciphertext, encryption_iv, encryption_auth_tag, encryption_key_version,
  journal_status, word_count, language_code, mood, emotions, tags, privacy_status, analysis_consent, entry_date, archived_at)
  on public.journals to authenticated;
grant update (content_ciphertext, encryption_iv, encryption_auth_tag, encryption_key_version,
  journal_status, word_count, language_code, mood, emotions, tags, privacy_status, analysis_consent, entry_date, archived_at)
  on public.journals to authenticated;
grant delete on public.journals to authenticated;
revoke all on public.mood_entries from authenticated;
grant select (id, user_id, mood_score, energy_score, anxiety_score, note_ciphertext, encryption_iv,
  encryption_auth_tag, encryption_key_version, recorded_at, created_at) on public.mood_entries to authenticated;
grant insert (user_id, mood_score, energy_score, anxiety_score, note_ciphertext, encryption_iv,
  encryption_auth_tag, encryption_key_version, recorded_at) on public.mood_entries to authenticated;
grant update (mood_score, energy_score, anxiety_score, note_ciphertext, encryption_iv, encryption_auth_tag,
  encryption_key_version, recorded_at) on public.mood_entries to authenticated;
grant delete on public.mood_entries to authenticated;
revoke all on public.model_versions, public.analysis_windows, public.audit_events from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.support_resources to anon, authenticated;
grant select, insert, update, delete on public.analysis_feedback, public.buddy_conversations to authenticated;
grant select, insert on public.buddy_messages, public.data_export_requests to authenticated;
grant select, insert on public.account_deletion_requests to authenticated;
grant update (request_status, cancelled_at) on public.account_deletion_requests to authenticated;
grant select on public.safety_events, public.safety_event_resources to authenticated;

create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);
create index if not exists journal_analyses_journal_created_at_idx on public.journal_analyses (journal_id, created_at desc);
create index if not exists journal_analyses_model_version_id_idx on public.journal_analyses (model_version_id);
create index if not exists analysis_windows_analysis_window_idx on public.analysis_windows (analysis_id, window_index);
create index if not exists analysis_feedback_user_created_at_idx on public.analysis_feedback (user_id, created_at desc);
create index if not exists notifications_user_read_created_at_idx on public.notifications (user_id, read_at, created_at desc);
create index if not exists safety_events_user_created_at_idx on public.safety_events (user_id, created_at desc);
create index if not exists support_resources_lookup_idx on public.support_resources (country_code, region_code, is_active, display_priority);
create index if not exists buddy_conversations_user_last_message_idx on public.buddy_conversations (user_id, last_message_at desc);
create index if not exists buddy_messages_conversation_created_at_idx on public.buddy_messages (conversation_id, created_at);
create index if not exists data_export_requests_user_created_at_idx on public.data_export_requests (user_id, created_at desc);
create index if not exists account_deletion_requests_user_created_at_idx on public.account_deletion_requests (user_id, created_at desc);
create index if not exists audit_events_actor_user_created_at_idx on public.audit_events (actor_user_id, created_at desc);
create unique index if not exists data_export_requests_one_active_per_user_idx
  on public.data_export_requests (user_id)
  where request_status in ('requested', 'processing');
create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on public.account_deletion_requests (user_id)
  where request_status in ('pending', 'processing');
