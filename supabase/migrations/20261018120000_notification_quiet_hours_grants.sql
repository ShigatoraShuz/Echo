-- Settings uses the user's verified JWT and needs write access to quiet hours.
begin;

grant update(quiet_hours_start, quiet_hours_end)
  on user_service.notification_preferences to authenticated;

commit;
