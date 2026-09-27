-- Existing rows are preserved. New writes must reference a real account;
-- existing-row validation requires a separately reviewed coverage check.
begin;
do $$ declare t record; begin
 for t in select n.nspname as schema_name,c.relname as table_name,a.attnum
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 join pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
 where n.nspname in ('user_service','journal_service','buddy_service','verification_service',
  'notification_service','grounding_service','insights_service','ai_analysis')
 and c.relkind in ('r','p')
 and not exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='f'
   and k.confrelid='auth.users'::regclass and k.conkey=array[a.attnum]::smallint[])
 loop
  execute format('alter table %I.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade not valid',
   t.schema_name,t.table_name,left(t.table_name||'_security_account_fk',63));
 end loop;
end $$;
alter table buddy_service.buddy_messages add constraint buddy_message_owner_unique unique(id,user_id);
alter table buddy_service.buddy_feedback add constraint buddy_feedback_message_owner_fk
 foreign key(message_id,user_id) references buddy_service.buddy_messages(id,user_id) on delete cascade not valid;
alter table verification_service.verification_reviews add constraint verification_review_parent_fk
 foreign key(verification_id) references verification_service.identity_verifications(id) on delete cascade not valid;
commit;
