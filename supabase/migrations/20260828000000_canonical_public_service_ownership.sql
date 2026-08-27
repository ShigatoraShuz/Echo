-- Resolve the 2026-08-24 schema-per-service experiment in favour of one
-- canonical data model: the mature public tables. Supabase Auth remains in
-- auth.*, while internal services receive narrowly scoped PostgREST roles.
--
-- Safety: the experimental schemas were never exposed by config.toml and the
-- deployed backend reverted to public tables. If any experimental table does
-- contain data, abort rather than silently discard it. Operators must migrate
-- that data explicitly before retrying this migration.

do $$
declare
  candidate_schema text;
  candidate_table record;
  contains_rows boolean;
begin
  foreach candidate_schema in array array[
    'user_service',
    'journal_service',
    'buddy_service',
    'grounding_service',
    'insights_service',
    'notification_service',
    'verification_service',
    'ai_analysis'
  ] loop
    if exists (select 1 from pg_namespace where nspname = candidate_schema) then
      for candidate_table in
        select schemaname, tablename
        from pg_tables
        where schemaname = candidate_schema
      loop
        execute format(
          'select exists (select 1 from %I.%I limit 1)',
          candidate_table.schemaname,
          candidate_table.tablename
        ) into contains_rows;

        if contains_rows then
          raise exception using
            message = format(
              'Refusing to remove non-empty experimental table %I.%I',
              candidate_table.schemaname,
              candidate_table.tablename
            ),
            hint = 'Copy and reconcile the shadow data into the canonical public table, then retry.';
        end if;
      end loop;

      execute format('drop schema %I cascade', candidate_schema);
    end if;
  end loop;
end
$$;

do $$
declare
  compatibility_table text;
  contains_rows boolean;
begin
  foreach compatibility_table in array array[
    'lab_entries',
    'user_profiles',
    'user_preferences',
    'export_requests',
    'deletion_requests'
  ] loop
    if to_regclass(format('public.%I', compatibility_table)) is not null then
      execute format('select exists (select 1 from public.%I limit 1)', compatibility_table)
        into contains_rows;
      if contains_rows then
        raise exception using
          message = format('Refusing to remove non-empty compatibility table public.%I', compatibility_table),
          hint = 'Reconcile rows into the canonical owned table, then retry.';
      end if;
      execute format('drop table public.%I cascade', compatibility_table);
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'assessment_service_role') then
    create role assessment_service_role nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'analysis_service_role') then
    create role analysis_service_role nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'recommendation_service_role') then
    create role recommendation_service_role nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'wellness_service_role') then
    create role wellness_service_role nologin noinherit;
  end if;

  -- PostgREST's authenticator must be allowed to SET ROLE to custom JWT roles.
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant user_service_role to authenticator;
    grant journal_service_role to authenticator;
    grant assessment_service_role to authenticator;
    grant analysis_service_role to authenticator;
    grant recommendation_service_role to authenticator;
    grant wellness_service_role to authenticator;
    grant insights_service_role to authenticator;
  end if;
end
$$;

-- These non-login roles are assumed only by PostgREST after verifying a
-- server-side JWT. BYPASSRLS prevents user-facing policies from blocking the
-- service process; table grants below remain the hard ownership boundary.
alter role user_service_role bypassrls;
alter role journal_service_role bypassrls;
alter role assessment_service_role bypassrls;
alter role analysis_service_role bypassrls;
alter role recommendation_service_role bypassrls;
alter role wellness_service_role bypassrls;
alter role insights_service_role bypassrls;

grant usage on schema public to
  user_service_role,
  journal_service_role,
  assessment_service_role,
  analysis_service_role,
  recommendation_service_role,
  wellness_service_role,
  insights_service_role;

-- Browser roles authenticate with Supabase Auth but do not access protected
-- application tables through the Data API. All domain data flows via gateway.
revoke all on table
  public.profiles,
  public.user_consents,
  public.notification_preferences,
  public.privacy_preferences,
  public.trusted_contacts,
  public.data_export_requests,
  public.account_deletion_requests,
  public.journals,
  public.journal_drafts,
  public.mood_entries,
  public.journal_analyses,
  public.analysis_windows,
  public.analysis_feedback,
  public.model_versions,
  public.safety_events,
  public.safety_event_resources,
  public.buddy_conversations,
  public.buddy_messages,
  public.grounding_sessions,
  public.support_resources,
  public.notifications,
  public.verification_admins,
  public.identity_verifications,
  public.verification_documents,
  public.verification_reviews,
  public.audit_events
from anon, authenticated;

-- Start from deny-all for every internal service role, then grant ownership.
revoke all on all tables in schema public from
  user_service_role,
  journal_service_role,
  assessment_service_role,
  analysis_service_role,
  recommendation_service_role,
  wellness_service_role,
  insights_service_role;
revoke all on all sequences in schema public from
  user_service_role,
  journal_service_role,
  assessment_service_role,
  analysis_service_role,
  recommendation_service_role,
  wellness_service_role,
  insights_service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.user_consents,
  public.notification_preferences,
  public.privacy_preferences,
  public.trusted_contacts,
  public.data_export_requests,
  public.account_deletion_requests,
  public.notifications,
  public.verification_admins,
  public.identity_verifications,
  public.verification_documents,
  public.verification_reviews,
  public.audit_events
to user_service_role;

grant select, insert, update, delete on table
  public.journals,
  public.journal_drafts
to journal_service_role;

grant select, insert, update, delete on table
  public.mood_entries
to assessment_service_role;

grant select, insert, update, delete on table
  public.journal_analyses,
  public.analysis_windows,
  public.analysis_feedback,
  public.model_versions,
  public.safety_events,
  public.safety_event_resources
to analysis_service_role;

grant select on table public.support_resources to recommendation_service_role;

grant select, insert, update, delete on table
  public.buddy_conversations,
  public.buddy_messages,
  public.grounding_sessions
to wellness_service_role;
grant select on table public.support_resources to wellness_service_role;

-- Insights is derived through service APIs and intentionally owns no base
-- user data table. It receives schema usage only, proving it cannot bypass APIs.

grant select on table storage.buckets to user_service_role;
grant select, insert, update, delete on table storage.objects to user_service_role;
create policy verification_documents_user_service_storage
on storage.objects for all to user_service_role
using (bucket_id = 'verification-documents')
with check (bucket_id = 'verification-documents');

comment on schema public is
  'Canonical ECHO application schema. Table access is partitioned by internal service roles; browser roles use APIs.';
