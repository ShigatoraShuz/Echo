begin;
create table ai_analysis.journal_face_results (
 journal_id uuid primary key references journal_service.journals(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 result_ciphertext text not null check(result_ciphertext like 'echo:encrypted:v1:%'),
 created_at timestamptz not null default now()
);
alter table ai_analysis.journal_face_results enable row level security;
revoke all on ai_analysis.journal_face_results from public,anon,authenticated;
grant select,delete on ai_analysis.journal_face_results to service_role;
create function ai_analysis.save_journal_face_result(p_user_id uuid,p_journal_id uuid,p_ciphertext text,p_available boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from journal_service.journals where id=p_journal_id and user_id=p_user_id and deleted_at is null for update;
 if not found then raise exception 'FACE_JOURNAL_NOT_FOUND'; end if;
 perform 1 from user_service.privacy_preferences where user_id=p_user_id and facial_analysis_enabled and journal_ai_analysis_enabled for share;
 if not found then raise exception 'FACE_CONSENT_REQUIRED'; end if;
 if not exists(select 1 from ai_analysis.analysis_requests a where a.journal_id=p_journal_id and a.user_id=p_user_id and a.deleted_at is null and a.status not in ('failed','safety_action_required') and ai_analysis.job_gates_allow(a.id)) then raise exception 'FACE_GATES_FAILED'; end if;
 insert into ai_analysis.journal_face_results(journal_id,user_id,result_ciphertext) values(p_journal_id,p_user_id,p_ciphertext)
 on conflict(journal_id) do update set result_ciphertext=excluded.result_ciphertext,created_at=now() where journal_face_results.user_id=p_user_id;
 update ai_analysis.analysis_requests set facial_status=case when p_available then 'completed' else 'unavailable' end where journal_id=p_journal_id and user_id=p_user_id;
 update public.analysis_status_projection set facial_status=case when p_available then 'completed' else 'unavailable' end,updated_at=now() where journal_id=p_journal_id and user_id=p_user_id;
end $$;
revoke all on function ai_analysis.save_journal_face_result(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function ai_analysis.save_journal_face_result(uuid,uuid,text,boolean) to service_role;
commit;
