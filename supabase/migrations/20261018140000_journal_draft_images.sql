begin;

create table journal_service.journal_draft_images (
  id uuid primary key,
  user_id uuid not null references journal_service.journal_drafts(user_id) on delete cascade,
  storage_path text not null unique,
  content_hash text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  uploaded boolean not null default false,
  transferred boolean not null default false,
  reservation_expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);
create index journal_draft_images_user_idx on journal_service.journal_draft_images(user_id, created_at);
alter table journal_service.journal_draft_images enable row level security;
revoke all on journal_service.journal_draft_images from public, anon, authenticated;
grant select, insert, update, delete on journal_service.journal_draft_images to service_role;

create function journal_service.reserve_journal_draft_image(
  p_user_id uuid, p_image_id uuid, p_hash text, p_mime_type text
) returns text language plpgsql security definer set search_path = '' as $$
declare image journal_service.journal_draft_images; active_count integer; path text; existing_image boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  perform 1 from journal_service.journal_drafts where user_id = p_user_id for update;
  if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
  select * into image from journal_service.journal_draft_images where id = p_image_id;
  existing_image := found;
  if existing_image and (image.user_id <> p_user_id or image.content_hash <> p_hash or image.mime_type <> p_mime_type) then
    raise exception 'IMAGE_CONFLICT';
  end if;
  select count(*) into active_count from journal_service.journal_draft_images
  where user_id = p_user_id and id <> p_image_id and (uploaded or reservation_expires_at > now());
  if active_count >= 5 then raise exception 'IMAGE_LIMIT'; end if;
  if existing_image then
    update journal_service.journal_draft_images
    set reservation_expires_at = now() + interval '30 minutes'
    where id = p_image_id and not uploaded;
    return image.storage_path;
  end if;
  path := p_user_id::text || '/draft/' || p_image_id::text;
  insert into journal_service.journal_draft_images(id, user_id, storage_path, content_hash, mime_type)
  values(p_image_id, p_user_id, path, p_hash, p_mime_type);
  return path;
end;
$$;
revoke all on function journal_service.reserve_journal_draft_image(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function journal_service.reserve_journal_draft_image(uuid,uuid,text,text) to service_role;

create function journal_service.enforce_draft_image_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.uploaded and not old.uploaded then
    perform 1 from journal_service.journal_drafts where user_id = new.user_id for update;
    if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
    if (select count(*) from journal_service.journal_draft_images
        where user_id = new.user_id and id <> new.id and uploaded) >= 5 then
      raise exception 'IMAGE_LIMIT';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_service.enforce_draft_image_limit() from public, anon, authenticated;
create trigger enforce_draft_image_limit before update of uploaded on journal_service.journal_draft_images
for each row execute function journal_service.enforce_draft_image_limit();

create function journal_service.queue_draft_image_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not old.transferred then
    insert into journal_service.image_deletion_queue(storage_path) values(old.storage_path) on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke all on function journal_service.queue_draft_image_deletion() from public, anon, authenticated;
create trigger queue_draft_image_deletion after delete on journal_service.journal_draft_images
for each row execute function journal_service.queue_draft_image_deletion();

create function journal_service.attach_journal_draft_images(p_user_id uuid, p_journal_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare attached_count integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  perform 1 from journal_service.journals
  where id = p_journal_id and user_id = p_user_id and deleted_at is null for update;
  if not found then raise exception 'JOURNAL_NOT_FOUND'; end if;
  perform 1 from journal_service.journal_drafts where user_id = p_user_id for update;
  if not found then return 0; end if;
  if exists (select 1 from journal_service.journal_draft_images
             where user_id = p_user_id and not uploaded and reservation_expires_at > now()) then
    raise exception 'IMAGE_UPLOAD_PENDING';
  end if;
  select count(*) into attached_count from journal_service.journal_draft_images
  where user_id = p_user_id and uploaded;
  if attached_count + (select count(*) from journal_service.journal_images
                       where journal_id = p_journal_id and uploaded) > 5 then
    raise exception 'IMAGE_LIMIT';
  end if;
  insert into journal_service.journal_images
    (id, journal_id, user_id, storage_path, content_hash, mime_type, uploaded)
  select id, p_journal_id, user_id, storage_path, content_hash, mime_type, true
  from journal_service.journal_draft_images where user_id = p_user_id and uploaded;
  update journal_service.journal_draft_images set transferred = true
  where user_id = p_user_id and uploaded;
  delete from journal_service.journal_draft_images where user_id = p_user_id and transferred;
  return attached_count;
end;
$$;
revoke all on function journal_service.attach_journal_draft_images(uuid,uuid) from public, anon, authenticated;
grant execute on function journal_service.attach_journal_draft_images(uuid,uuid) to service_role;

commit;
