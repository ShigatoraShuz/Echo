-- Keep the email draft available for the backend to rotate after Auth creates
-- the user and for a confirmation-email resend. Google signups still consume it.
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

  if provider = 'email' and new.email_confirmed_at is null then
    update auth_provisioning.signup_drafts
    set encrypted_birth_date = null, google_nonce_hash = null, updated_at = recorded_at
    where id = draft.id;
  else
    update auth_provisioning.signup_drafts set
      state = 'consumed', consumed_at = recorded_at, encrypted_birth_date = null,
      google_nonce_hash = null, token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
      csrf_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), updated_at = recorded_at
    where id = draft.id;
  end if;
  return new;
end;
$$;

create or replace function auth_provisioning.consume_confirmed_email_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation uuid;
begin
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then return new; end if;
  reservation := nullif(new.raw_user_meta_data->>'signup_reservation', '')::uuid;
  if reservation is null then return new; end if;

  update auth_provisioning.signup_drafts set
    state = 'consumed', consumed_at = timezone('utc', now()), email = null,
    reservation_id = null, token_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    csrf_hash = encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'), updated_at = timezone('utc', now())
  where reservation_id = reservation and state = 'verification_pending'
    and consumed_at is null and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_email_confirmed_consume_draft on auth.users;
create trigger on_auth_email_confirmed_consume_draft
  after update of email_confirmed_at on auth.users
  for each row execute function auth_provisioning.consume_confirmed_email_signup();
