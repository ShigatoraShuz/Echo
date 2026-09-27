begin;
grant usage on schema buddy_service, grounding_service to authenticated;
grant select on buddy_service.buddy_conversations, buddy_service.buddy_messages,
 grounding_service.grounding_sessions, user_service.user_consents to authenticated;
-- No browser writes to assistant messages, authority/consent facts or protected workflow states.
commit;
