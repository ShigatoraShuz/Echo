-- Forward-port secure registration and onboarding into the canonical public
-- table model. The abandoned schema-per-service migrations from main are not
-- replayed; access remains partitioned by restricted service roles.

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists eligible_18_plus boolean,
  add column if not exists eligibility_verified_at timestamptz,
  add column if not exists eligibility_rule_version text,
  add column if not exists eligibility_source text,
  add column if not exists preferred_name text,
  add column if not exists gender_identity text,
  add column if not exists gender_self_description text,
  add column if not exists pronouns text,
  add column if not exists pronouns_self_description text,
  add column if not exists starting_mood_preference text,
  add column if not exists onboarding_step smallint not null default 0,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_account_status_allowed;
alter table public.profiles add constraint profiles_account_status_allowed
  check (account_status in ('active', 'suspended', 'disabled', 'deleted'));
alter table public.profiles drop constraint if exists profiles_onboarding_step_allowed;
alter table public.profiles add constraint profiles_onboarding_step_allowed check (onboarding_step between 0 and 3);
alter table public.profiles drop constraint if exists profiles_starting_mood_allowed;
alter table public.profiles add constraint profiles_starting_mood_allowed
  check (starting_mood_preference is null or starting_mood_preference in ('calm', 'happy', 'neutral', 'sad', 'anxious', 'angry'));

create table public.registration_settings (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.registration_settings (singleton) values (true) on conflict do nothing;

create table public.registration_policy_documents (
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
create unique index registration_policy_one_active_type_idx
  on public.registration_policy_documents (document_type) where is_active;

create table public.registration_drafts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  csrf_hash text not null check (csrf_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('agreements', 'account', 'verification_pending', 'consumed')),
  eligible_18_plus boolean not null default true,
  eligibility_verified_at timestamptz not null,
  eligibility_rule_version text not null,
  terms_document_id uuid references public.registration_policy_documents(id),
  privacy_document_id uuid references public.registration_policy_documents(id),
  ai_notice_document_id uuid references public.registration_policy_documents(id),
  required_agreements_accepted_at timestamptz,
  optional_ai_analysis_enabled boolean not null default false,
  email text,
  google_sub text,
  google_nonce_hash text,
  google_bound_at timestamptz,
  reservation_id uuid unique,
  auth_user_id uuid,
  verification_sent_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index registration_drafts_expiry_idx on public.registration_drafts (expires_at) where consumed_at is null;
create index registration_drafts_google_idx on public.registration_drafts (google_sub) where consumed_at is null;

alter table public.registration_settings enable row level security;
alter table public.registration_policy_documents enable row level security;
alter table public.registration_drafts enable row level security;
revoke all on public.registration_settings, public.registration_policy_documents, public.registration_drafts from public, anon, authenticated;
revoke all on public.registration_settings, public.registration_drafts from user_service_role;
grant select on public.registration_policy_documents to user_service_role;

create or replace function public.echo_registration_active_policies()
returns table (
  id uuid, document_type text, version text, title text, summary text,
  sanitized_markdown text, effective_at timestamptz, content_sha256 text
)
language sql security definer stable set search_path = '' as $$
  select p.id, p.document_type, p.version, p.title, p.summary,
         p.sanitized_markdown, p.effective_at, p.content_sha256
  from public.registration_policy_documents p
  where p.is_active
  order by p.document_type
$$;

create or replace function public.echo_registration_get_draft(draft_token_hash text)
returns setof public.registration_drafts
language sql security definer stable set search_path = '' as $$
  select d.* from public.registration_drafts d
  where d.token_hash = draft_token_hash
    and d.expires_at > statement_timestamp()
    and d.consumed_at is null
  limit 1
$$;

create or replace function public.echo_registration_create_draft(
  new_token_hash text, new_csrf_hash text, new_rule_version text, new_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  insert into public.registration_drafts (
    token_hash, csrf_hash, state, eligibility_verified_at, eligibility_rule_version, expires_at
  ) values (
    new_token_hash, new_csrf_hash, 'agreements', statement_timestamp(), new_rule_version, new_expires_at
  ) returning id into created_id;
  return created_id;
end
$$;

create or replace function public.echo_registration_update_draft(
  draft_id uuid, expected_token_hash text, expected_state text, changes jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if changes - array[
    'state', 'token_hash', 'csrf_hash', 'terms_document_id', 'privacy_document_id',
    'ai_notice_document_id', 'required_agreements_accepted_at', 'optional_ai_analysis_enabled',
    'email', 'reservation_id', 'verification_sent_at', 'google_nonce_hash', 'google_sub', 'google_bound_at'
  ] <> '{}'::jsonb then
    raise exception 'Unsupported signup draft field';
  end if;

  update public.registration_drafts d set
    state = case when changes ? 'state' then changes->>'state' else d.state end,
    token_hash = case when changes ? 'token_hash' then changes->>'token_hash' else d.token_hash end,
    csrf_hash = case when changes ? 'csrf_hash' then changes->>'csrf_hash' else d.csrf_hash end,
    terms_document_id = case when changes ? 'terms_document_id' then (changes->>'terms_document_id')::uuid else d.terms_document_id end,
    privacy_document_id = case when changes ? 'privacy_document_id' then (changes->>'privacy_document_id')::uuid else d.privacy_document_id end,
    ai_notice_document_id = case when changes ? 'ai_notice_document_id' then (changes->>'ai_notice_document_id')::uuid else d.ai_notice_document_id end,
    required_agreements_accepted_at = case when changes ? 'required_agreements_accepted_at' then (changes->>'required_agreements_accepted_at')::timestamptz else d.required_agreements_accepted_at end,
    optional_ai_analysis_enabled = case when changes ? 'optional_ai_analysis_enabled' then (changes->>'optional_ai_analysis_enabled')::boolean else d.optional_ai_analysis_enabled end,
    email = case when changes ? 'email' then lower(changes->>'email') else d.email end,
    reservation_id = case when changes ? 'reservation_id' then (changes->>'reservation_id')::uuid else d.reservation_id end,
    verification_sent_at = case when changes ? 'verification_sent_at' then (changes->>'verification_sent_at')::timestamptz else d.verification_sent_at end,
    google_nonce_hash = case when changes ? 'google_nonce_hash' then changes->>'google_nonce_hash' else d.google_nonce_hash end,
    google_sub = case when changes ? 'google_sub' then changes->>'google_sub' else d.google_sub end,
    google_bound_at = case when changes ? 'google_bound_at' then (changes->>'google_bound_at')::timestamptz else d.google_bound_at end,
    updated_at = statement_timestamp()
  where d.id = draft_id and d.token_hash = expected_token_hash and d.state = expected_state
    and d.expires_at > statement_timestamp() and d.consumed_at is null;
  get diagnostics affected = row_count;
  return affected = 1;
end
$$;

create or replace function public.echo_google_identity_status(google_subject text, verified_email text)
returns table (status text, user_id uuid)
language sql security definer stable set search_path = '' as $$
  select case
    when exists (select 1 from auth.identities i where i.provider = 'google' and i.provider_id = google_subject)
      then 'existing_google_identity'
    when exists (select 1 from auth.users u where lower(u.email) = lower(verified_email))
      then 'password_account_requires_link'
    else 'no_existing_account'
  end,
  (select i.user_id from auth.identities i where i.provider = 'google' and i.provider_id = google_subject limit 1)
$$;

revoke all on function public.echo_registration_active_policies() from public, anon, authenticated;
revoke all on function public.echo_registration_get_draft(text) from public, anon, authenticated;
revoke all on function public.echo_registration_create_draft(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.echo_registration_update_draft(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.echo_google_identity_status(text, text) from public, anon, authenticated;
grant execute on function public.echo_registration_active_policies() to user_service_role;
grant execute on function public.echo_registration_get_draft(text) to user_service_role;
grant execute on function public.echo_registration_create_draft(text, text, text, timestamptz) to user_service_role;
grant execute on function public.echo_registration_update_draft(uuid, text, text, jsonb) to user_service_role;
grant execute on function public.echo_google_identity_status(text, text) to user_service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  enforce boolean;
  reservation uuid;
  provider text;
  incoming_google_sub text;
  draft public.registration_drafts%rowtype;
  recorded_at timestamptz := timezone('utc', now());
begin
  select enforcement_enabled into enforce from public.registration_settings where singleton;
  reservation := nullif(new.raw_user_meta_data->>'signup_reservation', '')::uuid;
  provider := coalesce(new.raw_app_meta_data->>'provider', '');
  incoming_google_sub := coalesce(new.raw_user_meta_data->>'sub', new.raw_user_meta_data->>'provider_id');

  select * into draft from public.registration_drafts d
  where (provider = 'email' and reservation is not null and d.reservation_id = reservation)
     or (provider = 'google' and d.google_sub = incoming_google_sub and d.google_bound_at is not null)
  order by d.google_bound_at desc nulls last limit 1 for update;

  if not found then
    if coalesce(enforce, false) then raise exception 'Approved ECHO registration is required.'; end if;
    insert into public.profiles (id, display_name) values (new.id, nullif(btrim(new.raw_user_meta_data->>'display_name'), '')) on conflict (id) do nothing;
    insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
    insert into public.privacy_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
    return new;
  end if;

  if draft.expires_at <= recorded_at or draft.consumed_at is not null or not draft.eligible_18_plus
     or draft.required_agreements_accepted_at is null or draft.auth_user_id is not null
     or lower(coalesce(new.email, '')) <> lower(coalesce(draft.email, ''))
     or (provider = 'email' and draft.state <> 'verification_pending')
     or (provider = 'google' and draft.state <> 'account') then
    raise exception 'Registration draft is invalid or expired.';
  end if;
  if (select count(*) from public.registration_policy_documents p
      where p.is_active and p.id in (draft.terms_document_id, draft.privacy_document_id, draft.ai_notice_document_id)) <> 3 then
    raise exception 'Current registration policies must be reviewed.';
  end if;

  insert into public.profiles (
    id, display_name, eligible_18_plus, eligibility_verified_at, eligibility_rule_version, eligibility_source
  ) values (
    new.id, nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), true,
    draft.eligibility_verified_at, draft.eligibility_rule_version, 'signup_age_gate'
  ) on conflict (id) do update set
    eligible_18_plus = excluded.eligible_18_plus,
    eligibility_verified_at = excluded.eligibility_verified_at,
    eligibility_rule_version = excluded.eligibility_rule_version,
    eligibility_source = excluded.eligibility_source;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.privacy_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  insert into public.user_consents (user_id, consent_type, consent_version, accepted, accepted_at, source)
  select new.id,
    case p.document_type when 'privacy_notice' then 'privacy_policy' when 'ai_analysis_notice' then 'ai_feature_notice' else p.document_type end,
    p.version, true, recorded_at, 'secure_signup'
  from public.registration_policy_documents p
  where p.id in (draft.terms_document_id, draft.privacy_document_id, draft.ai_notice_document_id)
  on conflict (user_id, consent_type, consent_version) do update set accepted = true, accepted_at = excluded.accepted_at, revoked_at = null;

  insert into public.user_consents (user_id, consent_type, consent_version, accepted, accepted_at, source)
  select new.id, 'journal_analysis', p.version, draft.optional_ai_analysis_enabled,
    case when draft.optional_ai_analysis_enabled then recorded_at end, 'secure_signup'
  from public.registration_policy_documents p where p.id = draft.ai_notice_document_id
  on conflict (user_id, consent_type, consent_version) do update set
    accepted = excluded.accepted, accepted_at = excluded.accepted_at,
    revoked_at = case when excluded.accepted then null else recorded_at end;

  -- Email identities exist before the confirmation link is followed. Preserve
  -- that draft until expiry so the signed status/resend flow remains usable.
  -- Google identities are verified at creation and can be consumed at once.
  if provider = 'google' then
    update public.registration_drafts set
      state = 'consumed', consumed_at = recorded_at, google_nonce_hash = null, auth_user_id = new.id,
      token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
      csrf_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), updated_at = recorded_at
    where id = draft.id;
  else
    update public.registration_drafts set updated_at = recorded_at, auth_user_id = new.id where id = draft.id;
  end if;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

with policy_rows(document_type, version, title, summary, body) as (
  values
    ('terms_of_use', '2026-09-04.1', 'Terms of Use', 'How to use ECHO safely and responsibly.',
     $policy$## Purpose and scope

ECHO provides private journaling, reflection, and wellbeing-support features. Read these terms with the Privacy Notice and AI Analysis Notice. Your acknowledgement is linked to the document version displayed when you accept it.

ECHO is not a healthcare provider, diagnostic tool, treatment, or emergency-response service. Do not use it to decide whether an urgent situation is safe or to replace qualified professional care.

## Eligibility and your account

Accounts are intended for adults aged 18 and over. Provide accurate eligibility and verification information. Protected features require an active eligible account, current policy acknowledgements, and completed onboarding. AI features also require identity verification and their applicable permissions.

Keep passwords, verification codes, tokens, and session links private. Sign out on shared devices. Google sign-in is optional, depends on provider configuration, and does not replace eligibility checks or enable analysis consent. An existing password account must use its established sign-in method unless a supported linking process is provided.

## Your content and responsibilities

You decide what to save. Avoid unnecessary private information about others and material you lack permission to use. Do not impersonate another person, disrupt services, distribute malicious content, or bypass account and service permissions.

Saving, requesting analysis, and deleting are distinct actions. Check each operation's actual response. An unsaved draft or progress indicator is not proof of a successful save. Keep independent copies of information you cannot afford to lose.

## Optional analysis

You can journal without AI analysis. Acknowledging the AI notice does not grant optional analysis permission. Processing requires account-level consent, consent saved on the selected entry, and an explicit analysis request.

Analysis Service orchestrates self-hosted ML and Recommendation Service. Validated model artifacts are separately required. Unavailable inference produces an error, not a fabricated result. Outputs may be incomplete or incorrect and are not clinical findings or individualized treatment.

## Safety and support

ECHO does not continuously monitor users, guarantee risk detection, dispatch help, or promise a response time. Buddy and grounding activities are optional wellbeing support. Trusted contacts are an address book for user-initiated contact; ECHO does not automatically notify them.

If there is immediate danger, contact local emergency services or a trusted person directly. Do not wait for ECHO. Support-resource availability can change.

## Privacy, availability, and changes

Authorized services can decrypt journal content to provide requested features; encryption is not a promise that the server cannot read it. Exported files leave ECHO's access controls. Journal deletion and account-deletion requests are separate; review their actual status and the Privacy Notice.

Services may be unavailable during maintenance, development, or infrastructure failure. Required policy revisions are versioned and require review; accepting an older version does not acknowledge a new one.

For questions, use the support channel supplied by your deployment operator without sending passwords or unnecessary journal text. These terms make no claim of clinical approval or regulatory certification. Optional analysis permission remains a separate choice.$policy$),
    ('privacy_notice', '2026-09-04.1', 'Privacy Notice', 'What ECHO stores and the controls available to you.',
     $policy$## Information ECHO uses

ECHO stores the information needed for account access and the features you use: identity/session details, profile and onboarding preferences, policy acknowledgements, optional permissions, journals and drafts, mood or assessment records, Buddy conversations, grounding sessions, notifications, and export or deletion requests.

Age eligibility is derived from the birthday you submit; the registration draft records the eligibility outcome rather than retaining the birthday. Temporary signup drafts contain hashed browser credentials, current policy identifiers, and email or verified Google identity bindings. Drafts expire, but expiry alone does not physically erase a database row.

Identity verification may require application details and private evidence files. Reviewers access evidence through the authorized verification workflow and short-lived file links. Account identity verification is separate from journal-analysis consent.

## Access and encryption

Supabase Auth handles identity and sessions. Protected application data passes through the API Gateway to the service that owns that domain. The services share one physical database with canonical public tables, restricted service roles, and separate credentials. Browser credentials cannot directly query protected tables.

Journal payloads and other configured sensitive content are encrypted at rest. Authorized services hold the keys necessary to decrypt content for requested operations. This is not end-to-end encryption and does not mean the server can never read journal text. Verification files are private; avatars use a separate restricted storage path.

## Optional processing

Analysis requires account-level optional permission, entry consent, and an explicit request. Journal Service supplies the selected decrypted journal to Analysis Service and the self-hosted ML Service. Recommendation Service receives the screening severity and urgent-language flag, not the journal text. Declining optional analysis does not prevent ordinary journaling.

Saved analysis records contain status, screening results when available, timestamps, and failure information. Withdrawing permission prevents subsequent authorized analysis requests; it does not itself erase earlier results or cancel a request already in progress.

## Your controls and exports

Settings let you update supported profile, privacy, and notification preferences and maintain trusted contact details. ECHO does not automatically contact those people or share reflections with them.

The journal PDF export is generated in your browser from your journal history and self-reported moods. It is not a complete database archive. Downloaded files can be read by anyone with access to them, even if a watermark says private. Store and share them carefully.

## Deletion and retention

Journal deletion removes the selected journal through Journal Service and its database relationships. There is no supported recoverable journal trash or promised 30-day journal retention period in this implementation.

Account deletion is a tracked request, not proof that all records have already been removed. Operator handling, backups, audit requirements, and infrastructure retention can affect completion. Consult the deployment operator about retention and backup policies before storing information that requires a particular erasure guarantee.

## Operational limits and questions

Services use request identifiers, status codes, and audit records for security and operation. Do not put credentials or unnecessary journal content into support reports. ECHO is not an emergency monitoring service and does not promise that a human reviews your content.

This notice describes repository behavior, not a legal compliance certification. The operator must supply deployment-specific contact, hosting, retention, and privacy information. Changes to required notices are versioned and presented for acknowledgement.$policy$),
    ('ai_analysis_notice', '2026-09-04.1', 'AI Analysis Notice', 'How optional self-hosted analysis works and where its limits are.',
     $policy$## At a glance

AI-assisted journal analysis is optional. ECHO supports reflection and wellbeing; it is not a medical service, diagnostic tool, or emergency monitoring system. Read this notice with the Privacy Notice and Terms of Use. The displayed version identifies your acknowledgement.

## Separate choices

Reading or acknowledging this notice does not enable analysis. Processing requires active account-level journal-analysis consent, consent saved with the selected journal, and an explicit analysis request. The account must also pass current access and identity-verification checks.

You can leave analysis off during registration and change the optional permission in Settings. Enabling it does not automatically process earlier journals. Turning it off does not delete existing results or guarantee cancellation of an already-running request.

## Actual processing path

The browser requests analysis through the API Gateway. Analysis Service checks User Service authorization, obtains the selected journal text and consent from Journal Service, calls self-hosted ML inference, and asks Recommendation Service for structured next steps.

Journal text is decrypted for this requested processing. Recommendation Service receives severity and an urgent-language flag rather than journal text. There is no supported facial analysis, camera capture, MediaPipe processing, external job-claim worker, or automatic trusted-contact notification in this architecture.

## Availability and failure

Validated model artifacts are required separately. A live service health check does not mean inference is ready. When artifacts are unavailable, readiness and inference report controlled unavailability. Production never substitutes simulated scores.

The API records processing, completed, or failed analysis status. Network and dependency failures can prevent completion. A failed analysis does not remove the saved journal. You may retry later; an onscreen waiting indicator is not a result.

## Limits of results

The model estimates a PHQ-8-style screening score and severity from writing and may flag urgent language. These are not answers you personally supplied to a PHQ-8 questionnaire, clinical findings, diagnoses, or predictions of safety. AI can misinterpret context, language, irony, or missing information. A low score does not establish that someone is safe.

Recommendation Service provides optional reflective activities and support information, not individualized treatment. You may disregard a suggestion or stop using analysis. Discuss concerns with a qualified professional.

## Safety and your control

ECHO does not guarantee identification of danger, human review, emergency dispatch, or a response time. Do not wait for an analysis if you need help now; contact local emergency services or someone you trust directly.

Saved results and deletion are described in the Privacy Notice. For questions about model validation or deployment-specific data handling, ask the operator before enabling analysis. No clinical approval or guaranteed model accuracy is claimed.$policy$)
), inserted as (
  insert into public.registration_policy_documents (
    document_type, version, title, summary, sanitized_markdown, content_sha256, effective_at, is_active, activated_at
  )
  select document_type, version, title, summary, body,
    encode(extensions.digest(body, 'sha256'), 'hex'), '2026-09-04T00:00:00Z', true, timezone('utc', now())
  from policy_rows
  on conflict (document_type, version) do update set sanitized_markdown = excluded.sanitized_markdown
  returning document_type
)
update public.registration_policy_documents p set is_active = false, retired_at = timezone('utc', now())
where p.version <> '2026-09-04.1' and p.is_active
  and exists (select 1 from inserted);

-- Browser roles stay denied even if broad grants are added elsewhere later.
revoke all on public.registration_settings, public.registration_policy_documents, public.registration_drafts from anon, authenticated;
