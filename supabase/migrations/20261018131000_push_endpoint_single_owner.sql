-- A browser subscription must never deliver alerts for two signed-in accounts.
begin;

create unique index push_subscriptions_endpoint_single_owner_idx
  on notification_service.push_subscriptions (endpoint_hash);

commit;
