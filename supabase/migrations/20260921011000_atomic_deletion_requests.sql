begin;
-- Request/cancellation only. Actual account erasure requires the separate reviewed lifecycle worker.
create function user_service.request_account_deletion(p_user_id uuid) returns uuid
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
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,created_at)
 values(p_user_id,p_user_id,'settings.account_deletion_requested','account_deletion_request',result,now());
 return result;
end $$;
create function user_service.cancel_account_deletion(p_user_id uuid,p_request_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if p_user_id is null or p_request_id is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('echo:account-deletion:'||p_user_id::text,0));
 update user_service.account_deletion_requests set request_status='cancelled',cancelled_at=now()
 where id=p_request_id and user_id=p_user_id and request_status='pending';
 get diagnostics affected=row_count;
 if affected=0 then return false; end if;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,created_at)
 values(p_user_id,p_user_id,'settings.account_deletion_cancelled','account_deletion_request',p_request_id,now());
 return true;
end $$;
revoke all on function user_service.request_account_deletion(uuid),user_service.cancel_account_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function user_service.request_account_deletion(uuid),user_service.cancel_account_deletion(uuid,uuid) to service_role;
commit;
