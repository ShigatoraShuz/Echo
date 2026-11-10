begin;

-- Every content edit retires prior results, including direct owner updates.
create function journal_service.invalidate_edited_journal() returns trigger
language plpgsql security definer set search_path='' as $$
declare period date;
begin
 if old.content_ciphertext is distinct from new.content_ciphertext
    or (old.analysis_consent and not new.analysis_consent) then
   update ai_analysis.analysis_requests set deleted_at=coalesce(deleted_at,now()),
     status=case when status in ('completed','failed') then status else 'failed' end,
     failure_code=case when status in ('completed','failed') then failure_code else 'JOURNAL_EDITED' end,
     completed_at=coalesce(completed_at,now()),lease_token_hash=null,lease_worker_id=null,lease_expires_at=null
     where journal_id=new.id and user_id=new.user_id and deleted_at is null;
   delete from public.analysis_status_projection where journal_id=new.id and user_id=new.user_id;
   delete from ai_analysis.journal_face_results where journal_id=new.id and user_id=new.user_id;
   for period in select distinct date_trunc('week',r.created_at)::date from ai_analysis.analysis_results r
     join ai_analysis.analysis_requests a on a.id=r.analysis_request_id where a.journal_id=new.id and a.user_id=new.user_id
   loop perform insights_service.recompute_analysis_week(new.user_id,period); end loop;
 end if;
 return new;
end $$;
revoke all on function journal_service.invalidate_edited_journal() from public,anon,authenticated;
create trigger invalidate_edited_journal after update of content_ciphertext,analysis_consent on journal_service.journals
 for each row execute function journal_service.invalidate_edited_journal();

create function journal_service.edit_journal(p_user_id uuid,p_journal_id uuid,p_expected_updated_at timestamptz,
 p_entry jsonb,p_analysis_requested boolean,p_processing_mode text,p_initial_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare journal journal_service.journals%rowtype; job uuid; initial text;
begin
 -- Acquire job locks before the journal lock, matching worker completion order.
 perform 1 from ai_analysis.analysis_requests where journal_id=p_journal_id and user_id=p_user_id order by id for update;
 select * into journal from journal_service.journals where id=p_journal_id and user_id=p_user_id and deleted_at is null for update;
 if not found then raise exception 'JOURNAL_NOT_FOUND'; end if;
 if p_expected_updated_at is null or journal.updated_at is distinct from p_expected_updated_at then raise exception 'JOURNAL_EDIT_CONFLICT'; end if;
 if p_processing_mode not in ('disabled','development_stub','local_worker') then raise exception 'INVALID_PROCESSING_MODE'; end if;
 if p_analysis_requested and not ai_analysis.current_gates_allow(p_user_id) then raise exception 'ANALYSIS_GATE_FAILED'; end if;
 initial:=case when p_processing_mode='development_stub' then 'queued'
   when p_processing_mode='local_worker' and p_initial_status='queued' then 'queued' else 'waiting_for_provider' end;
 update journal_service.journals set title='[encrypted]',content_ciphertext=p_entry->>'content_ciphertext',
   encryption_iv=p_entry->>'encryption_iv',encryption_auth_tag=p_entry->>'encryption_auth_tag',
   encryption_key_version=(p_entry->>'encryption_key_version')::integer,word_count=(p_entry->>'word_count')::integer,
   emotions=p_entry->'emotions',tags=p_entry->'tags',privacy_status=p_entry->>'privacy_status',analysis_consent=p_analysis_requested
   where id=p_journal_id and user_id=p_user_id returning * into journal;
 if p_analysis_requested then
   job:=gen_random_uuid();
   insert into ai_analysis.analysis_requests(id,request_id,user_id,source_feature,source_record_id,journal_id,
     analysis_type,status,progress,fixture,processing_mode,retention_expires_at)
   values(job,gen_random_uuid(),p_user_id,'journal',p_journal_id,p_journal_id,'journal_reflection',initial,
     case when initial='queued' then 5 else 0 end,'standard_low_distress',p_processing_mode,now()+interval '30 days');
   insert into public.analysis_status_projection(user_id,journal_id,job_id,status,progress)
     values(p_user_id,p_journal_id,job,initial,case when initial='queued' then 5 else 0 end);
 end if;
 insert into user_service.audit_events(user_id,actor_user_id,event_type,resource_type,resource_id,metadata)
 values(p_user_id,p_user_id,'journal.edited','journal',p_journal_id,jsonb_build_object('analysis_requested',p_analysis_requested));
 return jsonb_build_object('entry',to_jsonb(journal),'jobId',job,'status',case when p_analysis_requested then initial else 'saved' end);
end $$;
revoke all on function journal_service.edit_journal(uuid,uuid,timestamptz,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function journal_service.edit_journal(uuid,uuid,timestamptz,jsonb,boolean,text,text) to service_role;

-- An in-flight face capture from an old revision cannot attach to edited text.
create function ai_analysis.save_journal_face_result_for_revision(p_user_id uuid,p_journal_id uuid,p_expected_updated_at timestamptz,p_ciphertext text,p_available boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from ai_analysis.analysis_requests where journal_id=p_journal_id and user_id=p_user_id order by id for update;
 perform 1 from journal_service.journals where id=p_journal_id and user_id=p_user_id and deleted_at is null and updated_at=p_expected_updated_at for share;
 if not found then raise exception 'JOURNAL_EDIT_CONFLICT'; end if;
 perform ai_analysis.save_journal_face_result(p_user_id,p_journal_id,p_ciphertext,p_available);
end $$;
revoke all on function ai_analysis.save_journal_face_result_for_revision(uuid,uuid,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function ai_analysis.save_journal_face_result_for_revision(uuid,uuid,timestamptz,text,boolean) to service_role;
commit;
