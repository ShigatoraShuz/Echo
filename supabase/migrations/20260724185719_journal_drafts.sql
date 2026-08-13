create table public.journal_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  content_ciphertext bytea not null,
  encryption_iv bytea not null,
  encryption_auth_tag bytea not null,
  encryption_key_version smallint not null check (encryption_key_version > 0),
  mood text not null default 'calm' check (mood in ('calm', 'happy', 'neutral', 'sad', 'anxious', 'angry')),
  emotions text[] not null default '{}',
  tags text[] not null default '{}',
  privacy_status text not null default 'private' check (privacy_status in ('private', 'shared')),
  analysis_consent boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger journal_drafts_set_updated_at
before update on public.journal_drafts
for each row execute function private.set_updated_at();

alter table public.journal_drafts enable row level security;

-- Drafts are encrypted and only coordinated through the service-role backend.
-- No browser role receives table privileges or an RLS policy.
revoke all on public.journal_drafts from anon, authenticated;

create index journal_drafts_user_updated_at_idx
on public.journal_drafts (user_id, updated_at desc);
