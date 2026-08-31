-- Keep application-table ownership separate from object storage. The User
-- Service's public-table role intentionally bypasses RLS, so it must never be
-- used for Storage where bucket isolation depends on RLS.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'user_storage_role') then
    create role user_storage_role nologin noinherit nobypassrls;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant user_storage_role to authenticator;
  end if;
end
$$;

alter role user_storage_role nobypassrls;

-- Correct already-applied versions of the preceding ownership migration.
drop policy if exists verification_documents_user_service_storage on storage.objects;
revoke all on table storage.buckets from user_service_role;
revoke all on table storage.objects from user_service_role;
revoke usage on schema storage from user_service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant usage on schema storage to user_storage_role;
grant select on table storage.buckets to user_storage_role;
grant select, insert, delete on table storage.objects to user_storage_role;

create policy user_storage_bucket_metadata
on storage.buckets for select to user_storage_role
using (id in ('verification-documents', 'avatars'));

create policy user_storage_objects_read
on storage.objects for select to user_storage_role
using (bucket_id in ('verification-documents', 'avatars'));

create policy user_storage_objects_insert
on storage.objects for insert to user_storage_role
with check (bucket_id in ('verification-documents', 'avatars'));

create policy user_storage_objects_delete
on storage.objects for delete to user_storage_role
using (bucket_id in ('verification-documents', 'avatars'));
