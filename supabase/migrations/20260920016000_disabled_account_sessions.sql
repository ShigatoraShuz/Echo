begin;
-- Managed Auth signature verification and session existence must also respect account suspension.
create or replace function user_service.security_session_active(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
 join user_service.profiles p on p.user_id=s.user_id and p.account_status='active'
 where s.id=p_session_id and s.user_id=p_user_id and (s.not_after is null or s.not_after>now()))
$$;
revoke all on function user_service.security_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function user_service.security_session_active(uuid,uuid) to service_role;
commit;
