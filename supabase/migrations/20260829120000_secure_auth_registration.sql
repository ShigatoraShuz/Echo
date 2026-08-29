-- Secure, draft-backed authentication and policy provisioning.
-- Enforcement intentionally ships disabled. Enable only after the hook payload has
-- been validated in staging and the compatible backend/frontend are deployed.

create schema if not exists auth_provisioning;
revoke all on schema auth_provisioning from public, anon, authenticated;

create table auth_provisioning.settings (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into auth_provisioning.settings (singleton) values (true) on conflict do nothing;

create table auth_provisioning.policy_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms_of_use', 'privacy_notice', 'ai_analysis_notice')),
  version text not null,
  title text not null,
  summary text not null,
  sanitized_markdown text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  effective_at timestamptz not null,
  published_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  retired_at timestamptz,
  is_active boolean not null default false,
  unique (document_type, version)
);
create unique index policy_documents_one_active_type_idx
  on auth_provisioning.policy_documents (document_type) where is_active;

create table auth_provisioning.signup_drafts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  csrf_hash text not null check (csrf_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('eligibility', 'agreements', 'account', 'verification_pending', 'ready', 'consumed')),
  encrypted_birth_date text,
  eligible_18_plus boolean,
  eligibility_verified_at timestamptz,
  eligibility_rule_version text,
  terms_document_id uuid references auth_provisioning.policy_documents(id),
  privacy_document_id uuid references auth_provisioning.policy_documents(id),
  ai_notice_document_id uuid references auth_provisioning.policy_documents(id),
  required_agreements_accepted_at timestamptz,
  optional_ai_analysis_enabled boolean not null default false,
  email text,
  google_sub text,
  google_nonce_hash text,
  google_bound_at timestamptz,
  reservation_id uuid unique,
  reserved_at timestamptz,
  verification_sent_at timestamptz,
  verification_completed_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (consumed_at is null or state = 'consumed')
);
create index signup_drafts_expiry_idx on auth_provisioning.signup_drafts (expires_at) where consumed_at is null;
create index signup_drafts_google_sub_idx on auth_provisioning.signup_drafts (google_sub) where consumed_at is null;

alter table user_service.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'disabled', 'deleted')),
  add column if not exists eligible_18_plus boolean,
  add column if not exists eligibility_verified_at timestamptz,
  add column if not exists eligibility_rule_version text,
  add column if not exists eligibility_source text,
  add column if not exists preferred_name text,
  add column if not exists gender_identity text,
  add column if not exists gender_self_description text,
  add column if not exists pronouns text,
  add column if not exists pronouns_self_description text,
  add column if not exists onboarding_step smallint not null default 0 check (onboarding_step between 0 and 3),
  add column if not exists onboarding_completed_at timestamptz;

alter table user_service.privacy_preferences
  add column if not exists journal_ai_analysis_enabled boolean not null default false;

create or replace function auth_provisioning.activate_policy_set(
  terms_id uuid,
  privacy_id uuid,
  ai_notice_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_count integer;
  activation_time timestamptz := timezone('utc', now());
begin
  select count(*) into selected_count
  from auth_provisioning.policy_documents
  where (id = terms_id and document_type = 'terms_of_use')
     or (id = privacy_id and document_type = 'privacy_notice')
     or (id = ai_notice_id and document_type = 'ai_analysis_notice');
  if selected_count <> 3 then
    raise exception 'A complete valid policy set is required.';
  end if;

  update auth_provisioning.policy_documents
  set is_active = false, retired_at = activation_time
  where is_active;
  update auth_provisioning.policy_documents
  set is_active = true, activated_at = activation_time, retired_at = null
  where id in (terms_id, privacy_id, ai_notice_id);
end;
$$;
revoke all on function auth_provisioning.activate_policy_set(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.echo_google_identity_status(google_subject text, verified_email text)
returns table (status text, user_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from auth.identities i
      where i.provider = 'google' and i.provider_id = google_subject
    ) then 'existing_google_identity'
    when exists (
      select 1 from auth.users u where lower(u.email) = lower(verified_email)
    ) then 'password_account_requires_link'
    else 'no_existing_account'
  end,
  (select i.user_id from auth.identities i
   where i.provider = 'google' and i.provider_id = google_subject limit 1);
$$;
revoke all on function public.echo_google_identity_status(text, text) from public, anon, authenticated;
grant execute on function public.echo_google_identity_status(text, text) to service_role;

create or replace function auth_provisioning.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  enforce boolean;
  reservation uuid;
  provider text;
  incoming_google_sub text;
  draft auth_provisioning.signup_drafts%rowtype;
begin
  select enforcement_enabled into enforce from auth_provisioning.settings where singleton;
  if not coalesce(enforce, false) then return '{}'::jsonb; end if;

  reservation := nullif(event->'user'->'user_metadata'->>'signup_reservation', '')::uuid;
  provider := coalesce(event->'user'->'app_metadata'->>'provider', '');
  incoming_google_sub := coalesce(
    event->'user'->'identities'->0->'identity_data'->>'sub',
    event->'user'->'user_metadata'->>'sub'
  );

  select * into draft from auth_provisioning.signup_drafts
  where (reservation is not null and reservation_id = reservation)
     or (provider = 'google' and google_sub = incoming_google_sub and google_bound_at is not null)
  order by google_bound_at desc nulls last limit 1 for update;
  if not found or draft.expires_at <= timezone('utc', now()) or draft.consumed_at is not null
     or draft.eligible_18_plus is not true or draft.required_agreements_accepted_at is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Approved ECHO registration is required.'));
  end if;
  if provider = 'google' and (draft.google_sub is null or incoming_google_sub is distinct from draft.google_sub) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Google registration binding could not be verified.'));
  end if;
  update auth_provisioning.signup_drafts set reserved_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = draft.id;
  return '{}'::jsonb;
end;
$$;

create or replace function auth_provisioning.provision_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enforce boolean;
  reservation uuid;
  provider text;
  incoming_google_sub text;
  draft auth_provisioning.signup_drafts%rowtype;
  recorded_at timestamptz := timezone('utc', now());
begin
  select enforcement_enabled into enforce from auth_provisioning.settings where singleton;
  reservation := nullif(new.raw_user_meta_data->>'signup_reservation', '')::uuid;
  provider := coalesce(new.raw_app_meta_data->>'provider', '');
  incoming_google_sub := coalesce(new.raw_user_meta_data->>'sub', new.raw_user_meta_data->>'provider_id');

  select * into draft from auth_provisioning.signup_drafts
  where (reservation is not null and reservation_id = reservation)
     or (provider = 'google' and google_sub = incoming_google_sub and google_bound_at is not null)
  order by google_bound_at desc nulls last limit 1 for update;
  if not found and not coalesce(enforce, false) then return new; end if;
  if not found or draft.expires_at <= recorded_at or draft.consumed_at is not null
     or draft.eligible_18_plus is not true or draft.required_agreements_accepted_at is null then
    raise exception 'Registration draft is invalid or expired.';
  end if;
  if not exists (
    select 1 from auth_provisioning.policy_documents p
    where p.is_active and p.id in (draft.terms_document_id, draft.privacy_document_id, draft.ai_notice_document_id)
    group by p.is_active having count(*) = 3
  ) then raise exception 'Policy review is no longer current.'; end if;

  insert into user_service.profiles (
    user_id, display_name, eligible_18_plus, eligibility_verified_at,
    eligibility_rule_version, eligibility_source
  ) values (
    new.id, '', true, draft.eligibility_verified_at,
    draft.eligibility_rule_version, 'signup_age_gate'
  );
  insert into user_service.notification_preferences (user_id) values (new.id);
  insert into user_service.privacy_preferences (user_id, journal_ai_analysis_enabled)
    values (new.id, draft.optional_ai_analysis_enabled);
  insert into user_service.user_consents (user_id, consent_type, consent_version, accepted, accepted_at, source)
  select new.id, p.document_type, p.version, true, recorded_at, 'secure_signup'
  from auth_provisioning.policy_documents p
  where p.id in (draft.terms_document_id, draft.privacy_document_id, draft.ai_notice_document_id);

  update auth_provisioning.signup_drafts set
    state = 'consumed', consumed_at = recorded_at, encrypted_birth_date = null,
    google_nonce_hash = null, token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    csrf_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), updated_at = recorded_at
  where id = draft.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function auth_provisioning.provision_new_user();

grant usage on schema auth_provisioning to supabase_auth_admin;
grant execute on function auth_provisioning.before_user_created(jsonb) to supabase_auth_admin;
grant select on auth_provisioning.settings to supabase_auth_admin;
grant select, update on auth_provisioning.signup_drafts to supabase_auth_admin;
revoke all on all tables in schema auth_provisioning from public, anon, authenticated;
revoke all on all functions in schema auth_provisioning from public, anon, authenticated;

-- Initial sanitized Markdown policy set. Replace through immutable version inserts,
-- then activate all three documents with activate_policy_set in one transaction.
with inserted as (
  insert into auth_provisioning.policy_documents
    (document_type, version, title, summary, sanitized_markdown, content_sha256, effective_at)
  values
    ('terms_of_use', '2026-08-29', 'Terms of Use', 'How to use ECHO safely and responsibly.',
     '## Purpose\nECHO is a private reflection and wellbeing support tool.\n\n## Not medical care\nECHO is not diagnosis, treatment, emergency monitoring, or a substitute for professional care.\n\n## Your responsibilities\nKeep your account secure and use ECHO lawfully.', encode(extensions.digest('terms-2026-08-29', 'sha256'), 'hex'), '2026-08-29T00:00:00Z'),
    ('privacy_notice', '2026-08-29', 'Privacy Notice', 'What ECHO stores and the controls available to you.',
     '## Information ECHO uses\nECHO stores account data, settings, and reflections needed to provide the service.\n\n## Private reflections\nJournal content is treated as sensitive private data.\n\n## Your controls\nYou can change optional permissions and request export or deletion.', encode(extensions.digest('privacy-2026-08-29', 'sha256'), 'hex'), '2026-08-29T00:00:00Z'),
    ('ai_analysis_notice', '2026-08-29', 'AI Analysis Notice', 'How optional local AI reflection works and where its limits are.',
     '## Optional analysis\nECHO uses a locally hosted language model only for entries you explicitly choose to analyze.\n\n## Limitations\nAI output may be incomplete or incorrect and is not clinical or emergency guidance.\n\n## Your choice\nDeclining optional AI analysis does not prevent account creation or normal journaling.', encode(extensions.digest('ai-2026-08-29', 'sha256'), 'hex'), '2026-08-29T00:00:00Z')
  returning id, document_type
)
select auth_provisioning.activate_policy_set(
  (array_agg(id) filter (where document_type = 'terms_of_use'))[1],
  (array_agg(id) filter (where document_type = 'privacy_notice'))[1],
  (array_agg(id) filter (where document_type = 'ai_analysis_notice'))[1]
) from inserted;

-- Local/staging only after payload verification:
-- [auth.hook.before_user_created]
-- enabled = true
-- uri = "pg-functions://postgres/auth_provisioning/before_user_created"
