-- A reminder is an in-app notice for one user and one local calendar day.
begin;

alter table user_service.notification_preferences
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time;

alter table user_service.notification_preferences
  add constraint notification_quiet_hours_pair_check check (
    (quiet_hours_start is null and quiet_hours_end is null)
    or (quiet_hours_start is not null and quiet_hours_end is not null and quiet_hours_start <> quiet_hours_end)
  );

alter table user_service.notification_preferences
  add constraint notification_reminder_outside_quiet_check check (
    quiet_hours_start is null or reminder_time is null
    or case when quiet_hours_start < quiet_hours_end
      then reminder_time < quiet_hours_start or reminder_time >= quiet_hours_end
      else reminder_time < quiet_hours_start and reminder_time >= quiet_hours_end
    end
  );

alter table notification_service.notifications
  add column if not exists reminder_local_date date;

create unique index if not exists notifications_one_daily_reminder_idx
  on notification_service.notifications (user_id, notification_type, reminder_local_date);

create or replace function notification_service.enqueue_due_in_app_reminders(p_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Reminder delivery requires the service role' using errcode = '42501';
  end if;

  with eligible as (
    select preferences.user_id,
           case when zone.name is not null
             then p_at at time zone preferences.reminder_timezone
           end as local_now,
           preferences.reminder_time,
           preferences.quiet_hours_start,
           preferences.quiet_hours_end,
           preferences.journal_reminders_enabled,
           preferences.wellbeing_reminders_enabled
    from user_service.notification_preferences preferences
    left join pg_catalog.pg_timezone_names zone on zone.name = preferences.reminder_timezone
    where preferences.in_app_enabled
      and preferences.reminder_time is not null
      and (preferences.journal_reminders_enabled or preferences.wellbeing_reminders_enabled)
  ), due as (
    select eligible.user_id,
           notice.notification_type,
           notice.title,
           notice.message,
           notice.resource_type,
           eligible.local_now::date as local_date
    from eligible
    cross join lateral (values
      ('journal_reminder'::text, eligible.journal_reminders_enabled,
       'A moment to write', 'Your private journal is here whenever you are ready.', 'journal'::text),
      ('grounding_reminder'::text, eligible.wellbeing_reminders_enabled,
       'A moment to pause', 'A grounding exercise is here whenever you need it.', 'grounding'::text)
    ) as notice(notification_type, enabled, title, message, resource_type)
    where notice.enabled
      and eligible.local_now is not null
      and eligible.local_now::time >= eligible.reminder_time
      and (
        eligible.quiet_hours_start is null
        or eligible.quiet_hours_end is null
        or case when eligible.quiet_hours_start < eligible.quiet_hours_end
          then eligible.local_now::time < eligible.quiet_hours_start
            or eligible.local_now::time >= eligible.quiet_hours_end
          else eligible.local_now::time < eligible.quiet_hours_start
            and eligible.local_now::time >= eligible.quiet_hours_end
        end
      )
  ), inserted as (
    insert into notification_service.notifications (
      user_id, notification_type, title, message, resource_type, reminder_local_date
    )
    select user_id, notification_type, title, message, resource_type, local_date from due
    on conflict do nothing
    returning id
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

revoke all on function notification_service.enqueue_due_in_app_reminders(timestamptz) from public, anon, authenticated;
grant execute on function notification_service.enqueue_due_in_app_reminders(timestamptz) to service_role;

commit;
