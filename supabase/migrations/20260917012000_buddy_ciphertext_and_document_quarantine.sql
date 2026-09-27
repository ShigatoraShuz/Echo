begin;
-- NOT VALID preserves existing rows for an explicit reviewed backfill; every
-- new/updated message must contain an application encryption envelope.
alter table buddy_service.buddy_messages add constraint buddy_message_ciphertext_required
  check(content like 'echo:encrypted:v1:%') not valid;
alter table verification_service.verification_documents
  add column scan_status text not null default 'quarantined'
    check(scan_status in ('quarantined','clean','rejected')),
  add column scanned_at timestamptz,
  add column scanner_version text;
alter table verification_service.verification_documents add constraint clean_document_has_scan_evidence
  check(scan_status<>'clean' or (scanned_at is not null and scanner_version is not null));
commit;
