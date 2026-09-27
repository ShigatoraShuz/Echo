-- Narrow compare-and-swap used only by the reviewed migration operator.
begin;
create or replace function buddy_service.replace_message_ciphertext(
 p_id uuid, p_user_id uuid, p_expected_digest text, p_ciphertext text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if p_expected_digest !~ '^[a-f0-9]{64}$' or p_ciphertext not like 'echo:encrypted:v1:%' or length(p_ciphertext)>131072 then
  raise exception 'INVALID_CIPHERTEXT_MIGRATION';
 end if;
 update buddy_service.buddy_messages set content=p_ciphertext
 where id=p_id and user_id=p_user_id and encode(extensions.digest(content,'sha256'),'hex')=p_expected_digest;
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function buddy_service.replace_message_ciphertext(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function buddy_service.replace_message_ciphertext(uuid,uuid,text,text) to service_role;
commit;
