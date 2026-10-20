-- Fictional, rolled-back regression checks. Isolated release container ONLY.
begin;
insert into auth.users(id) select ('fd000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n;
insert into user_service.profiles(user_id,account_status,eligible_18_plus,onboarding_completed)
  select id,'active',true,true from auth.users where id::text like 'fd000000-%';
insert into verification_service.verification_admins(user_id,is_active)
  values('fd000000-0000-4000-8000-000000000003',true);
insert into professional_service.organizations(id,slug,name,status,verified_at)
  values('fd000000-0000-4000-8000-000000000010','fictional-withdrawal','Fictional withdrawal checks','active',now()),
  ('fd000000-0000-4000-8000-000000000011','fictional-other-withdrawal','Fictional other organization','active',now());
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare credential professional_service.credential_reviews;
begin
  select * into credential from professional_service.submit_credential(
    'fd000000-0000-4000-8000-000000000010','fd000000-0000-4000-8000-000000000002',
    'counselor','Fictional regression evidence',current_date+1,'echo:encrypted:v1:fictional');
  perform professional_service.review_credential(credential.organization_id,credential.id,
    'fd000000-0000-4000-8000-000000000003','approved',null);
  insert into professional_service.memberships(organization_id,user_id,role,status,display_name,
    credential_label,credential_expires_at,approved_at,approved_by,approved_credential_id)
    values(credential.organization_id,credential.user_id,'counselor','active','Fictional practitioner',
      credential.credential_label,credential.expires_at,now(),'fd000000-0000-4000-8000-000000000003',credential.id);
end $$;

do $$ declare r professional_service.support_requests; a professional_service.appointments;
  owner_id uuid := 'fd000000-0000-4000-8000-000000000001';
  clinician uuid := 'fd000000-0000-4000-8000-000000000002';
  stranger uuid := 'fd000000-0000-4000-8000-000000000004';
  organization uuid := 'fd000000-0000-4000-8000-000000000010';
  original_assignment uuid; i integer;
begin
  for i in 1..3 loop
    select * into r from professional_service.create_request_v2(gen_random_uuid(),organization,owner_id,null,
      'echo:encrypted:v1:fictional','echo:encrypted:v1:fictional','professional-request-v2','[]'::jsonb);
    insert into professional_service.case_shared_records(request_id,owner_user_id,resource_type,source_record_id,
      label_encrypted,payload_encrypted,consent_version)
      values(r.id,owner_id,'journal',gen_random_uuid(),'echo:encrypted:v1:fictional','echo:encrypted:v1:fictional','professional-request-v2');
    begin
      perform professional_service.withdraw_request(r.id,stranger);
      raise exception 'UNAUTHORIZED_WITHDRAWAL_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'CASE_NOT_ACTIVE' then raise; end if; end;
    begin
      perform professional_service.withdraw_request(r.id,clinician);
      raise exception 'CLINICIAN_OWNER_IMPERSONATION_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'CASE_NOT_ACTIVE' then raise; end if; end;
    begin
      update professional_service.support_requests set status='withdrawn' where id=r.id;
      raise exception 'WITHDRAWAL_WITHOUT_REVOCATION_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'INVALID_CASE_TRANSITION' then raise; end if; end;
    begin
      update professional_service.support_requests set status='scheduled' where id=r.id;
      raise exception 'UNASSIGNED_SCHEDULE_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'INVALID_CASE_TRANSITION' then raise; end if; end;
    if i>1 then
      select * into r from professional_service.claim_request(r.id,clinician);
      select * into a from professional_service.propose_appointment(r.id,clinician,
        now()+make_interval(days=>i),now()+make_interval(days=>i,hours=>1),'online','echo:encrypted:v1:fictional');
      if i=3 then perform professional_service.respond_appointment(a.id,owner_id,true); end if;
    end if;
    original_assignment := r.assigned_to;
    if i>1 then
      begin
        update professional_service.support_requests set assigned_to=stranger,status='withdrawn',sharing_revoked_at=now() where id=r.id;
        raise exception 'ASSIGNMENT_CHANGE_DURING_WITHDRAWAL_ACCEPTED';
      exception when raise_exception then if sqlerrm <> 'INVALID_CASE_TRANSITION' then raise; end if; end;
    end if;
    begin
      update professional_service.support_requests set organization_id='fd000000-0000-4000-8000-000000000011',
        status='withdrawn',sharing_revoked_at=now() where id=r.id;
      raise exception 'CROSS_ORGANIZATION_TRANSITION_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'INVALID_CASE_TRANSITION' then raise; end if; end;
    select * into r from professional_service.withdraw_request(r.id,owner_id);
    if r.status<>'withdrawn' or r.sharing_revoked_at is null or r.assigned_to is distinct from original_assignment
      then raise exception 'WITHDRAWAL_RESULT_INVALID'; end if;
    if exists(select 1 from professional_service.appointments where request_id=r.id and status in ('proposed','confirmed'))
      then raise exception 'APPOINTMENT_NOT_CANCELED'; end if;
    if exists(select 1 from professional_service.case_shared_records where request_id=r.id and (revoked_at is null or revoked_by<>owner_id))
      then raise exception 'SHARING_NOT_REVOKED'; end if;
    if (select count(*) from professional_service.audit_events where request_id=r.id and action='request.withdrawn' and actor_user_id=owner_id)<>1
      or (select count(*) from professional_service.case_events where request_id=r.id and event_type='request_withdrawn')<>1
      then raise exception 'WITHDRAWAL_AUDIT_INVALID'; end if;
    begin
      update professional_service.support_requests set status='assigned',assigned_to=clinician where id=r.id;
      raise exception 'TERMINAL_REOPEN_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'INVALID_CASE_TRANSITION' then raise; end if; end;
    begin
      perform professional_service.withdraw_request(r.id,owner_id);
      raise exception 'TERMINAL_WITHDRAWAL_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'CASE_NOT_ACTIVE' then raise; end if; end;
    begin
      perform professional_service.set_request_status(r.id,clinician,'withdrawn');
      raise exception 'PROFESSIONAL_WITHDRAWAL_STATUS_ACCEPTED';
    exception when raise_exception then if sqlerrm <> 'INVALID_STATUS' then raise; end if; end;
  end loop;
  -- The backend's separate submitted-only owner RPC retains its closed state,
  -- retry behavior and restrictions; fixing the User Side must not replace it.
  select * into r from professional_service.create_request_v2(gen_random_uuid(),organization,owner_id,null,
    'echo:encrypted:v1:fictional','echo:encrypted:v1:fictional','professional-request-v2','[]'::jsonb);
  select * into r from professional_service.withdraw_own_request(r.id,owner_id);
  perform professional_service.withdraw_own_request(r.id,owner_id);
  if r.status<>'closed' or r.assigned_to is not null or r.sharing_revoked_at is null
    or (select count(*) from professional_service.audit_events where request_id=r.id and action='request.withdrawn')<>1
    then raise exception 'BACKEND_OWNER_WITHDRAWAL_REGRESSION'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  begin
    perform professional_service.withdraw_request(gen_random_uuid(),'fd000000-0000-4000-8000-000000000001');
    raise exception 'BROWSER_RPC_ACCEPTED';
  exception when insufficient_privilege then null; end;
  begin
    update professional_service.support_requests set status='withdrawn';
    raise exception 'BROWSER_WRITE_ACCEPTED';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
