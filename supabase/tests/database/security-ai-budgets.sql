begin;
set local timezone = 'Pacific/Kiritimati';
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','budget-a@example.test'),
 ('10000000-0000-4000-8000-000000000002','budget-b@example.test'),
 ('10000000-0000-4000-8000-000000000003','budget-c@example.test');
update ai_analysis.quota_policy set per_user_daily=30,global_daily=1000,per_user_outstanding=1,global_outstanding=2;
create function pg_temp.enqueue(p_user uuid) returns void language sql as $$
 insert into ai_analysis.analysis_requests(request_id,user_id,source_feature,source_record_id,analysis_type,status)
 values(gen_random_uuid(),p_user,'journal',gen_random_uuid(),'journal_reflection','waiting_for_provider');
$$;
create function pg_temp.expect_quota(p_user uuid) returns void language plpgsql as $$ begin
 begin perform pg_temp.enqueue(p_user); raise exception 'Quota bypass';
 exception when raise_exception then if sqlerrm<>'AI_QUOTA_EXCEEDED' then raise; end if; end;
end $$;
select pg_temp.enqueue('10000000-0000-4000-8000-000000000001');
do $$ begin
 if exists(select 1 from ai_analysis.analysis_requests where user_id='10000000-0000-4000-8000-000000000001' and created_at <> now()) then
  raise exception 'Admission timestamp shifted by session timezone';
 end if;
end $$;
set local timezone = 'Etc/GMT+12';
select pg_temp.expect_quota('10000000-0000-4000-8000-000000000001'); -- per-user outstanding
select pg_temp.enqueue('10000000-0000-4000-8000-000000000002');
select pg_temp.expect_quota('10000000-0000-4000-8000-000000000003'); -- global outstanding
update ai_analysis.quota_policy set per_user_outstanding=10,global_outstanding=100,per_user_daily=1;
select pg_temp.expect_quota('10000000-0000-4000-8000-000000000001'); -- daily user budget
update ai_analysis.quota_policy set per_user_daily=30,global_daily=2;
select pg_temp.expect_quota('10000000-0000-4000-8000-000000000003'); -- daily global budget
update ai_analysis.quota_policy set global_daily=1000;
insert into ai_analysis.analysis_requests(request_id,user_id,source_feature,source_record_id,analysis_type,status,created_at)
values(gen_random_uuid(),'10000000-0000-4000-8000-000000000003','journal',gen_random_uuid(),'journal_reflection','waiting_for_provider',now()-interval '2 days');
do $$ begin
 if exists(select 1 from ai_analysis.analysis_requests where user_id='10000000-0000-4000-8000-000000000003' and created_at <> now()) then
  raise exception 'Caller can backdate quota admission';
 end if;
end $$;
update ai_analysis.quota_policy set per_user_daily=1;
select pg_temp.expect_quota('10000000-0000-4000-8000-000000000003');
set local role service_role;
do $$ begin
 begin update ai_analysis.quota_policy set global_daily=10000;
 raise exception 'Runtime can raise its own budget'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
