begin;

create table user_service.daily_distress_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  rating_ciphertext text not null,
  primary key (user_id, local_date)
);

alter table user_service.daily_distress_checkins enable row level security;
revoke all on user_service.daily_distress_checkins from public, anon, authenticated;
grant select, insert, update, delete on user_service.daily_distress_checkins to service_role;

-- Suggestions stay in the authenticated notification bell.
drop trigger enqueue_notification_channels_after_insert on notification_service.notifications;
create trigger enqueue_notification_channels_after_insert
  after insert on notification_service.notifications for each row
  when (new.notification_type <> 'daily_distress_suggestion')
  execute function notification_service.enqueue_notification_channels();

commit;
