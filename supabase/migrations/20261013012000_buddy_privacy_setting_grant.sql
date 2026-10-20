-- Settings writes use the verified user's JWT and column-scoped privileges.
-- The history preference was added after the existing settings grants.
grant update(buddy_history_enabled)
  on user_service.privacy_preferences to authenticated;
