-- Preferences belong to user_service in the current modular monolith.
-- The prior trigger referenced a nonexistent notification_service table.
create or replace function notification_service.notify_completed_journal_analysis()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed' and old.status is distinct from new.status and exists(
    select 1 from user_service.notification_preferences p
    where p.user_id=new.user_id and p.in_app_enabled and p.insight_notifications_enabled
  ) then
    insert into notification_service.notifications(user_id,notification_type,title,message,resource_type,resource_id)
    values(new.user_id,'analysis_completed','Journal analysis ready',
      case when new.facial_status in ('captured_pending_provider','unavailable','failed')
      then 'Your text insights are ready. Facial analysis is not available yet.'
      else 'Your private journal analysis is ready to view.' end,'journal',new.journal_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function notification_service.notify_completed_journal_analysis() from public,anon,authenticated;
