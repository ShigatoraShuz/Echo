-- Keep the draft UUID receipt with its submitted journal after the short-lived
-- HTTP idempotency record expires. No journal content is copied into the receipt.
alter table journal_service.journals
  add column draft_submission_key uuid,
  add column draft_request_hash text,
  add column draft_submission_receipt jsonb;
create unique index journals_draft_submission_once
  on journal_service.journals(user_id,draft_submission_key)
  where draft_submission_key is not null;

create function journal_service.submit_draft_journal(
  p_user_id uuid, p_title_sentinel text, p_content_ciphertext text, p_encryption_iv text,
  p_encryption_auth_tag text, p_encryption_key_version integer, p_word_count integer,
  p_mood text, p_emotions jsonb, p_tags jsonb, p_privacy_status text,
  p_analysis_requested boolean, p_initial_status text, p_fixture text, p_processing_mode text,
  p_idempotency_key_version text, p_idempotency_hmac text, p_request_hash text, p_draft_key uuid
) returns table (journal_id uuid, analysis_job_id uuid, result_status text, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare existing journal_service.journals; submitted record;
begin
  if p_draft_key is null then raise exception 'DRAFT_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('draft-submit:'||p_user_id::text||':'||p_draft_key::text,0));
  select * into existing from journal_service.journals
    where user_id=p_user_id and draft_submission_key=p_draft_key;
  if found then
    if existing.draft_request_hash is distinct from p_request_hash then
      raise exception using errcode='23505',message='IDEMPOTENCY_CONFLICT';
    end if;
    if existing.deleted_at is not null then raise exception 'JOURNAL_NOT_FOUND'; end if;
    return query select existing.id,
      (existing.draft_submission_receipt->>'analysisJobId')::uuid,
      existing.draft_submission_receipt->>'status',true;
    return;
  end if;
  -- Reuse all existing consent gates, audit events, job creation and HTTP replay.
  select * into submitted from journal_service.submit_journal(
    p_user_id,p_title_sentinel,p_content_ciphertext,p_encryption_iv,p_encryption_auth_tag,
    p_encryption_key_version,p_word_count,p_mood,p_emotions,p_tags,p_privacy_status,
    p_analysis_requested,p_initial_status,p_fixture,p_processing_mode,
    p_idempotency_key_version,p_idempotency_hmac,p_request_hash);
  update journal_service.journals set draft_submission_key=p_draft_key,
    draft_request_hash=p_request_hash,
    draft_submission_receipt=jsonb_build_object('analysisJobId',submitted.analysis_job_id,'status',submitted.result_status)
    where id=submitted.journal_id and user_id=p_user_id;
  return query select submitted.journal_id,submitted.analysis_job_id,submitted.result_status,submitted.replayed;
end;
$$;
revoke all on function journal_service.submit_draft_journal(uuid,text,text,text,text,integer,integer,text,jsonb,jsonb,text,boolean,text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function journal_service.submit_draft_journal(uuid,text,text,text,text,integer,integer,text,jsonb,jsonb,text,boolean,text,text,text,text,text,text,uuid) to service_role;
