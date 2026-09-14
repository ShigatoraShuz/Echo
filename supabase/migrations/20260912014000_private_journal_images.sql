insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('journal-images','journal-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create table journal_service.journal_images (
  id uuid primary key,
  journal_id uuid not null references journal_service.journals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  content_hash text not null,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);
alter table journal_service.journal_images enable row level security;
revoke all on journal_service.journal_images from public,anon,authenticated;
grant select,insert,update,delete on journal_service.journal_images to service_role;

create function journal_service.reserve_journal_image(p_user_id uuid,p_journal_id uuid,p_image_id uuid,p_hash text,p_mime_type text)
returns text language plpgsql security definer set search_path='' as $$
declare image journal_service.journal_images; path text;
begin
  perform 1 from journal_service.journals where id=p_journal_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception 'JOURNAL_NOT_FOUND'; end if;
  select * into image from journal_service.journal_images where id=p_image_id;
  if found then
    if image.user_id<>p_user_id or image.journal_id<>p_journal_id or image.content_hash<>p_hash or image.mime_type<>p_mime_type then raise exception 'IMAGE_CONFLICT'; end if;
    return image.storage_path;
  end if;
  if (select count(*) from journal_service.journal_images where journal_id=p_journal_id)>=5 then raise exception 'IMAGE_LIMIT'; end if;
  path := p_user_id::text || '/' || p_journal_id::text || '/' || p_image_id::text;
  insert into journal_service.journal_images(id,journal_id,user_id,storage_path,content_hash,mime_type)
    values(p_image_id,p_journal_id,p_user_id,path,p_hash,p_mime_type);
  return path;
end;
$$;
revoke all on function journal_service.reserve_journal_image(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function journal_service.reserve_journal_image(uuid,uuid,uuid,text,text) to service_role;

-- Storage deletions must go through the Storage API. Queue paths durably when
-- journal/account deletion cascades, including when the backend is offline.
create table journal_service.image_deletion_queue(storage_path text primary key, created_at timestamptz not null default now());
alter table journal_service.image_deletion_queue enable row level security;
revoke all on journal_service.image_deletion_queue from public,anon,authenticated;
grant select,insert,delete on journal_service.image_deletion_queue to service_role;
create function journal_service.queue_image_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into journal_service.image_deletion_queue(storage_path) values(old.storage_path) on conflict do nothing;
  return old;
end;
$$;
revoke all on function journal_service.queue_image_deletion() from public,anon,authenticated;
create trigger queue_image_deletion after delete on journal_service.journal_images
for each row execute function journal_service.queue_image_deletion();
create function journal_service.remove_deleted_journal_images() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null then delete from journal_service.journal_images where journal_id=new.id; end if;
  return new;
end;
$$;
revoke all on function journal_service.remove_deleted_journal_images() from public,anon,authenticated;
create trigger remove_deleted_journal_images after update of deleted_at on journal_service.journals
for each row execute function journal_service.remove_deleted_journal_images();
