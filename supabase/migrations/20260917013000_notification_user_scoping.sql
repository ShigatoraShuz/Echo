begin;
-- Deliberate, documented exception to private-schema denial: notification DTO
-- metadata is owner-readable, and users may update only read_at. Nothing else
-- in this schema is exposed. Normal API operations now carry the user's JWT.
grant usage on schema notification_service to authenticated;
grant select on notification_service.notifications to authenticated;
grant update(read_at) on notification_service.notifications to authenticated;
commit;
