-- Legacy conversations can predate the NOT VALID auth-user foreign key and
-- retain user IDs after the auth account is gone. Search records only need the
-- composite conversation ownership key; keeping a second auth-user key would
-- prevent encrypted-title backfill for those retained conversations.
alter table buddy_service.conversation_search_tokens
  drop constraint if exists conversation_search_tokens_user_id_fkey;
