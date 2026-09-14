-- Modular-monolith insights ownership. Screening answers are not AI estimates.
create table insights_service.phq8_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null,
  responses smallint[] not null check (
    array_ndims(responses) = 1 and array_length(responses, 1) = 8
    and array_position(responses, null) is null and responses <@ array[0,1,2,3]::smallint[]
  ),
  score smallint not null check (score between 0 and 24),
  severity text not null check (severity = public.phq8_severity(score)),
  completed_at timestamptz not null default now(),
  unique (user_id, submission_id)
);
create index phq8_user_history on insights_service.phq8_assessments(user_id, completed_at desc);

create table insights_service.support_prompt_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_prompted_at timestamptz not null
);
alter table insights_service.phq8_assessments enable row level security;
alter table insights_service.support_prompt_state enable row level security;
revoke all on insights_service.phq8_assessments, insights_service.support_prompt_state from public, anon, authenticated;
grant select, insert, update, delete on insights_service.phq8_assessments, insights_service.support_prompt_state to service_role;

create function insights_service.score_phq8_answers() returns trigger
language plpgsql set search_path = '' as $$
begin
  select sum(answer) into new.score from unnest(new.responses) answer;
  new.severity := public.phq8_severity(new.score);
  return new;
end;
$$;
create trigger score_phq8 before insert or update on insights_service.phq8_assessments
for each row execute function insights_service.score_phq8_answers();

create function insights_service.save_phq8(p_user_id uuid, p_submission_id uuid, p_responses smallint[], p_interval_days integer)
returns insights_service.phq8_assessments language plpgsql security definer set search_path = '' as $$
declare result insights_service.phq8_assessments;
begin
  if p_interval_days not between 1 and 365 then raise exception 'INVALID_INTERVAL'; end if;
  perform pg_advisory_xact_lock(hashtextextended('phq8:' || p_user_id::text, 0));
  select * into result from insights_service.phq8_assessments where user_id=p_user_id and submission_id=p_submission_id;
  if found then
    if result.responses is distinct from p_responses then raise exception 'SUBMISSION_CONFLICT'; end if;
    return result;
  end if;
  select * into result from insights_service.phq8_assessments where user_id=p_user_id order by completed_at desc limit 1;
  -- Concurrent tabs cannot create a second assessment inside the same due interval.
  if found and result.completed_at + make_interval(days => p_interval_days) > now() then return result; end if;
  insert into insights_service.phq8_assessments(user_id,submission_id,responses,score,severity)
    values(p_user_id,p_submission_id,p_responses,0,'minimal') returning * into result;
  return result;
end;
$$;

create function insights_service.recent_concerning_journals(p_user_id uuid, p_window_days integer)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(distinct q.journal_id)
  from ai_analysis.analysis_results r
  join ai_analysis.analysis_requests q on q.id=r.analysis_request_id and q.user_id=r.user_id
  join journal_service.journals j on j.id=q.journal_id and j.user_id=r.user_id
  where r.user_id=p_user_id and r.is_demo_data=false and r.is_simulated=false and r.urgent_language_detected=false
    and r.severity in ('moderately_severe','severe') and q.status='completed' and q.deleted_at is null
    and j.deleted_at is null and r.created_at between now()-make_interval(days => p_window_days) and now();
$$;

create function insights_service.claim_support_prompt(p_user_id uuid, p_threshold integer, p_window_days integer, p_cooldown_days integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  if p_threshold not between 1 and 100 or p_window_days not between 1 and 365 or p_cooldown_days not between 1 and 365 then
    raise exception 'INVALID_SUPPORT_CONFIGURATION';
  end if;
  if exists(select 1 from ai_analysis.analysis_requests where user_id=p_user_id and status='safety_action_required' and deleted_at is null) then return false; end if;
  if insights_service.recent_concerning_journals(p_user_id,p_window_days) < p_threshold then return false; end if;
  insert into insights_service.support_prompt_state(user_id,last_prompted_at) values(p_user_id,now())
  on conflict(user_id) do update set last_prompted_at=excluded.last_prompted_at
    where insights_service.support_prompt_state.last_prompted_at <= now()-make_interval(days => p_cooldown_days)
  returning user_id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function insights_service.score_phq8_answers() from public,anon,authenticated;
revoke all on function insights_service.save_phq8(uuid,uuid,smallint[],integer) from public,anon,authenticated;
revoke all on function insights_service.recent_concerning_journals(uuid,integer) from public,anon,authenticated;
revoke all on function insights_service.claim_support_prompt(uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function insights_service.save_phq8(uuid,uuid,smallint[],integer), insights_service.recent_concerning_journals(uuid,integer), insights_service.claim_support_prompt(uuid,integer,integer,integer) to service_role;
