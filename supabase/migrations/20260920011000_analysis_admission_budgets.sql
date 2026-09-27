begin;
-- timestamptz defaults must preserve the instant in every database session timezone.
alter table ai_analysis.analysis_requests alter column created_at set default now();
create table ai_analysis.quota_policy (
 singleton boolean primary key default true check(singleton),
 per_user_daily integer not null check(per_user_daily between 1 and 1000),
 global_daily integer not null check(global_daily between 1 and 100000),
 per_user_outstanding integer not null check(per_user_outstanding between 1 and 100),
 global_outstanding integer not null check(global_outstanding between 1 and 10000)
);
insert into ai_analysis.quota_policy values(true,30,1000,10,100);
alter table ai_analysis.quota_policy enable row level security;
revoke all on ai_analysis.quota_policy from public,anon,authenticated,service_role;
grant select on ai_analysis.quota_policy to service_role;
create function ai_analysis.enforce_admission_budget() returns trigger
language plpgsql security definer set search_path='' as $$
declare limits ai_analysis.quota_policy%rowtype; user_daily bigint; total_daily bigint; user_open bigint; total_open bigint;
begin
 if new.status in ('completed','failed') then return new; end if;
 -- Admission time is server-owned, including when a caller supplies an old timestamp.
 new.created_at := now();
 -- Serializes admission across application replicas; failed insertion rolls back.
 perform pg_advisory_xact_lock(hashtextextended('echo:analysis:admission-budget',0));
 select * into strict limits from ai_analysis.quota_policy where singleton;
 select count(*) filter(where user_id=new.user_id and created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'),
 count(*) filter(where created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc'),
 count(*) filter(where user_id=new.user_id and status not in ('completed','failed') and deleted_at is null),
 count(*) filter(where status not in ('completed','failed') and deleted_at is null)
 into user_daily,total_daily,user_open,total_open from ai_analysis.analysis_requests;
 if user_daily>=limits.per_user_daily or total_daily>=limits.global_daily or user_open>=limits.per_user_outstanding or total_open>=limits.global_outstanding then
  raise exception 'AI_QUOTA_EXCEEDED';
 end if;
 return new;
end $$;
revoke all on function ai_analysis.enforce_admission_budget() from public,anon,authenticated;
create trigger analysis_admission_budget before insert on ai_analysis.analysis_requests for each row execute function ai_analysis.enforce_admission_budget();
create index if not exists analysis_budget_created_idx on ai_analysis.analysis_requests(created_at,user_id);
commit;
