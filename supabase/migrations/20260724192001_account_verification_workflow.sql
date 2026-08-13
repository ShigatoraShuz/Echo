-- Identity and guardian verification is coordinated exclusively through the
-- service-role backend. Sensitive form fields and administrator notes are
-- encrypted before they reach Postgres. Verification documents are stored in
-- a private Storage bucket and are served to reviewers with short-lived URLs.

create table public.verification_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  is_active boolean not null default true,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  verification_status text not null default 'draft'
    check (verification_status in (
      'draft',
      'submitted',
      'under_review',
      'needs_changes',
      'approved',
      'rejected',
      'expired'
    )),
  is_minor boolean,
  age_at_submission smallint check (age_at_submission between 13 and 120),
  details_ciphertext bytea,
  details_iv bytea,
  details_auth_tag bytea,
  details_key_version smallint check (details_key_version > 0),
  consent_version text,
  privacy_notice_acknowledged_at timestamptz,
  guardian_consent_acknowledged_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.verification_admins (user_id) on delete set null,
  decision_reason_code text,
  review_note_ciphertext bytea,
  review_note_iv bytea,
  review_note_auth_tag bytea,
  review_note_key_version smallint check (review_note_key_version > 0),
  approved_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint identity_verifications_details_encryption_grouped check (
    (details_ciphertext is null and details_iv is null and details_auth_tag is null and details_key_version is null)
    or
    (details_ciphertext is not null and details_iv is not null and details_auth_tag is not null and details_key_version is not null)
  ),
  constraint identity_verifications_review_note_encryption_grouped check (
    (review_note_ciphertext is null and review_note_iv is null and review_note_auth_tag is null and review_note_key_version is null)
    or
    (review_note_ciphertext is not null and review_note_iv is not null and review_note_auth_tag is not null and review_note_key_version is not null)
  ),
  constraint identity_verifications_submitted_fields_present check (
    verification_status = 'draft'
    or (
      details_ciphertext is not null
      and is_minor is not null
      and age_at_submission is not null
      and consent_version is not null
      and privacy_notice_acknowledged_at is not null
      and submitted_at is not null
    )
  ),
  constraint identity_verifications_minor_consent_present check (
    verification_status = 'draft'
    or is_minor is false
    or guardian_consent_acknowledged_at is not null
  ),
  constraint identity_verifications_review_consistency check (
    verification_status not in ('approved', 'rejected', 'needs_changes', 'expired')
    or (reviewed_at is not null and reviewed_by is not null)
  ),
  constraint identity_verifications_approval_expiry_present check (
    verification_status <> 'approved' or approved_expires_at is not null
  )
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_kind text not null check (document_kind in (
    'user_government_id',
    'user_age_document',
    'guardian_government_id',
    'guardianship_document'
  )),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  uploaded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint verification_documents_one_kind_per_application unique (verification_id, document_kind)
);

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications (id) on delete cascade,
  admin_user_id uuid not null references public.verification_admins (user_id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  reason_code text,
  note_ciphertext bytea,
  note_iv bytea,
  note_auth_tag bytea,
  note_key_version smallint check (note_key_version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint verification_reviews_note_encryption_grouped check (
    (note_ciphertext is null and note_iv is null and note_auth_tag is null and note_key_version is null)
    or
    (note_ciphertext is not null and note_iv is not null and note_auth_tag is not null and note_key_version is not null)
  )
);

create trigger verification_admins_set_updated_at
before update on public.verification_admins
for each row execute function private.set_updated_at();

create trigger identity_verifications_set_updated_at
before update on public.identity_verifications
for each row execute function private.set_updated_at();

create trigger verification_documents_set_updated_at
before update on public.verification_documents
for each row execute function private.set_updated_at();

alter table public.verification_admins enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.verification_documents enable row level security;
alter table public.verification_reviews enable row level security;

-- These tables intentionally have no browser policies. All reads and writes
-- pass through authenticated backend endpoints so plaintext identity details
-- never cross the Supabase Data API.
revoke all on public.verification_admins from anon, authenticated;
revoke all on public.identity_verifications from anon, authenticated;
revoke all on public.verification_documents from anon, authenticated;
revoke all on public.verification_reviews from anon, authenticated;

create index identity_verifications_status_submitted_idx
on public.identity_verifications (verification_status, submitted_at)
where verification_status in ('submitted', 'under_review');

create index identity_verifications_reviewed_by_idx
on public.identity_verifications (reviewed_by)
where reviewed_by is not null;

create index verification_documents_user_id_idx
on public.verification_documents (user_id);

create index verification_reviews_verification_created_at_idx
on public.verification_reviews (verification_id, created_at desc);

create index verification_reviews_admin_created_at_idx
on public.verification_reviews (admin_user_id, created_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-documents',
  'verification-documents',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
