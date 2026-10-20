begin;

-- This record must survive the auth.users cascade until verification completes.
create table user_service.account_erasure_jobs (
  request_id uuid primary key,
  user_id uuid,
  state text not null default 'pending' check (state in ('pending','processing','retry','cancelled','completed')),
  stage text not null default 'waiting',
  scheduled_for timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  last_error_code text,
  subject_hash text unique check (subject_hash is null or subject_hash ~ '^[a-f0-9]{64}$'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state <> 'completed' or (user_id is null and subject_hash is not null and completed_at is not null))
);

create index account_erasure_due_idx on user_service.account_erasure_jobs(next_attempt_at,scheduled_for)
  where state in ('pending','retry','processing');

create table user_service.account_erasure_objects (
  request_id uuid not null references user_service.account_erasure_jobs(request_id) on delete cascade,
  bucket text not null check (bucket in ('avatars','journal-images','verification-documents')),
  object_path text not null,
  deleted_at timestamptz,
  primary key(request_id,bucket,object_path)
);

alter table user_service.account_erasure_jobs enable row level security;

alter table user_service.account_erasure_objects enable row level security;

revoke all on user_service.account_erasure_jobs,user_service.account_erasure_objects from public,anon,authenticated;

grant select,insert,update,delete on user_service.account_erasure_jobs,user_service.account_erasure_objects to service_role;

insert into user_service.account_erasure_jobs(request_id,user_id,state,scheduled_for)
select id,user_id,case when request_status='processing' then 'retry' else 'pending' end,
  coalesce(scheduled_for,requested_at+interval '30 days')
from user_service.account_deletion_requests where request_status in ('pending','processing')
on conflict(request_id) do nothing;

create unique index account_deletion_one_active_user_idx on user_service.account_deletion_requests(user_id)
  where request_status in ('pending','processing');

create or replace function user_service.request_account_deletion(p_user_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if p_user_id is null then raise exception 'DELETION_OWNER_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:account-deletion:'||p_user_id::text,0));
 select id into result from user_service.account_deletion_requests
  where user_id=p_user_id and request_status in ('pending','processing') order by requested_at limit 1 for update;
 if found then return result; end if;
 insert into user_service.account_deletion_requests(user_id,request_status,requested_at,created_at,scheduled_for)
  values(p_user_id,'pending',now(),now(),now()+interval '30 days') returning id into result;
 insert into user_service.account_erasure_jobs(request_id,user_id,scheduled_for)
  select id,user_id,scheduled_for from user_service.account_deletion_requests where id=result;
 update ai_analysis.analysis_requests set status='failed',failure_code='ACCOUNT_DELETION_PENDING',completed_at=now(),
  lease_worker_id=null,lease_token_hash=null,lease_expires_at=null
  where user_id=p_user_id and status not in ('completed','failed');
 update professional_service.appointments set status='canceled',updated_at=now()
  where status in ('proposed','confirmed') and request_id in
   (select id from professional_service.support_requests where user_id=p_user_id);
 update professional_service.case_shared_records set revoked_at=coalesce(revoked_at,now()),revoked_by=p_user_id
  where owner_user_id=p_user_id and revoked_at is null;
 update professional_service.support_requests set status='withdrawn',
  sharing_revoked_at=coalesce(sharing_revoked_at,now()),updated_at=now()
  where user_id=p_user_id and status in ('submitted','assigned','scheduled');
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,created_at)
  values(p_user_id,p_user_id,'settings.account_deletion_requested','account_deletion_request',result,now());
 return result;
end $$;

create or replace function user_service.cancel_account_deletion(p_user_id uuid,p_request_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if p_user_id is null or p_request_id is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:account-deletion:'||p_user_id::text,0));
 update user_service.account_deletion_requests set request_status='cancelled',cancelled_at=now()
  where id=p_request_id and user_id=p_user_id and request_status='pending';
 get diagnostics affected=row_count;
 if affected=0 then return false; end if;
 update user_service.account_erasure_jobs set state='cancelled',user_id=null,updated_at=now()
  where request_id=p_request_id and state='pending';
 if not found then raise exception 'DELETION_ALREADY_PROCESSING'; end if;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,created_at)
  values(p_user_id,p_user_id,'settings.account_deletion_cancelled','account_deletion_request',p_request_id,now());
 return true;
end $$;

create function user_service.claim_account_erasure() returns user_service.account_erasure_jobs
language plpgsql security definer set search_path='' as $$
declare job user_service.account_erasure_jobs;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 select * into job from user_service.account_erasure_jobs
  where user_id is not null and scheduled_for<=now() and
   ((state in ('pending','retry') and next_attempt_at<=now()) or
    (state='processing' and lease_until<now()))
  order by scheduled_for,created_at for update skip locked limit 1;
 if not found then return null; end if;
 update user_service.account_deletion_requests set request_status='processing'
  where id=job.request_id and request_status in ('pending','processing');
 update user_service.profiles set account_status='disabled' where user_id=job.user_id;
 delete from auth.sessions where user_id=job.user_id;
 update user_service.account_erasure_jobs set state='processing',stage='claimed',
  lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',attempts=attempts+1,updated_at=now()
  where request_id=job.request_id returning * into job;
 return job;
end $$;

create function user_service.renew_account_erasure(p_request_id uuid,p_lease_token uuid,p_stage text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 update user_service.account_erasure_jobs set stage=left(p_stage,64),lease_until=now()+interval '15 minutes',updated_at=now()
  where request_id=p_request_id and lease_token=p_lease_token and state='processing' and lease_until>now();
 return found;
end $$;

create function user_service.retry_account_erasure(p_request_id uuid,p_lease_token uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 update user_service.account_erasure_jobs set state='retry',stage='retry_wait',lease_token=null,lease_until=null,
  next_attempt_at=now()+least(interval '24 hours',interval '5 minutes' * power(2,least(attempts,8))),
  last_error_code=left(p_code,64),updated_at=now()
  where request_id=p_request_id and lease_token=p_lease_token and state='processing';
 return found;
end $$;

create function user_service.account_erasure_subject_exists(p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 return exists(select 1 from auth.users where id=p_user_id);
end $$;

create function user_service.account_erasure_blocked_cases(p_user_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 select count(*) into result from professional_service.support_requests
  where assigned_to=p_user_id and status in ('submitted','assigned','scheduled');
 return result;
end $$;

create function user_service.prepare_account_erasure_relations(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 -- This legacy child table has neither an account column nor an FK cascade.
 delete from notification_service.notification_logs where notification_id in
  (select id from notification_service.notifications where user_id=p_user_id);
 delete from journal_service.image_deletion_queue where storage_path like p_user_id::text||'/%';
 -- Audit rows outlive the Auth FK through SET NULL. Remove direct resource
 -- references and free-form metadata before the identity is deleted.
 update user_service.audit_events set resource_id=null,request_id=null,metadata='{}'::jsonb
  where user_id=p_user_id or actor_user_id=p_user_id;
 update professional_service.audit_events set request_id=null,subject_user_id=null
  where actor_user_id=p_user_id or subject_user_id=p_user_id;
end $$;

-- Inspect both owner columns without FKs and every reference to auth.users.
create function user_service.account_erasure_remaining_rows(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; remaining bigint; result jsonb:='{}'::jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 for item in
  select distinct n.nspname as schema_name,c.relname as table_name,a.attname as column_name
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   join pg_catalog.pg_attribute a on a.attrelid=c.oid
  where c.relkind in ('r','p') and a.atttypid='uuid'::regtype and not a.attisdropped
   and n.nspname in ('public','user_service','journal_service','buddy_service','verification_service',
    'notification_service','grounding_service','insights_service','ai_analysis','professional_service')
   and not (n.nspname='user_service' and c.relname='account_erasure_jobs')
   and a.attname not in ('request_id')
 loop
  execute format('select count(*) from %I.%I where %I=$1',item.schema_name,item.table_name,item.column_name)
   into remaining using p_user_id;
  if remaining>0 then result:=result||jsonb_build_object(item.schema_name||'.'||item.table_name||'.'||item.column_name,remaining); end if;
 end loop;
 return result;
end $$;

create function user_service.finish_account_erasure(p_request_id uuid,p_lease_token uuid,p_subject_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job user_service.account_erasure_jobs;
begin
 if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if p_subject_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SUBJECT_HASH'; end if;
 select * into job from user_service.account_erasure_jobs where request_id=p_request_id for update;
 if not found or job.state<>'processing' or job.lease_token is distinct from p_lease_token then return false; end if;
 if exists(select 1 from auth.users where id=job.user_id) or
   user_service.account_erasure_remaining_rows(job.user_id)<>'{}'::jsonb or
   exists(select 1 from user_service.account_erasure_objects where request_id=p_request_id and deleted_at is null)
 then raise exception 'ERASURE_NOT_VERIFIED'; end if;
 delete from user_service.account_erasure_objects where request_id=p_request_id;
 update user_service.account_erasure_jobs set state='completed',stage='verified',user_id=null,
  subject_hash=p_subject_hash,completed_at=now(),lease_token=null,lease_until=null,last_error_code=null,updated_at=now()
  where request_id=p_request_id;
 return true;
end $$;

-- A pending account keeps an Auth session only for the deletion/export center.
create function user_service.account_data_access_allowed(p_user_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select p_user_id is not null and not exists(select 1 from user_service.account_deletion_requests
  where user_id=p_user_id and request_status in ('pending','processing'))
$$;

revoke all on function user_service.account_data_access_allowed(uuid) from public,anon;

grant execute on function user_service.account_data_access_allowed(uuid) to authenticated,service_role;

do $$ declare item record; begin
 for item in select n.nspname,c.relname
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and c.relrowsecurity
   and n.nspname in ('public','user_service','journal_service','buddy_service','verification_service',
    'notification_service','grounding_service','insights_service','ai_analysis')
   and not (n.nspname='user_service' and c.relname in ('account_deletion_requests','data_export_requests'))
 loop
  execute format('create policy account_deletion_freeze on %I.%I as restrictive for all to authenticated using (user_service.account_data_access_allowed((select auth.uid()))) with check (user_service.account_data_access_allowed((select auth.uid())))',item.nspname,item.relname);
 end loop;
end $$;

create policy account_deletion_storage_freeze on storage.objects as restrictive for all to authenticated
 using (user_service.account_data_access_allowed((select auth.uid())))
 with check (user_service.account_data_access_allowed((select auth.uid())));

revoke all on function user_service.claim_account_erasure(),user_service.renew_account_erasure(uuid,uuid,text),
 user_service.retry_account_erasure(uuid,uuid,text),user_service.account_erasure_subject_exists(uuid),
 user_service.account_erasure_blocked_cases(uuid),user_service.prepare_account_erasure_relations(uuid),
 user_service.account_erasure_remaining_rows(uuid),
 user_service.finish_account_erasure(uuid,uuid,text) from public,anon,authenticated;

grant execute on function user_service.claim_account_erasure(),user_service.renew_account_erasure(uuid,uuid,text),
 user_service.retry_account_erasure(uuid,uuid,text),user_service.account_erasure_subject_exists(uuid),
 user_service.account_erasure_blocked_cases(uuid),user_service.prepare_account_erasure_relations(uuid),
 user_service.account_erasure_remaining_rows(uuid),
 user_service.finish_account_erasure(uuid,uuid,text) to service_role;

commit;
