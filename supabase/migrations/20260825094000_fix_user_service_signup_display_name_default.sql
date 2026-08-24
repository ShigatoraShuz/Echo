-- Keep signup bootstrap aligned with user_service.profiles.display_name NOT NULL.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_consent jsonb := coalesce(new.raw_user_meta_data -> 'signup_consent', '{}'::jsonb);
  signup_consent_version text := coalesce(nullif(btrim(signup_consent ->> 'version'), ''), '2026-07-25');
  recorded_at timestamptz := timezone('utc', now());
begin
  insert into user_service.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), ''))
  on conflict (user_id) do nothing;

  insert into user_service.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into user_service.privacy_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into user_service.user_consents (user_id, consent_type, consent_version, accepted, accepted_at, source)
  values
    (new.id, 'terms_of_use', signup_consent_version, signup_consent @> '{"terms_accepted": true}'::jsonb,
      case when signup_consent @> '{"terms_accepted": true}'::jsonb then recorded_at end, 'signup'),
    (new.id, 'privacy_policy', signup_consent_version, signup_consent @> '{"privacy_acknowledged": true}'::jsonb,
      case when signup_consent @> '{"privacy_acknowledged": true}'::jsonb then recorded_at end, 'signup'),
    (new.id, 'data_processing_notice', signup_consent_version, signup_consent @> '{"data_processing_acknowledged": true}'::jsonb,
      case when signup_consent @> '{"data_processing_acknowledged": true}'::jsonb then recorded_at end, 'signup'),
    (new.id, 'ai_feature_notice', signup_consent_version, signup_consent @> '{"ai_feature_acknowledged": true}'::jsonb,
      case when signup_consent @> '{"ai_feature_acknowledged": true}'::jsonb then recorded_at end, 'signup'),
    (new.id, 'journal_analysis', signup_consent_version, signup_consent @> '{"journal_analysis_consent": true}'::jsonb,
      case when signup_consent @> '{"journal_analysis_consent": true}'::jsonb then recorded_at end, 'signup')
  on conflict (user_id, consent_type, consent_version) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
