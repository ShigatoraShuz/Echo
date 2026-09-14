-- Reuse settings contacts; do not grant contact-delivery permission from this completeness check.
create function user_service.has_valid_trusted_contact(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from user_service.trusted_contacts c where c.user_id=p_user_id
    and length(trim(c.contact_name)) between 1 and 200 and length(trim(c.relationship)) between 1 and 100
    and c.permission_acknowledged_at is not null
    and ((c.contact_email is not null and c.contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      or (c.contact_phone is not null and length(trim(c.contact_phone)) between 5 and 40)));
$$;
revoke all on function user_service.has_valid_trusted_contact(uuid) from public,anon,authenticated;
grant execute on function user_service.has_valid_trusted_contact(uuid) to service_role;

create or replace function ai_analysis.current_gates_allow(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select user_service.has_valid_trusted_contact(p_user_id)
 and exists(select 1 from user_service.profiles p join user_service.privacy_preferences pp using(user_id)
   where p.user_id=p_user_id and p.account_status='active' and p.onboarding_completed and p.eligible_18_plus
     and pp.journal_ai_analysis_enabled)
 and exists(select 1 from verification_service.identity_verifications v where v.id=(
   select id from verification_service.identity_verifications where user_id=p_user_id order by created_at desc limit 1)
   and v.verification_status='approved' and (v.approved_expires_at is null or v.approved_expires_at>now()))
 and (select count(*)=3 from auth_provisioning.policy_documents where is_active)
 and not exists(select 1 from auth_provisioning.policy_documents d where d.is_active and not exists(
   select 1 from user_service.user_consents c where c.user_id=p_user_id and c.consent_type=d.document_type
   and c.consent_version=d.version and c.accepted and c.revoked_at is null));
$$;
