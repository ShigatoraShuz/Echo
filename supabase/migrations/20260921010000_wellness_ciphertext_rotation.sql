begin;
-- Owner/submission-bound compare-and-swap: stale migration reads never overwrite newer data.
create function insights_service.replace_assessment_ciphertext(
 p_id uuid,p_user_id uuid,p_submission_id uuid,p_expected_ciphertext text,
 p_expected_responses smallint[],p_expected_score integer,p_expected_severity text,p_ciphertext text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if p_ciphertext is null or p_ciphertext not like 'echo:encrypted:v1:%' or octet_length(p_ciphertext)>12000 then
  raise exception 'INVALID_CIPHERTEXT_MIGRATION';
 end if;
 update insights_service.phq8_assessments set assessment_ciphertext=p_ciphertext,responses=null,score=null,severity=null
 where id=p_id and user_id=p_user_id and submission_id=p_submission_id
 and assessment_ciphertext is not distinct from p_expected_ciphertext
 and responses is not distinct from p_expected_responses
 and score is not distinct from p_expected_score
 and severity is not distinct from p_expected_severity;
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function insights_service.replace_assessment_ciphertext(uuid,uuid,uuid,text,smallint[],integer,text,text) from public,anon,authenticated;
grant execute on function insights_service.replace_assessment_ciphertext(uuid,uuid,uuid,text,smallint[],integer,text,text) to service_role;
commit;
