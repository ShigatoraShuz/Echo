begin;
insert into auth.users(id,email) values
  ('40000000-0000-4000-8000-000000000001','buddy-a@example.test'),
  ('40000000-0000-4000-8000-000000000002','buddy-b@example.test');
insert into user_service.privacy_preferences(user_id) values
  ('40000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002') on conflict(user_id) do nothing;
do $$
declare chat_id uuid;
declare pinned_id uuid;
begin
  if has_table_privilege('authenticated','buddy_service.buddy_conversations','INSERT, UPDATE, DELETE')
    or has_table_privilege('authenticated','buddy_service.buddy_messages','INSERT')
    then raise exception 'Direct Buddy writes remain available to clients'; end if;
  select id into chat_id from buddy_service.create_conversation(
    '40000000-0000-4000-8000-000000000001','echo:encrypted:v1:title',array['title-token']);
  if chat_id is null then raise exception 'Conversation was not created'; end if;
  perform buddy_service.save_exchange(
    '40000000-0000-4000-8000-000000000001',chat_id,
    'echo:encrypted:v1:user','echo:encrypted:v1:buddy',false,
    'echo:encrypted:v1:preview','echo:encrypted:v1:auto-title',
    array['user-token'],array['buddy-token'],array['auto-token']);
  if (select count(*) from buddy_service.buddy_messages where conversation_id=chat_id)<>2
    then raise exception 'Exchange was not saved'; end if;
  if (select count(*) from buddy_service.search_history(
    '40000000-0000-4000-8000-000000000001',array['user-token'],1,20))<>1
    then raise exception 'Message search failed'; end if;
  if (select count(*) from buddy_service.search_history(
    '40000000-0000-4000-8000-000000000002',array['user-token'],1,20))<>0
    then raise exception 'Search leaked another user'; end if;
  begin
    perform buddy_service.rename_conversation(
      '40000000-0000-4000-8000-000000000002',chat_id,'echo:encrypted:v1:foreign',array['foreign']);
    raise exception 'Foreign rename was accepted';
  exception when others then
    if sqlerrm <> 'BUDDY_NOT_FOUND' then raise; end if;
  end;
  perform buddy_service.rename_conversation(
    '40000000-0000-4000-8000-000000000001',chat_id,'echo:encrypted:v1:renamed',array['renamed']);
  perform buddy_service.save_exchange(
    '40000000-0000-4000-8000-000000000001',chat_id,
    'echo:encrypted:v1:user2','echo:encrypted:v1:buddy2',false,
    'echo:encrypted:v1:preview2','echo:encrypted:v1:ignored-title',
    array['again'],array['reply'],array['ignored']);
  if (select title_ciphertext from buddy_service.buddy_conversations where id=chat_id)<>'echo:encrypted:v1:renamed'
    then raise exception 'Manual title was overwritten'; end if;
  if (select preview_ciphertext from buddy_service.buddy_conversations where id=chat_id)<>'echo:encrypted:v1:preview2'
    then raise exception 'Preview was not updated'; end if;
  select id into pinned_id from buddy_service.create_conversation(
    '40000000-0000-4000-8000-000000000001','echo:encrypted:v1:second-title',array['second']);
  perform buddy_service.save_exchange(
    '40000000-0000-4000-8000-000000000001',pinned_id,
    'echo:encrypted:v1:other-user','echo:encrypted:v1:other-buddy',false,
    'echo:encrypted:v1:other-preview',null,
    array['user-token'],array['other'],array[]::text[]);
  update buddy_service.buddy_conversations set pinned_at=now() where id=pinned_id;
  if (select id from buddy_service.search_history(
    '40000000-0000-4000-8000-000000000001',array['user-token'],1,20) limit 1)<>pinned_id
    then raise exception 'Pinned search ordering failed'; end if;
  if (select count(*) from buddy_service.search_history(
    '40000000-0000-4000-8000-000000000001',array['auto-token'],1,20))<>0
    then raise exception 'Old title remained searchable'; end if;
  update user_service.privacy_preferences set buddy_history_enabled=false
    where user_id='40000000-0000-4000-8000-000000000001';
  begin
    perform buddy_service.save_exchange(
      '40000000-0000-4000-8000-000000000001',chat_id,
      'echo:encrypted:v1:user','echo:encrypted:v1:buddy',false,
      'echo:encrypted:v1:preview',null,array['user'],array['buddy'],array[]::text[]);
    raise exception 'Disabled history accepted a write';
  exception when others then
    if sqlerrm <> 'BUDDY_HISTORY_DISABLED' then raise; end if;
  end;
  delete from buddy_service.buddy_conversations where id=chat_id
    and user_id='40000000-0000-4000-8000-000000000001';
  if exists(select 1 from buddy_service.buddy_messages where conversation_id=chat_id)
    or exists(select 1 from buddy_service.conversation_search_tokens where conversation_id=chat_id)
    then raise exception 'Conversation deletion did not cascade'; end if;
end $$;
rollback;
