begin;
insert into auth.users(id,email) values ('72000000-0000-4000-8000-000000000001','migration-a@example.test'),('72000000-0000-4000-8000-000000000002','migration-b@example.test');
-- Recreate a pre-migration historical row, then restore the exact deployed new-write constraint.
alter table insights_service.phq8_assessments drop constraint assessment_ciphertext_only;
insert into insights_service.phq8_assessments(id,user_id,submission_id,responses,score,severity,completed_at)
values ('72100000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001',array[1,1,1,1,1,1,1,1],8,'mild','2026-01-01T00:00:00Z');
alter table insights_service.phq8_assessments add constraint assessment_ciphertext_only check (
 coalesce(assessment_ciphertext like 'echo:encrypted:v1:%' and octet_length(assessment_ciphertext)<=12000,false)
 and responses is null and score is null and severity is null
) not valid;
set local role service_role;
select insights_service.save_encrypted_phq8('72000000-0000-4000-8000-000000000002','72200000-0000-4000-8000-000000000002','echo:encrypted:v1:synthetic-new',7);
do $$ begin
 if insights_service.replace_assessment_ciphertext('72100000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','72200000-0000-4000-8000-000000000001',null,array[1,1,1,1,1,1,1,1]::smallint[],8,'mild','echo:encrypted:v1:synthetic') then raise exception 'Cross-owner migration'; end if;
 if not insights_service.replace_assessment_ciphertext('72100000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001',null,array[1,1,1,1,1,1,1,1]::smallint[],8,'mild','echo:encrypted:v1:synthetic') then raise exception 'Backfill failed'; end if;
 if insights_service.replace_assessment_ciphertext('72100000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','72200000-0000-4000-8000-000000000001',null,array[1,1,1,1,1,1,1,1]::smallint[],8,'mild','echo:encrypted:v1:stale') then raise exception 'Stale snapshot overwrote migration'; end if;
 if not exists(select 1 from insights_service.phq8_assessments where id='72100000-0000-4000-8000-000000000001' and responses is null and score is null and severity is null and completed_at='2026-01-01T00:00:00Z') then raise exception 'Plaintext retained or original time lost'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform insights_service.replace_assessment_ciphertext(null,null,null,null,null,null,null,'echo:encrypted:v1:synthetic'); raise exception 'Browser can migrate';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
