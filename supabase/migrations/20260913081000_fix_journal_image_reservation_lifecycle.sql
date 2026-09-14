-- Journal image reservations previously counted every reservation toward the
-- five-photo limit indefinitely, including uploads that failed before they
-- could be marked as uploaded.
--
-- Reservations now have a bounded active lifetime. Failed uploads can release
-- their reservation immediately, abandoned uploads naturally stop consuming a
-- slot, retries can reclaim the same image reservation, and successfully
-- attached photos always remain subject to the hard five-photo limit.

alter table journal_service.journal_images
  add column if not exists reservation_expires_at timestamptz;

-- Preserve existing uploaded rows permanently while giving old unfinished
-- reservations a bounded lifetime based on their original creation time.
update journal_service.journal_images
set reservation_expires_at = case
  when uploaded then null
  else coalesce(
    reservation_expires_at,
    created_at + interval '30 minutes'
  )
end;

create index if not exists journal_images_reservation_limit_idx
  on journal_service.journal_images (
    journal_id,
    uploaded,
    reservation_expires_at
  );

create or replace function journal_service.reserve_journal_image(
  p_user_id uuid,
  p_journal_id uuid,
  p_image_id uuid,
  p_hash text,
  p_mime_type text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  image journal_service.journal_images;
  path text;
  active_count integer;
  next_expiry timestamptz;
begin
  -- Serialize reservations for one journal so concurrent requests cannot
  -- independently claim more slots than the journal allows.
  perform 1
  from journal_service.journals
  where id = p_journal_id
    and user_id = p_user_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'JOURNAL_NOT_FOUND';
  end if;

  next_expiry := now() + interval '30 minutes';

  select *
  into image
  from journal_service.journal_images
  where id = p_image_id;

  if found then
    if
      image.user_id <> p_user_id
      or image.journal_id <> p_journal_id
      or image.content_hash <> p_hash
      or image.mime_type <> p_mime_type
    then
      raise exception 'IMAGE_CONFLICT';
    end if;

    -- A completed image is already attached. Returning the same path keeps
    -- retries idempotent without consuming another slot.
    if image.uploaded then
      return image.storage_path;
    end if;

    -- Reclaiming an unfinished reservation must still respect the current
    -- five-slot limit. Exclude this reservation itself while checking whether
    -- there is room to reactivate it.
    select count(*)
    into active_count
    from journal_service.journal_images
    where journal_id = p_journal_id
      and id <> p_image_id
      and (
        uploaded = true
        or coalesce(
          reservation_expires_at,
          created_at + interval '30 minutes'
        ) > now()
      );

    if active_count >= 5 then
      raise exception 'IMAGE_LIMIT';
    end if;

    update journal_service.journal_images
    set reservation_expires_at = next_expiry
    where id = p_image_id
      and uploaded = false;

    return image.storage_path;
  end if;

  -- Uploaded photos always count. Pending reservations count only while they
  -- are actively reserved, so crashed or failed requests cannot consume slots
  -- forever.
  select count(*)
  into active_count
  from journal_service.journal_images
  where journal_id = p_journal_id
    and (
      uploaded = true
      or coalesce(
        reservation_expires_at,
        created_at + interval '30 minutes'
      ) > now()
    );

  if active_count >= 5 then
    raise exception 'IMAGE_LIMIT';
  end if;

  path :=
    p_user_id::text
    || '/'
    || p_journal_id::text
    || '/'
    || p_image_id::text;

  insert into journal_service.journal_images (
    id,
    journal_id,
    user_id,
    storage_path,
    content_hash,
    mime_type,
    reservation_expires_at
  )
  values (
    p_image_id,
    p_journal_id,
    p_user_id,
    path,
    p_hash,
    p_mime_type,
    next_expiry
  );

  return path;
end;
$$;

revoke all
on function journal_service.reserve_journal_image(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function journal_service.reserve_journal_image(
  uuid,
  uuid,
  uuid,
  text,
  text
)
to service_role;

-- Reservation expiry protects against abandoned uploads, but the final write
-- also needs a hard limit. This prevents an unusually long-running upload from
-- completing after its reservation expired and becoming a sixth attached
-- image.
create or replace function journal_service.enforce_journal_image_uploaded_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uploaded_count integer;
begin
  if new.uploaded = true and old.uploaded = false then
    perform 1
    from journal_service.journals
    where id = new.journal_id
      and user_id = new.user_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'JOURNAL_NOT_FOUND';
    end if;

    select count(*)
    into uploaded_count
    from journal_service.journal_images
    where journal_id = new.journal_id
      and uploaded = true
      and id <> new.id;

    if uploaded_count >= 5 then
      raise exception 'IMAGE_LIMIT';
    end if;

    -- Completed photos no longer need an expiring reservation.
    new.reservation_expires_at := null;
  end if;

  return new;
end;
$$;

revoke all
on function journal_service.enforce_journal_image_uploaded_limit()
from public, anon, authenticated;

drop trigger if exists enforce_journal_image_uploaded_limit
on journal_service.journal_images;

create trigger enforce_journal_image_uploaded_limit
before update of uploaded
on journal_service.journal_images
for each row
execute function journal_service.enforce_journal_image_uploaded_limit();