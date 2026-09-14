-- Persist retry identity with the existing encrypted draft, without storing its contents in browser storage.
alter table journal_service.journal_drafts add column submission_key uuid;
