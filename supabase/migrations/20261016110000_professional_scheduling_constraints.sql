-- BE-021 local proposal. Preflight existing active overlaps before deployment.
-- Do not cancel/alter historical appointments to make this migration pass.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
alter table professional_service.appointments add constraint professional_appointment_finite
  check(isfinite(starts_at) and isfinite(ends_at));
alter table professional_service.appointments add constraint professional_appointment_no_overlap
  exclude using gist (professional_user_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
  where(status in ('proposed','confirmed'));
-- The existing unique active appointment per request remains in force.
-- This covers simultaneous writes and cross-organization practitioner bookings,
-- while adjacent slots and canceled records remain permitted.
