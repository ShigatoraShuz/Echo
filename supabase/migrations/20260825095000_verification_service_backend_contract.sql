-- Align verification_service tables with the backend verification workflow.

alter table verification_service.identity_verifications
  add column if not exists consent_version text,
  add column if not exists privacy_notice_acknowledged_at timestamptz,
  add column if not exists guardian_consent_acknowledged_at timestamptz;

alter table verification_service.verification_documents
  add column if not exists sha256_hex text;

create unique index if not exists verification_documents_verification_kind_unique
  on verification_service.verification_documents (verification_id, document_kind);
