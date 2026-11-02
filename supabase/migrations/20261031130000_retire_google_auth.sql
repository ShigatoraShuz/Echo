-- Retire Google registration while preserving email signup and confirmation.
-- Existing auth users and identities are intentionally untouched.
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
  draft auth_provisioning.signup_drafts%rowtype;
begin
  provider := coalesce(event->'user'->'app_metadata'->>'provider', '');
  if provider <> 'email' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Email registration is required.'));
  end if;

  select enforcement_enabled into enforce from auth_provisioning.settings where singleton;
  if not coalesce(enforce, false) then return '{}'::jsonb; end if;

  reservation := nullif(event->'user'->'user_metadata'->>'signup_reservation', '')::uuid;
  select * into draft from auth_provisioning.signup_drafts
  where reservation is not null and reservation_id = reservation
  limit 1 for update;
  if not found or draft.expires_at <= timezone('utc', now()) or draft.consumed_at is not null
     or draft.eligible_18_plus is not true or draft.required_agreements_accepted_at is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Approved ECHO registration is required.'));
  end if;
  update auth_provisioning.signup_drafts
  set reserved_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = draft.id;
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
  draft auth_provisioning.signup_drafts%rowtype;
  recorded_at timestamptz := timezone('utc', now());
begin
  if coalesce(new.raw_app_meta_data->>'provider', '') <> 'email' then
    raise exception 'Email registration is required.';
  end if;
  select enforcement_enabled into enforce from auth_provisioning.settings where singleton;
  reservation := nullif(new.raw_user_meta_data->>'signup_reservation', '')::uuid;
  select * into draft from auth_provisioning.signup_drafts
  where reservation is not null and reservation_id = reservation
  limit 1 for update;
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

  if new.email_confirmed_at is null then
    update auth_provisioning.signup_drafts
    set encrypted_birth_date = null, updated_at = recorded_at
    where id = draft.id;
  else
    update auth_provisioning.signup_drafts set
      state = 'consumed', consumed_at = recorded_at, encrypted_birth_date = null,
      token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
      csrf_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), updated_at = recorded_at
    where id = draft.id;
  end if;
  return new;
end;
$$;

create or replace function public.echo_registration_update_draft(
  draft_id uuid,
  expected_token_hash text,
  expected_state text,
  changes jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare affected integer;
begin
  if changes - array[
    'state', 'token_hash', 'csrf_hash', 'terms_document_id', 'privacy_document_id',
    'ai_notice_document_id', 'required_agreements_accepted_at',
    'optional_ai_analysis_enabled', 'email', 'reservation_id', 'verification_sent_at'
  ] <> '{}'::jsonb then
    raise exception 'Unsupported signup draft field';
  end if;

  update auth_provisioning.signup_drafts d set
    state = case when changes ? 'state' then changes->>'state' else d.state end,
    token_hash = case when changes ? 'token_hash' then changes->>'token_hash' else d.token_hash end,
    csrf_hash = case when changes ? 'csrf_hash' then changes->>'csrf_hash' else d.csrf_hash end,
    terms_document_id = case when changes ? 'terms_document_id' then (changes->>'terms_document_id')::uuid else d.terms_document_id end,
    privacy_document_id = case when changes ? 'privacy_document_id' then (changes->>'privacy_document_id')::uuid else d.privacy_document_id end,
    ai_notice_document_id = case when changes ? 'ai_notice_document_id' then (changes->>'ai_notice_document_id')::uuid else d.ai_notice_document_id end,
    required_agreements_accepted_at = case when changes ? 'required_agreements_accepted_at' then (changes->>'required_agreements_accepted_at')::timestamptz else d.required_agreements_accepted_at end,
    optional_ai_analysis_enabled = case when changes ? 'optional_ai_analysis_enabled' then (changes->>'optional_ai_analysis_enabled')::boolean else d.optional_ai_analysis_enabled end,
    email = case when changes ? 'email' then changes->>'email' else d.email end,
    reservation_id = case when changes ? 'reservation_id' then (changes->>'reservation_id')::uuid else d.reservation_id end,
    verification_sent_at = case when changes ? 'verification_sent_at' then (changes->>'verification_sent_at')::timestamptz else d.verification_sent_at end,
    updated_at = statement_timestamp()
  where d.id = draft_id
    and d.token_hash = expected_token_hash
    and d.state = expected_state
    and d.expires_at > statement_timestamp()
    and d.consumed_at is null;
  get diagnostics affected = row_count;
  return affected = 1;
end
$$;

drop function if exists public.echo_google_identity_status(text, text);
drop index if exists auth_provisioning.signup_drafts_google_sub_idx;
alter table auth_provisioning.signup_drafts
  drop column if exists google_sub,
  drop column if exists google_nonce_hash,
  drop column if exists google_bound_at;
