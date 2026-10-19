begin;

create table notification_service.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  subscription_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint_hash)
);
create index push_subscriptions_user_idx on notification_service.push_subscriptions (user_id);
alter table notification_service.push_subscriptions enable row level security;
revoke all on notification_service.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on notification_service.push_subscriptions to service_role;

alter table notification_service.notification_logs
  add column if not exists push_subscription_id uuid references notification_service.push_subscriptions(id) on delete set null,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists lease_until timestamptz,
  add column if not exists claim_token uuid,
  add column if not exists failure_code text;
alter table notification_service.notification_logs
  add constraint notification_logs_notification_fk foreign key (notification_id)
  references notification_service.notifications(id) on delete cascade not valid;
create unique index notification_email_once_idx on notification_service.notification_logs (notification_id)
  where channel = 'email';
create unique index notification_push_once_idx on notification_service.notification_logs (notification_id, push_subscription_id)
  where channel = 'push';
create index notification_delivery_due_idx on notification_service.notification_logs (next_attempt_at, created_at)
  where channel in ('email', 'push') and delivery_status in ('pending', 'processing');
revoke all on notification_service.notification_logs from anon, authenticated;
grant select, insert, update, delete on notification_service.notification_logs to service_role;

create or replace function notification_service.enqueue_notification_channels()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from user_service.profiles p where p.user_id = new.user_id and p.account_status = 'active') then
    insert into notification_service.notification_logs (notification_id, channel)
    select new.id, 'email' from user_service.notification_preferences p
    where p.user_id = new.user_id and p.email_enabled
    on conflict do nothing;

    insert into notification_service.notification_logs (notification_id, channel, push_subscription_id)
    select new.id, 'push', s.id
    from user_service.notification_preferences p
    join notification_service.push_subscriptions s on s.user_id = p.user_id
    where p.user_id = new.user_id and p.push_enabled
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function notification_service.enqueue_notification_channels() from public, anon, authenticated;
create trigger enqueue_notification_channels_after_insert
  after insert on notification_service.notifications for each row
  execute function notification_service.enqueue_notification_channels();

create or replace function notification_service.claim_notification_deliveries(
  p_limit integer default 20, p_channels text[] default array['email', 'push']::text[])
returns table (
  id uuid, notification_id uuid, user_id uuid, notification_type text, channel text,
  push_subscription_id uuid, claim_token uuid, attempt_count integer, enabled boolean,
  lock_screen_private boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Notification delivery requires the service role' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Invalid delivery batch size' using errcode = '22023';
  end if;
  if p_channels is null or p_channels <@ array['email', 'push']::text[] is not true then
    raise exception 'Invalid delivery channel' using errcode = '22023';
  end if;
  return query
  with due as (
    select l.id from notification_service.notification_logs l
    where l.channel = any(p_channels)
      and (l.delivery_status = 'pending' or (l.delivery_status = 'processing' and l.lease_until < now()))
      and l.next_attempt_at <= now()
    order by l.next_attempt_at, l.created_at, l.id
    for update skip locked limit p_limit
  ), claimed as (
    update notification_service.notification_logs l
    set delivery_status = 'processing', attempt_count = l.attempt_count + 1,
        claim_token = gen_random_uuid(), lease_until = now() + interval '5 minutes'
    from due where l.id = due.id
    returning l.id, l.notification_id, l.channel, l.push_subscription_id, l.claim_token, l.attempt_count
  )
  select c.id, c.notification_id, n.user_id, n.notification_type, c.channel,
         c.push_subscription_id, c.claim_token, c.attempt_count,
         coalesce((case when c.channel = 'email' then p.email_enabled else p.push_enabled end)
           and profile.account_status = 'active' and n.created_at >= now() - interval '7 days', false),
         coalesce(priv.lock_screen_private, true)
  from claimed c
  join notification_service.notifications n on n.id = c.notification_id
  left join user_service.notification_preferences p on p.user_id = n.user_id
  left join user_service.profiles profile on profile.user_id = n.user_id
  left join user_service.privacy_preferences priv on priv.user_id = n.user_id;
end;
$$;
revoke all on function notification_service.claim_notification_deliveries(integer,text[]) from public, anon, authenticated;
grant execute on function notification_service.claim_notification_deliveries(integer,text[]) to service_role;

commit;
