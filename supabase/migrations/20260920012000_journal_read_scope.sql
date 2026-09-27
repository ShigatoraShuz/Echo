begin;
-- Decryption remains backend-only. Browser/user roles receive owner-filtered
-- ciphertext reads, never encryption keys or direct write authority.
grant usage on schema journal_service to authenticated;
grant select on journal_service.journals,journal_service.journal_drafts to authenticated;
commit;
