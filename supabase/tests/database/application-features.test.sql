begin;
select plan(32);
select has_table('public','phq8_assessments','PHQ history exists');
select has_table('public','journal_attachments','Image metadata exists');
select is((select pg_get_userbyid(relowner) from pg_class where oid='public.phq8_assessments'::regclass),'assessment_service_role','Assessment owns PHQ');
select is((select pg_get_userbyid(relowner) from pg_class where oid='public.journal_attachments'::regclass),'journal_service_role','Journal owns media');
select ok(not has_table_privilege('authenticated','public.phq8_assessments','SELECT'),'Browser cannot read PHQ directly');
select ok(not has_table_privilege('authenticated','public.phq8_assessments','INSERT'),'Browser cannot submit PHQ directly');
select ok(not has_table_privilege('anon','public.phq8_assessments','SELECT'),'Anonymous PHQ denied');
select ok(not has_table_privilege('journal_service_role','public.phq8_assessments','SELECT'),'Journal cannot access PHQ');
select ok(not has_table_privilege('user_service_role','public.journal_attachments','SELECT'),'User cannot access Journal media');
select ok(not has_table_privilege('authenticated','public.journal_attachments','INSERT'),'Browser metadata mutation denied');
select ok(not has_table_privilege('authenticated','public.journal_attachments','SELECT'),'Browser metadata read denied');
select ok(not has_table_privilege('journal_service_role','storage.objects','SELECT'),'Database identity cannot bypass Storage RLS');
select ok(not (select rolbypassrls from pg_roles where rolname='journal_storage_role'),'Storage identity obeys RLS');
select ok(not (select public from storage.buckets where id='journal-images'),'Journal bucket private');
select is((select file_size_limit from storage.buckets where id='journal-images'),5242880::bigint,'Storage limits image size');
select ok(has_function_privilege('journal_service_role','public.finalize_journal_draft(uuid,uuid,integer)','EXECUTE'),'Journal may atomically finalize');
select ok(not has_function_privilege('authenticated','public.finalize_journal_draft(uuid,uuid,integer)','EXECUTE'),'Browser cannot finalize directly');
select ok(not has_function_privilege('user_service_role','public.finalize_journal_draft(uuid,uuid,integer)','EXECUTE'),'Other services cannot finalize');
select ok(not has_table_privilege('recommendation_service_role','public.support_resources','UPDATE'),'Recommendation stays read-only');
select ok((select bool_and(qual like '%journal-images%') from pg_policies where schemaname='storage' and policyname in ('journal_storage_read','journal_storage_delete')),'Journal Storage policies confined to journal-images');

-- Transactional fixtures use opaque ciphertext bytes; Journal's encryption suite
-- separately verifies authenticated encryption and round trips.
-- Fixture-only override is rolled back with this test transaction.
update public.registration_settings set enforcement_enabled=false where singleton;
insert into auth.users(id,email) values ('a1000000-0000-4000-8000-000000000001','feature-owner@example.test'),('a1000000-0000-4000-8000-000000000002','feature-other@example.test');
insert into public.journal_drafts(id,user_id,content_ciphertext,encryption_iv,encryption_auth_tag,encryption_key_version,emotions,tags)
values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',decode('abcd','hex'),decode('1234','hex'),decode('5678','hex'),1,array['steady'],array['reflection']);
set local role assessment_service_role;
select lives_ok($insert into public.phq8_assessments(user_id,answers,score,severity) values('a1000000-0000-4000-8000-000000000001',array[1,1,1,1,1,1,1,1],8,'mild')$,'Assessment persists valid answers');
select throws_ok($insert into public.phq8_assessments(user_id,answers,score,severity) values('a1000000-0000-4000-8000-000000000001',array[]::integer[],0,'minimal')$,'23514',null,'Empty array rejected');
select throws_ok($insert into public.phq8_assessments(user_id,answers,score,severity) values('a1000000-0000-4000-8000-000000000001',array[4,0,0,0,0,0,0,0],4,'minimal')$,'23514',null,'Out-of-range answer rejected');
select throws_ok($insert into public.phq8_assessments(user_id,answers,score,severity) values('a1000000-0000-4000-8000-000000000001',array[1,1,1,1,1,1,1,1],0,'minimal')$,'23514',null,'Mismatched score rejected');
reset role;
set local role journal_service_role;
select throws_ok($insert into public.journal_attachments(user_id,draft_id,storage_path,mime_type,size_bytes) values('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002/foreign.png','image/png',12)$,'23514',null,'Cross-user draft attachment rejected');
select lives_ok($insert into public.journal_attachments(user_id,draft_id,storage_path,mime_type,size_bytes) values('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001/private.png','image/png',12)$,'Owner attaches private draft image');
select is((select count(*) from public.finalize_journal_draft('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001',2)),0::bigint,'Another user cannot finalize draft');
select is((select count(*) from public.finalize_journal_draft('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',2)),1::bigint,'Owner finalizes draft');
select is((select count(*) from public.journal_drafts where id='a2000000-0000-4000-8000-000000000001'),0::bigint,'Finalized draft removed');
select ok((select a.draft_id is null and a.journal_id=j.id and j.content_ciphertext=decode('abcd','hex') and j.tags='["reflection"]'::jsonb and j.emotions='["steady"]'::jsonb from public.journal_attachments a join public.journals j on j.id=a.journal_id where j.source_draft_id='a2000000-0000-4000-8000-000000000001'),'Ciphertext and media transfer with array conversion');
select is((select count(*) from public.finalize_journal_draft('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',2)),1::bigint,'Retry returns original journal');
select is((select count(*) from public.journals where source_draft_id='a2000000-0000-4000-8000-000000000001'),1::bigint,'Retry does not duplicate journal');
reset role;
select * from finish();
rollback;
