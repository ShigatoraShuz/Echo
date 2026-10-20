-- Rehearsal-only synthetic owner. Run ONLY in the isolated release-check container.
begin;
insert into auth.users(id) values ('fc000000-0000-4000-8000-000000000091');
insert into user_service.profiles(user_id,account_status,eligible_18_plus,onboarding_completed)
  values('fc000000-0000-4000-8000-000000000091','active',true,true);
insert into professional_service.organizations(id,slug,name,status,verified_at)
  values('fc000000-0000-4000-8000-000000000092','fictional-release-check','Fictional release check','active',now());
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare r professional_service.support_requests;
begin
  select * into r from professional_service.create_request_v2(
    'fc000000-0000-4000-8000-000000000093','fc000000-0000-4000-8000-000000000092',
    'fc000000-0000-4000-8000-000000000091',null,
    'echo:encrypted:v1:fictional-sql-check','echo:encrypted:v1:fictional-sql-check','professional-request-v2','[]'::jsonb);
  select * into r from professional_service.withdraw_request(r.id,'fc000000-0000-4000-8000-000000000091');
  if r.status <> 'withdrawn' then raise exception 'OWNER_WITHDRAWAL_REGRESSION'; end if;
end $$;
rollback;
