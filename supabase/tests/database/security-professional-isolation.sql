begin;

do $$
declare
  owner_id uuid := 'fe000000-0000-4000-8000-000000000001';
  counselor_id uuid := 'fe000000-0000-4000-8000-000000000002';
  other_id uuid := 'fe000000-0000-4000-8000-000000000003';
  organization_id uuid := 'fe000000-0000-4000-8000-000000000004';
  request_id uuid;
  appointment_id uuid;
  credential_id uuid;
begin
  if has_schema_privilege('authenticated','professional_service','USAGE')
     or has_table_privilege('authenticated','professional_service.support_requests','SELECT')
     or has_function_privilege('authenticated','professional_service.claim_request(uuid,uuid)','EXECUTE')
  then raise exception 'Professional data is exposed to the browser role'; end if;

  insert into auth.users(id,email) values
    (owner_id,'professional-owner@example.test'),
    (counselor_id,'professional-counselor@example.test'),
    (other_id,'professional-other@example.test');
  insert into user_service.profiles(user_id,account_status,eligible_18_plus,onboarding_completed)
    values(owner_id,'active',true,true),(counselor_id,'active',true,true)
    on conflict(user_id) do update set account_status='active',eligible_18_plus=true,onboarding_completed=true;
  insert into professional_service.organizations(id,slug,name,status,verified_at)
    values(organization_id,'test-partner','Test Partner','active',now());
  insert into verification_service.verification_admins(user_id,is_active) values(owner_id,true);
  perform set_config('request.jwt.claim.role','service_role',true);
  select id into credential_id from professional_service.submit_credential(
    organization_id,counselor_id,'counselor','Reviewed credential',current_date+30,'echo:encrypted:v1:example');
  perform professional_service.review_credential(organization_id,credential_id,owner_id,'approved',null);
  insert into professional_service.memberships(organization_id,user_id,role,status,display_name,
    credential_label,credential_expires_at,approved_at,approved_by,approved_credential_id)
    values(organization_id,counselor_id,'counselor','active','Test Counselor','Reviewed credential',current_date+30,now(),owner_id,credential_id);
  perform set_config('request.jwt.claim.role','service_role',true);

  begin
    perform professional_service.create_request(organization_id,other_id,'echo:encrypted:v1:example','echo:encrypted:v1:example',
      'professional-request-v1','[]'::jsonb);
    raise exception 'Ineligible user submitted a request';
  exception when others then
    if sqlerrm <> 'USER_NOT_ELIGIBLE' then raise; end if;
  end;

  select id into request_id from professional_service.create_request(organization_id,owner_id,
    'echo:encrypted:v1:example','echo:encrypted:v1:example','professional-request-v1','[]'::jsonb);
  begin
    perform professional_service.claim_request(request_id,other_id);
    raise exception 'Non-member claimed a request';
  exception when others then
    if sqlerrm <> 'MEMBERSHIP_REQUIRED' then raise; end if;
  end;
  perform professional_service.claim_request(request_id,counselor_id);
  if (select assigned_to from professional_service.support_requests where id=request_id) <> counselor_id
    then raise exception 'Case assignment was not saved'; end if;
  begin
    insert into professional_service.case_notes(request_id,author_user_id,body_encrypted)
      values(request_id,other_id,'echo:encrypted:v1:example');
    raise exception 'Non-assigned staff wrote a note';
  exception when others then
    if sqlerrm <> 'ASSIGNMENT_REQUIRED' then raise; end if;
  end;
  select id into appointment_id from professional_service.propose_appointment(request_id,counselor_id,
    now()+interval '1 day',now()+interval '1 day 1 hour','in_person','echo:encrypted:v1:example');
  perform professional_service.respond_appointment(appointment_id,owner_id,true);
  if (select status from professional_service.support_requests where id=request_id) <> 'scheduled'
    then raise exception 'Appointment confirmation did not schedule the case'; end if;
  begin
    perform professional_service.set_request_status(request_id,counselor_id,'closed');
    raise exception 'Case closed with an active appointment';
  exception when others then
    if sqlerrm <> 'APPOINTMENT_ACTIVE' then raise; end if;
  end;
  begin
    perform professional_service.cancel_appointment(appointment_id,other_id);
    raise exception 'Unrelated user canceled the appointment';
  exception when others then
    if sqlerrm <> 'REQUEST_NOT_FOUND' then raise; end if;
  end;
  perform professional_service.cancel_appointment(appointment_id,owner_id);
  if (select status from professional_service.support_requests where id=request_id) <> 'assigned'
    then raise exception 'Canceled appointment did not reopen scheduling'; end if;
  perform professional_service.revoke_sharing(request_id,owner_id);
  if (select sharing_revoked_at from professional_service.support_requests where id=request_id) is null
    then raise exception 'Sharing revocation was not saved'; end if;
  perform professional_service.suspend_member(
    (select id from professional_service.memberships where user_id=counselor_id),other_id);
  begin
    insert into professional_service.case_notes(request_id,author_user_id,body_encrypted)
      values(request_id,counselor_id,'echo:encrypted:v1:example');
    raise exception 'Suspended practitioner wrote a note';
  exception when others then
    if sqlerrm <> 'ASSIGNMENT_REQUIRED' then raise; end if;
  end;
  update professional_service.memberships set status='active' where user_id=counselor_id;
  perform professional_service.suspend_organization(organization_id,owner_id);
  if (select status from professional_service.memberships where user_id=counselor_id) <> 'suspended'
    then raise exception 'Organization suspension did not suspend staff'; end if;
end $$;

rollback;
