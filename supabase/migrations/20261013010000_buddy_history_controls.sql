alter table user_service.privacy_preferences
  add column if not exists buddy_history_enabled boolean not null default true;

alter table buddy_service.buddy_conversations
  add column if not exists title_ciphertext text,
  add column if not exists preview_ciphertext text,
  add column if not exists title_manual boolean not null default false;

-- Saved chats are written through the gated backend, which encrypts content and
-- applies the history preference. Direct client writes could bypass both rules.
revoke insert, update, delete on buddy_service.buddy_conversations,
  buddy_service.buddy_messages from authenticated, anon;

drop policy if exists buddy_conversations_insert_own on buddy_service.buddy_conversations;

drop policy if exists buddy_conversations_update_own on buddy_service.buddy_conversations;

drop policy if exists buddy_conversations_delete_own on buddy_service.buddy_conversations;

drop policy if exists buddy_messages_insert_user_owned_conversation on buddy_service.buddy_messages;

create table if not exists buddy_service.conversation_search_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  source_type text not null check (source_type in ('title', 'message')),
  source_id uuid not null,
  token_hash text not null,
  primary key (user_id, conversation_id, source_type, source_id, token_hash),
  foreign key (conversation_id, user_id)
    references buddy_service.buddy_conversations(id, user_id) on delete cascade
);

create index if not exists buddy_search_token_lookup
  on buddy_service.conversation_search_tokens(user_id, token_hash, conversation_id);

alter table buddy_service.conversation_search_tokens enable row level security;

revoke all on buddy_service.conversation_search_tokens from anon, authenticated;

grant select, insert, update, delete on buddy_service.conversation_search_tokens to service_role;

create or replace function buddy_service.search_history(p_user_id uuid, p_hashes text[], p_page integer, p_page_size integer)
returns table(id uuid, title text, title_ciphertext text, preview_ciphertext text,
  pinned_at timestamptz, last_message_at timestamptz, created_at timestamptz, total bigint)
language sql stable security definer set search_path = ''
as $$
  with matches as (
    select t.conversation_id from buddy_service.conversation_search_tokens t
    where t.user_id = p_user_id and t.token_hash = any(p_hashes)
    group by t.conversation_id
    having count(distinct t.token_hash) = cardinality(p_hashes)
  )
  select c.id,c.title,c.title_ciphertext,c.preview_ciphertext,c.pinned_at,
    c.last_message_at,c.created_at,count(*) over() as total
  from buddy_service.buddy_conversations c join matches m on m.conversation_id=c.id
  where c.user_id=p_user_id
  order by c.pinned_at desc nulls last,c.last_message_at desc nulls last,c.id desc
  limit p_page_size offset (p_page-1)*p_page_size;
$$;

revoke all on function buddy_service.search_history(uuid, text[], integer, integer) from public, anon, authenticated;

grant execute on function buddy_service.search_history(uuid, text[], integer, integer) to service_role;

create or replace function buddy_service.create_conversation(p_user_id uuid, p_title_ciphertext text, p_title_hashes text[])
returns buddy_service.buddy_conversations language plpgsql security definer set search_path = '' as $$
declare
  created buddy_service.buddy_conversations%rowtype;
  saving_enabled boolean;
begin
  select buddy_history_enabled into saving_enabled from user_service.privacy_preferences
    where user_id=p_user_id for share;
  if saving_enabled is false then raise exception 'BUDDY_HISTORY_DISABLED'; end if;
  insert into buddy_service.buddy_conversations(user_id,title,title_ciphertext,archived)
    values(p_user_id,'Buddy conversation',p_title_ciphertext,false) returning * into created;
  insert into buddy_service.conversation_search_tokens(user_id,conversation_id,source_type,source_id,token_hash)
    select p_user_id,created.id,'title',created.id,h from unnest(p_title_hashes) h on conflict do nothing;
  return created;
end;
$$;

revoke all on function buddy_service.create_conversation(uuid,text,text[]) from public, anon, authenticated;

grant execute on function buddy_service.create_conversation(uuid,text,text[]) to service_role;

create or replace function buddy_service.rename_conversation(
  p_user_id uuid, p_conversation_id uuid, p_title_ciphertext text, p_title_hashes text[]
) returns buddy_service.buddy_conversations language plpgsql security definer set search_path = '' as $$
declare renamed buddy_service.buddy_conversations%rowtype;
begin
  update buddy_service.buddy_conversations set title='Buddy conversation',
    title_ciphertext=p_title_ciphertext,title_manual=true
    where id=p_conversation_id and user_id=p_user_id returning * into renamed;
  if not found then raise exception 'BUDDY_NOT_FOUND'; end if;
  delete from buddy_service.conversation_search_tokens
    where user_id=p_user_id and conversation_id=p_conversation_id and source_type='title';
  insert into buddy_service.conversation_search_tokens(user_id,conversation_id,source_type,source_id,token_hash)
    select p_user_id,p_conversation_id,'title',p_conversation_id,h from unnest(p_title_hashes) h
    on conflict do nothing;
  return renamed;
end;
$$;

revoke all on function buddy_service.rename_conversation(uuid,uuid,text,text[]) from public, anon, authenticated;

grant execute on function buddy_service.rename_conversation(uuid,uuid,text,text[]) to service_role;

create or replace function buddy_service.save_exchange(
  p_user_id uuid, p_conversation_id uuid, p_user_content text, p_buddy_content text,
  p_urgent boolean, p_preview text, p_auto_title text,
  p_user_hashes text[], p_buddy_hashes text[], p_title_hashes text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  current_chat buddy_service.buddy_conversations%rowtype;
  user_message_id uuid;
  buddy_message_id uuid;
  saving_enabled boolean;
begin
  select buddy_history_enabled into saving_enabled from user_service.privacy_preferences
    where user_id=p_user_id for share;
  if saving_enabled is false then raise exception 'BUDDY_HISTORY_DISABLED'; end if;
  select * into current_chat from buddy_service.buddy_conversations
  where id=p_conversation_id and user_id=p_user_id for update;
  if not found then raise exception 'BUDDY_NOT_FOUND'; end if;
  insert into buddy_service.buddy_messages(conversation_id,user_id,role,content,is_flagged)
    values(p_conversation_id,p_user_id,'user',p_user_content,p_urgent) returning id into user_message_id;
  insert into buddy_service.buddy_messages(conversation_id,user_id,role,content,is_flagged)
    values(p_conversation_id,p_user_id,'assistant',p_buddy_content,p_urgent) returning id into buddy_message_id;
  update buddy_service.buddy_conversations set
    last_message_at=now(), preview_ciphertext=p_preview,
    title_ciphertext=case when current_chat.last_message_at is null and not current_chat.title_manual
      and p_auto_title is not null then p_auto_title else title_ciphertext end,
    title=case when current_chat.last_message_at is null and not current_chat.title_manual
      and p_auto_title is not null then 'Buddy conversation' else title end
  where id=p_conversation_id and user_id=p_user_id;
  if current_chat.last_message_at is null and not current_chat.title_manual and p_auto_title is not null then
    delete from buddy_service.conversation_search_tokens
      where user_id=p_user_id and conversation_id=p_conversation_id and source_type='title';
    insert into buddy_service.conversation_search_tokens(user_id,conversation_id,source_type,source_id,token_hash)
      select p_user_id,p_conversation_id,'title',p_conversation_id,h from unnest(p_title_hashes) h
      on conflict do nothing;
  end if;
  insert into buddy_service.conversation_search_tokens(user_id,conversation_id,source_type,source_id,token_hash)
    select p_user_id,p_conversation_id,'message',user_message_id,h from unnest(p_user_hashes) h
    on conflict do nothing;
  insert into buddy_service.conversation_search_tokens(user_id,conversation_id,source_type,source_id,token_hash)
    select p_user_id,p_conversation_id,'message',buddy_message_id,h from unnest(p_buddy_hashes) h
    on conflict do nothing;
  if p_urgent then
    insert into user_service.audit_events(user_id,event_type,resource_type,resource_id,request_id,metadata)
      values(p_user_id,'buddy.urgent_language_detected','buddy_conversation',p_conversation_id,
        gen_random_uuid(),'{"support_resources_shown":true}'::jsonb);
  end if;
end;
$$;

revoke all on function buddy_service.save_exchange(uuid,uuid,text,text,boolean,text,text,text[],text[],text[]) from public, anon, authenticated;

grant execute on function buddy_service.save_exchange(uuid,uuid,text,text,boolean,text,text,text[],text[],text[]) to service_role;
