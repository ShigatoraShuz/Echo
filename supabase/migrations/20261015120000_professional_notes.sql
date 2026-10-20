-- BE-017 local proposal: existing notes remain final. No note bodies are rewritten.
alter table professional_service.case_notes
  add column state text not null default 'final' check(state in ('draft','final')),
  add column revision integer not null default 1 check(revision>0),
  add column updated_at timestamptz not null default now(),
  add column finalized_at timestamptz,
  add column submission_id uuid;
update professional_service.case_notes set finalized_at=created_at,updated_at=created_at;
create unique index professional_note_submission_idx on professional_service.case_notes(request_id,author_user_id,submission_id) where submission_id is not null;

create or replace function professional_service.case_note_snapshot(p_request_id uuid,p_actor uuid)
returns jsonb language sql stable set search_path = professional_service, pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'body_encrypted',n.body_encrypted,'created_at',n.created_at,
    'state',n.state,'revision',n.revision,'updated_at',n.updated_at,'finalized_at',n.finalized_at)
    order by n.created_at desc,n.id),'[]'::jsonb) from professional_service.case_notes n
    where n.request_id=p_request_id and (n.state='final' or n.author_user_id=p_actor)
$$;

create function professional_service.guard_note_edit() returns trigger language plpgsql
set search_path = professional_service, pg_catalog as $$
begin
  if old.state='final' or new.id<>old.id or new.request_id<>old.request_id or new.author_user_id<>old.author_user_id
    or new.submission_id is distinct from old.submission_id or new.created_at<>old.created_at
    or new.revision<>old.revision+1 then raise exception 'NOTE_IMMUTABLE'; end if;
  return new;
end $$;
create trigger professional_note_edit_guard before update on professional_service.case_notes
  for each row execute function professional_service.guard_note_edit();
revoke all on function professional_service.guard_note_edit() from public,anon,authenticated,service_role;

create or replace function professional_service.audit_case_insert() returns trigger language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare organization uuid; operation text;
begin
  select organization_id into organization from professional_service.support_requests where id=new.request_id;
  if tg_table_name='case_notes' then
    operation := case when new.state='draft' then 'note.draft_created' else 'note.created' end;
  else operation := 'referral.created'; end if;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(organization,new.request_id,new.author_user_id,operation);
  return new;
end $$;

create function professional_service.save_case_note(p_request_id uuid,p_actor uuid,p_body_encrypted text,p_submission_id uuid,p_state text)
returns professional_service.case_notes language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; n professional_service.case_notes;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_submission_id is null or p_state is null or p_state not in ('draft','final')
    or p_body_encrypted is null or p_body_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_NOTE'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found or r.assigned_to is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  select * into n from professional_service.case_notes where request_id=r.id and author_user_id=p_actor and submission_id=p_submission_id;
  -- Replay returns only this actor's existing encrypted record; the service
  -- compares its plaintext/state and rejects reuse with different content.
  if found then return n; end if;
  if r.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
  insert into professional_service.case_notes(request_id,author_user_id,body_encrypted,submission_id,state,finalized_at)
    values(r.id,p_actor,p_body_encrypted,p_submission_id,p_state,case when p_state='final' then clock_timestamp() end) returning * into n;
  return n;
end $$;

create function professional_service.edit_case_note(p_request_id uuid,p_note_id uuid,p_actor uuid,p_body_encrypted text,p_expected_revision integer,p_finalize boolean)
returns professional_service.case_notes language plpgsql security definer
set search_path = professional_service, pg_catalog as $$
declare r professional_service.support_requests; n professional_service.case_notes;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  select * into r from professional_service.support_requests where id=p_request_id for update;
  if not found or r.assigned_to is distinct from p_actor then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not professional_service.current_clinician(r.organization_id,p_actor) then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  select * into n from professional_service.case_notes where id=p_note_id and request_id=r.id and author_user_id=p_actor for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- Finalization retries have no write or extra audit. Service checks content.
  if n.state='final' and p_finalize=true and n.revision=p_expected_revision+1 then return n; end if;
  if n.state<>'draft' then raise exception 'NOTE_IMMUTABLE'; end if;
  if p_expected_revision is null or n.revision<>p_expected_revision then raise exception 'NOTE_REVISION_CONFLICT'; end if;
  if r.status not in ('assigned','scheduled') then raise exception 'INVALID_CASE_TRANSITION'; end if;
  if p_finalize is null or p_body_encrypted is null or p_body_encrypted not like 'echo:encrypted:v1:%' then raise exception 'INVALID_NOTE'; end if;
  update professional_service.case_notes set body_encrypted=p_body_encrypted,state=case when p_finalize then 'final' else 'draft' end,
    revision=revision+1,updated_at=clock_timestamp(),finalized_at=case when p_finalize then clock_timestamp() end where id=n.id returning * into n;
  insert into professional_service.audit_events(organization_id,request_id,actor_user_id,action)
    values(r.organization_id,r.id,p_actor,case when p_finalize then 'note.finalized' else 'note.draft_updated' end);
  return n;
end $$;
revoke all on function professional_service.save_case_note(uuid,uuid,text,uuid,text),professional_service.edit_case_note(uuid,uuid,uuid,text,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function professional_service.save_case_note(uuid,uuid,text,uuid,text),professional_service.edit_case_note(uuid,uuid,uuid,text,integer,boolean) to service_role;
