begin;

create function journal_service.emotion_insights_summary()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with mood_counts as (
    select mood, count(*) as entry_count
    from journal_service.journals
    where user_id = (select auth.uid()) and deleted_at is null
    group by mood
  ), daily_scores as (
    select (created_at at time zone 'UTC')::date as day,
      count(*) as entry_count,
      sum(case mood
        when 'calm' then 82
        when 'happy' then 92
        when 'neutral' then 62
        when 'sad' then 38
        when 'anxious' then 32
        when 'angry' then 26
        else 60
      end) as score_sum
    from journal_service.journals
    where user_id = (select auth.uid()) and deleted_at is null
      and created_at >= ((date_trunc('day', now() at time zone 'UTC') - interval '6 days') at time zone 'UTC')
      and created_at < ((date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC')
    group by 1
  )
  select jsonb_build_object(
    'total', (select coalesce(sum(entry_count), 0) from mood_counts),
    'mood_counts', coalesce((select jsonb_object_agg(mood, entry_count) from mood_counts), '{}'::jsonb),
    'daily_scores', coalesce((select jsonb_object_agg(day::text,
      jsonb_build_object('count', entry_count, 'sum', score_sum)) from daily_scores), '{}'::jsonb)
  );
$$;

revoke all on function journal_service.emotion_insights_summary() from public, anon;
grant execute on function journal_service.emotion_insights_summary() to authenticated;

commit;
