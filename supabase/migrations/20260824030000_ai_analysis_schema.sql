create extension if not exists pgcrypto;

create schema if not exists ai_analysis;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_analysis_role') then
    create role ai_analysis_role noinherit;
  end if;
end
$$;

grant usage on schema ai_analysis to ai_analysis_role;
grant usage on schema ai_analysis to authenticated;

create table if not exists ai_analysis.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  provider text not null default 'mock',
  base_model text,
  adapter_version text,
  adapter_checksum text,
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  deployed_at timestamptz not null default timezone('utc', now()),
  retired_at timestamptz
);

create table if not exists ai_analysis.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null,
  source_feature text not null check (source_feature in ('journal', 'insights', 'buddy', 'verification', 'moderation')),
  source_record_id uuid,
  analysis_type text not null check (analysis_type in ('journal_reflection', 'risk_insight', 'facial_emotion', 'safety_escalation', 'content_moderation')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  model_version_id uuid references ai_analysis.model_versions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text
);

create table if not exists ai_analysis.analysis_results (
  id uuid primary key default gen_random_uuid(),
  analysis_request_id uuid not null references ai_analysis.analysis_requests(id) on delete cascade,
  user_id uuid not null,
  phq8_score integer check (phq8_score between 0 and 24),
  severity text check (severity in ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe')),
  urgent_language_detected boolean not null default false,
  summary text not null,
  perspective text,
  mood_insight text,
  risk_indication text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  is_demo_data boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists ai_analysis.facial_analysis_results (
  id uuid primary key default gen_random_uuid(),
  analysis_request_id uuid not null references ai_analysis.analysis_requests(id) on delete cascade,
  user_id uuid not null,
  detected_emotion text not null,
  emotion_distribution jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  camera_available boolean not null default false,
  permission_granted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists ai_analysis.risk_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  analysis_result_id uuid references ai_analysis.analysis_results(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  band text not null check (band in ('low', 'mild', 'moderate', 'high', 'severe')),
  supporting_factors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists ai_analysis.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  analysis_request_id uuid references ai_analysis.analysis_requests(id) on delete set null,
  event_type text not null check (event_type in ('urgent_language', 'high_risk', 'self_harm_support', 'crisis_escalation', 'review_required')),
  severity text not null check (severity in ('info', 'warning', 'high', 'critical')),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists ai_analysis.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  feature_scope text not null check (feature_scope in ('journal', 'insights', 'buddy', 'verification', 'moderation')),
  prompt_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists ai_analysis.analysis_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  analysis_request_id uuid references ai_analysis.analysis_requests(id) on delete cascade,
  actor text not null default 'system',
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table ai_analysis.model_versions enable row level security;
alter table ai_analysis.analysis_requests enable row level security;
alter table ai_analysis.analysis_results enable row level security;
alter table ai_analysis.facial_analysis_results enable row level security;
alter table ai_analysis.risk_signal_snapshots enable row level security;
alter table ai_analysis.safety_events enable row level security;
alter table ai_analysis.prompt_templates enable row level security;
alter table ai_analysis.analysis_audit_log enable row level security;

grant select, insert, update, delete on all tables in schema ai_analysis to ai_analysis_role;
grant select on all tables in schema ai_analysis to authenticated;

create policy model_versions_read on ai_analysis.model_versions for select to authenticated
  using (active = true);

create policy analysis_requests_select_own on ai_analysis.analysis_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy analysis_requests_insert_own on ai_analysis.analysis_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy analysis_requests_update_own on ai_analysis.analysis_requests for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy analysis_results_select_own on ai_analysis.analysis_results for select to authenticated
  using ((select auth.uid()) = user_id);

create policy facial_analysis_results_select_own on ai_analysis.facial_analysis_results for select to authenticated
  using ((select auth.uid()) = user_id);

create policy risk_signal_snapshots_select_own on ai_analysis.risk_signal_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

create policy safety_events_select_own on ai_analysis.safety_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy prompt_templates_read on ai_analysis.prompt_templates for select to authenticated
  using (active = true);

create policy analysis_audit_log_select_own on ai_analysis.analysis_audit_log for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists analysis_requests_user_id_created_at_idx on ai_analysis.analysis_requests (user_id, created_at desc);
create index if not exists analysis_results_user_id_created_at_idx on ai_analysis.analysis_results (user_id, created_at desc);
create index if not exists facial_analysis_results_user_id_created_at_idx on ai_analysis.facial_analysis_results (user_id, created_at desc);
create index if not exists risk_signal_snapshots_user_id_created_at_idx on ai_analysis.risk_signal_snapshots (user_id, created_at desc);
create index if not exists safety_events_user_id_created_at_idx on ai_analysis.safety_events (user_id, created_at desc);
create index if not exists analysis_audit_log_user_id_created_at_idx on ai_analysis.analysis_audit_log (user_id, created_at desc);
