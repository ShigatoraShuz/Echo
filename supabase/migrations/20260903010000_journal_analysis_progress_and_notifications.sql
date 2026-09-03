-- Five-check journal analysis progress, privacy-safe facial metadata, and completion notifications.

alter table ai_analysis.analysis_requests
  add column if not exists facial_analysis_requested boolean not null default false,
  add column if not exists facial_status text not null default 'not_requested',
  add column if not exists facial_capture_received_at timestamptz,
  add column if not exists facial_capture_schema_version text,
  add column if not exists facial_capture_model_version text;

alter table ai_analysis.analysis_requests
  drop constraint if exists analysis_requests_facial_status_check;
alter table ai_analysis.analysis_requests
  add constraint analysis_requests_facial_status_check check (facial_status in (
    'not_requested','not_captured','captured_pending_provider','queued','analyzing','completed','unavailable','failed'
  ));

alter table public.analysis_status_projection
  add column if not exists facial_status text not null default 'not_requested';
alter table public.analysis_status_projection
  drop constraint if exists analysis_status_projection_facial_status_check;
alter table public.analysis_status_projection
  add constraint analysis_status_projection_facial_status_check check (facial_status in (
    'not_requested','not_captured','captured_pending_provider','queued','analyzing','completed','unavailable','failed'
  ));

create unique index if not exists notifications_one_analysis_completed_idx
  on notification_service.notifications (user_id, notification_type, resource_id)
  where notification_type = 'analysis_completed' and resource_type = 'journal';

create or replace function notification_service.notify_completed_journal_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status
     and exists (
       select 1
       from notification_service.notification_preferences preferences
       where preferences.user_id = new.user_id
         and preferences.in_app_enabled = true
         and preferences.insight_notifications_enabled = true
     ) then
    insert into notification_service.notifications (
      user_id, notification_type, title, message, resource_type, resource_id
    ) values (
      new.user_id,
      'analysis_completed',
      'Journal analysis ready',
      case
        when new.facial_status in ('captured_pending_provider','unavailable','failed')
          then 'Your text insights are ready. Facial analysis is not available yet.'
        else 'Your private journal analysis is ready to view.'
      end,
      'journal',
      new.journal_id
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function notification_service.notify_completed_journal_analysis() from public, anon, authenticated;

drop trigger if exists analysis_completed_notification on ai_analysis.analysis_requests;
create trigger analysis_completed_notification
after update of status on ai_analysis.analysis_requests
for each row execute function notification_service.notify_completed_journal_analysis();

