begin;

-- A patient-owned case cascades on patient erasure. A practitioner's departure
-- must not erase another person's case; active assignments are blocked by the
-- worker until an administrator reassigns them.
alter table professional_service.organizations
  drop constraint if exists organizations_created_by_fkey,
  drop constraint if exists organizations_verified_by_fkey;
alter table professional_service.organizations
  add constraint organizations_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null,
  add constraint organizations_verified_by_fkey foreign key(verified_by) references auth.users(id) on delete set null;

alter table professional_service.memberships drop constraint if exists memberships_approved_by_fkey;
alter table professional_service.memberships add constraint memberships_approved_by_fkey
  foreign key(approved_by) references auth.users(id) on delete set null;

alter table professional_service.support_requests drop constraint if exists support_requests_assigned_to_fkey;
alter table professional_service.support_requests add constraint support_requests_assigned_to_fkey
  foreign key(assigned_to) references auth.users(id) on delete set null;

alter table professional_service.appointments alter column professional_user_id drop not null;
alter table professional_service.appointments drop constraint if exists appointments_professional_user_id_fkey;
alter table professional_service.appointments add constraint appointments_professional_user_id_fkey
  foreign key(professional_user_id) references auth.users(id) on delete set null;

alter table professional_service.case_notes alter column author_user_id drop not null;
alter table professional_service.case_notes drop constraint if exists case_notes_author_user_id_fkey;
alter table professional_service.case_notes add constraint case_notes_author_user_id_fkey
  foreign key(author_user_id) references auth.users(id) on delete set null;

alter table professional_service.referrals alter column author_user_id drop not null;
alter table professional_service.referrals drop constraint if exists referrals_author_user_id_fkey;
alter table professional_service.referrals add constraint referrals_author_user_id_fkey
  foreign key(author_user_id) references auth.users(id) on delete set null;

alter table professional_service.audit_events alter column actor_user_id drop not null;
alter table professional_service.audit_events
  drop constraint if exists audit_events_request_id_fkey,
  drop constraint if exists audit_events_actor_user_id_fkey,
  drop constraint if exists audit_events_subject_user_id_fkey;
alter table professional_service.audit_events
  add constraint audit_events_request_id_fkey foreign key(request_id) references professional_service.support_requests(id) on delete set null,
  add constraint audit_events_actor_user_id_fkey foreign key(actor_user_id) references auth.users(id) on delete set null,
  add constraint audit_events_subject_user_id_fkey foreign key(subject_user_id) references auth.users(id) on delete set null;

alter table professional_service.case_shared_records drop constraint if exists case_shared_records_revoked_by_fkey;
alter table professional_service.case_shared_records add constraint case_shared_records_revoked_by_fkey
  foreign key(revoked_by) references auth.users(id) on delete set null;
alter table professional_service.case_events drop constraint if exists case_events_actor_user_id_fkey;
alter table professional_service.case_events add constraint case_events_actor_user_id_fkey
  foreign key(actor_user_id) references auth.users(id) on delete set null;

alter table professional_service.case_messages alter column sender_user_id drop not null;
alter table professional_service.case_messages drop constraint if exists case_messages_sender_user_id_fkey;
alter table professional_service.case_messages add constraint case_messages_sender_user_id_fkey
  foreign key(sender_user_id) references auth.users(id) on delete set null;

alter table professional_service.appointment_change_requests alter column requester_user_id drop not null;
alter table professional_service.appointment_change_requests drop constraint if exists appointment_change_requests_requester_user_id_fkey;
alter table professional_service.appointment_change_requests add constraint appointment_change_requests_requester_user_id_fkey
  foreign key(requester_user_id) references auth.users(id) on delete set null;

commit;
