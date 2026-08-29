-- Narrow service-role-only gateway for the backend. The provisioning schema remains
-- outside the Data API schema allowlist and is never granted to browser roles.

create or replace function public.echo_registration_active_policies()
returns table (
  id uuid,
  document_type text,
  version text,
  title text,
  summary text,
  sanitized_markdown text,
  effective_at timestamptz,
  content_sha256 text
)
language sql
security definer
set search_path = pg_catalog
as $$
  select p.id, p.document_type, p.version, p.title, p.summary,
         p.sanitized_markdown, p.effective_at, p.content_sha256
  from auth_provisioning.policy_documents p
  where p.is_active
  order by p.document_type
$$;

create or replace function public.echo_registration_get_draft(draft_token_hash text)
returns setof auth_provisioning.signup_drafts
language sql
security definer
set search_path = pg_catalog
as $$
  select d.*
  from auth_provisioning.signup_drafts d
  where d.token_hash = draft_token_hash
    and d.expires_at > statement_timestamp()
    and d.consumed_at is null
  limit 1
$$;

create or replace function public.echo_registration_create_draft(
  new_token_hash text,
  new_csrf_hash text,
  new_rule_version text,
  new_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare created_id uuid;
begin
  insert into auth_provisioning.signup_drafts (
    token_hash, csrf_hash, state, eligible_18_plus, eligibility_verified_at,
    eligibility_rule_version, expires_at
  ) values (
    new_token_hash, new_csrf_hash, 'agreements', true, statement_timestamp(),
    new_rule_version, new_expires_at
  ) returning id into created_id;
  return created_id;
end
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
    'optional_ai_analysis_enabled', 'email', 'reservation_id',
    'verification_sent_at', 'google_nonce_hash', 'google_sub', 'google_bound_at'
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
    google_nonce_hash = case when changes ? 'google_nonce_hash' then changes->>'google_nonce_hash' else d.google_nonce_hash end,
    google_sub = case when changes ? 'google_sub' then changes->>'google_sub' else d.google_sub end,
    google_bound_at = case when changes ? 'google_bound_at' then (changes->>'google_bound_at')::timestamptz else d.google_bound_at end,
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

revoke all on function public.echo_registration_active_policies() from public, anon, authenticated;
revoke all on function public.echo_registration_get_draft(text) from public, anon, authenticated;
revoke all on function public.echo_registration_create_draft(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.echo_registration_update_draft(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.echo_registration_active_policies() to service_role;
grant execute on function public.echo_registration_get_draft(text) to service_role;
grant execute on function public.echo_registration_create_draft(text, text, text, timestamptz) to service_role;
grant execute on function public.echo_registration_update_draft(uuid, text, text, jsonb) to service_role;
