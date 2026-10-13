alter table buddy_service.buddy_conversations add column if not exists pinned_at timestamptz;
create index if not exists buddy_conversations_user_pinned_idx
  on buddy_service.buddy_conversations (user_id, pinned_at desc)
  where pinned_at is not null;
