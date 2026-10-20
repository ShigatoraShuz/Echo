-- The professional HTTP middleware already emits this content-free event.
-- Retain every existing event type and all RLS/grants; permit its durable storage.
begin;
alter table user_service.security_events drop constraint security_events_event_type_check;
alter table user_service.security_events add constraint security_events_event_type_check
  check(event_type in ('authentication.denied','authorization.denied','rate_limit.denied',
    'administrator.access','privacy.export','privacy.deletion','consent.access',
    'verification.access','account.security','professional.request'));
commit;
