-- Ordinary settings access uses the verified JWT; workflow/auth/storage jobs remain server-only.
begin;
grant usage on schema user_service to authenticated;
grant select on user_service.profiles, user_service.notification_preferences,
  user_service.privacy_preferences, user_service.trusted_contacts, user_service.audit_events,
  user_service.data_export_requests, user_service.account_deletion_requests to authenticated;
grant insert(user_id) on user_service.profiles, user_service.notification_preferences,
  user_service.privacy_preferences to authenticated;
grant update(display_name,timezone,theme_variant,theme_mode,avatar_path) on user_service.profiles to authenticated;
grant update(email_enabled,push_enabled,in_app_enabled,journal_reminders_enabled,wellbeing_reminders_enabled,
  insight_notifications_enabled,reminder_time,reminder_timezone) on user_service.notification_preferences to authenticated;
grant update(facial_analysis_enabled,journal_ai_analysis_enabled,crisis_support_visible,lock_screen_private)
  on user_service.privacy_preferences to authenticated;
grant insert(user_id,contact_name,contact_email,contact_phone,relationship,is_primary,permission_acknowledged_at),
  update(contact_name,contact_email,contact_phone,relationship,is_primary,permission_acknowledged_at), delete
  on user_service.trusted_contacts to authenticated;
create policy export_select_owner on user_service.data_export_requests for select to authenticated
  using(user_id=(select auth.uid()));
create policy deletion_select_owner on user_service.account_deletion_requests for select to authenticated
  using(user_id=(select auth.uid()));
commit;
