begin;
-- A successful getUser() does not itself prove that a previously signed JWT's
-- session still exists after sign-out. Only the backend may query this bridge.
create function user_service.security_session_active(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id
    and (s.not_after is null or s.not_after>now()))
$$;
revoke all on function user_service.security_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function user_service.security_session_active(uuid,uuid) to service_role;
commit;
