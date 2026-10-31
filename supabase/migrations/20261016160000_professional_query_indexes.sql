-- BE-028: additive indexes matching measured queue/detail shapes. No policy changes.
create index professional_queue_recent_idx on professional_service.support_requests(organization_id,created_at desc,id);
create index professional_queue_updated_idx on professional_service.support_requests(organization_id,updated_at desc,id);
create index professional_assignee_updated_idx on professional_service.support_requests(organization_id,assigned_to,updated_at desc,id) include(status,created_at);
create index professional_appointment_history_idx on professional_service.appointments(request_id,created_at desc,id);
-- Exclude high-volume access audits from the bounded workflow timeline scan.
create index professional_case_timeline_idx on professional_service.audit_events(request_id,organization_id,created_at desc,id desc)
  where action in ('request.created','request.updated','request.withdrawn','request.claimed','request.closed','request.declined','request.transferred',
    'sharing.revoked','appointment.proposed','appointment.confirmed','appointment.declined','appointment.canceled','appointment.rescheduled',
    'note.created','note.finalized','referral.created');
-- Due reminder scans are global; the tenant-leading UI index cannot serve this order.
create index professional_follow_up_reminder_idx on professional_service.follow_ups(due_at,id) where status='pending';
