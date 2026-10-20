begin;
insert into auth.users(id,email) values
 ('74000000-0000-4000-8000-000000000001','erasure-a@example.test'),
 ('74000000-0000-4000-8000-000000000002','erasure-b@example.test');
insert into user_service.profiles(user_id) values
 ('74000000-0000-4000-8000-000000000001'),
 ('74000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into auth.sessions(id,user_id,not_after) values
 ('74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000001',now()+interval '1 hour');
insert into notification_service.notifications(id,user_id,notification_type,title,message) values
 ('74000000-0000-4000-8000-000000000011','74000000-0000-4000-8000-000000000001','test','Notice','Synthetic');
insert into notification_service.notification_logs(notification_id,channel) values
 ('74000000-0000-4000-8000-000000000011','in_app');

set local role service_role;
do $$ declare v_request_id uuid; begin
 v_request_id:=user_service.request_account_deletion('74000000-0000-4000-8000-000000000001');
 if not exists(select 1 from user_service.account_erasure_jobs where request_id=v_request_id and state='pending')
  then raise exception 'Durable erasure job missing'; end if;
 if user_service.cancel_account_deletion('74000000-0000-4000-8000-000000000002',v_request_id)
  then raise exception 'Wrong-owner cancellation'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000001","session_id":"74000000-0000-4000-8000-000000000021"}',true);
do $$ begin
 if exists(select 1 from user_service.profiles where user_id='74000000-0000-4000-8000-000000000001')
  then raise exception 'Pending account can still read profile'; end if;
 if user_service.account_data_access_allowed('74000000-0000-4000-8000-000000000001')
  then raise exception 'Pending account data access remained active'; end if;
 if not exists(select 1 from user_service.account_deletion_requests where user_id='74000000-0000-4000-8000-000000000001')
  then raise exception 'Pending account cannot see deletion status'; end if;
end $$;
reset role;

set local role service_role;
do $$ declare v_request_id uuid; begin
 select id into v_request_id from user_service.account_deletion_requests
  where user_id='74000000-0000-4000-8000-000000000001' and request_status='pending';
 if not user_service.cancel_account_deletion('74000000-0000-4000-8000-000000000001',v_request_id)
  then raise exception 'Owner cancellation failed'; end if;
 if not exists(select 1 from user_service.account_erasure_jobs where request_id=v_request_id and state='cancelled' and user_id is null)
  then raise exception 'Cancelled job can still erase account'; end if;
 perform user_service.request_account_deletion('74000000-0000-4000-8000-000000000001');
 update user_service.account_erasure_jobs set scheduled_for=now()-interval '1 minute'
  where user_id='74000000-0000-4000-8000-000000000001';
end $$;
do $$ declare job user_service.account_erasure_jobs; begin
 job:=user_service.claim_account_erasure();
 if job.user_id<>'74000000-0000-4000-8000-000000000001' or job.state<>'processing'
  then raise exception 'Due erasure claim failed'; end if;
 if user_service.cancel_account_deletion(job.user_id,job.request_id)
  then raise exception 'Processing erasure was cancelled'; end if;
 if (select account_status from user_service.profiles where user_id=job.user_id)<>'disabled'
  then raise exception 'Processing account was not frozen'; end if;
 insert into user_service.account_erasure_objects(request_id,bucket,object_path)
  values(job.request_id,'avatars',job.user_id::text||'/synthetic.png');
 if user_service.category_retention_approved() then raise exception 'Unapproved retention activated'; end if;
 if (user_service.run_category_retention(true)->>'dryRun')<>'true' then raise exception 'Retention dry run failed'; end if;
 if (professional_service.run_audit_retention(true)->>'dryRun')<>'true'
  then raise exception 'Approved audit retention dry run failed'; end if;
 begin perform user_service.run_category_retention(false); raise exception 'Unapproved retention applied';
 exception when raise_exception then
  if sqlerrm='Unapproved retention applied' then raise; end if;
 end;
 perform user_service.prepare_account_erasure_relations(job.user_id);
 if exists(select 1 from user_service.audit_events where user_id=job.user_id and
  (resource_id is not null or request_id is not null or metadata<>'{}'::jsonb))
  then raise exception 'Audit references were not sanitized'; end if;
end $$;
reset role;

-- Simulate the provider's hard-delete transaction after the worker has removed files.
delete from notification_service.notification_logs where notification_id='74000000-0000-4000-8000-000000000011';
delete from auth.sessions where user_id='74000000-0000-4000-8000-000000000001';
delete from auth.users where id='74000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ declare job user_service.account_erasure_jobs; begin
 select * into job from user_service.account_erasure_jobs
  where user_id='74000000-0000-4000-8000-000000000001' and state='processing';
 if user_service.account_erasure_remaining_rows(job.user_id)<>'{}'::jsonb
  then raise exception 'Owned rows survived account deletion'; end if;
 begin
  perform user_service.finish_account_erasure(job.request_id,job.lease_token,repeat('a',64));
  raise exception 'Incomplete storage manifest was accepted';
 exception when raise_exception then
  if sqlerrm='Incomplete storage manifest was accepted' then raise; end if;
 end;
 update user_service.account_erasure_objects set deleted_at=now() where request_id=job.request_id;
 if not user_service.finish_account_erasure(job.request_id,job.lease_token,repeat('a',64))
  then raise exception 'Verified erasure not completed'; end if;
 if not exists(select 1 from user_service.account_erasure_jobs
  where request_id=job.request_id and state='completed' and user_id is null and subject_hash=repeat('a',64))
  then raise exception 'Content-free tombstone missing'; end if;
end $$;
reset role;
rollback;
