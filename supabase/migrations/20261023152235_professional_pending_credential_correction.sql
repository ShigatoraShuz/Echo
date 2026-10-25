-- PROPOSAL ONLY. Not installed and not a versioned migration.
-- Create the real migration with the pinned CLI only after explicit schema approval.
create function professional_service.correct_pending_credential(
 p_credential_id uuid,p_actor uuid,p_label text,p_expires_at date
) returns professional_service.credential_reviews language plpgsql security definer
set search_path=professional_service,pg_catalog as $$
declare result professional_service.credential_reviews;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 select * into result from professional_service.credential_reviews where id=p_credential_id and user_id=p_actor for update;
 if not found then raise exception 'CREDENTIAL_UNAVAILABLE'; end if;
 if result.status<>'pending' or result.reviewed_by is not null or result.reviewed_at is not null
   then raise exception 'CREDENTIAL_ALREADY_REVIEWED'; end if;
 perform 1 from professional_service.organizations where id=result.organization_id and status='active' for share;
 if not found then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
 perform 1 from user_service.profiles where user_id=p_actor and account_status='active' and eligible_18_plus and onboarding_completed for share;
 if not found then raise exception 'CREDENTIAL_FORBIDDEN'; end if;
 if exists(select 1 from professional_service.memberships where approved_credential_id=result.id) then raise exception 'CREDENTIAL_ALREADY_REVIEWED'; end if;
 if p_label is null or char_length(btrim(p_label)) not between 2 and 160 or p_expires_at is null then raise exception 'CREDENTIAL_INVALID'; end if;
 if p_expires_at<current_date then raise exception 'CREDENTIAL_EXPIRED'; end if;
 update professional_service.credential_reviews set credential_label=btrim(p_label),expires_at=p_expires_at where id=result.id returning * into result;
 insert into professional_service.audit_events(organization_id,actor_user_id,subject_user_id,credential_review_id,action)
 values(result.organization_id,p_actor,p_actor,result.id,'credential.corrected');
 return result;
end $$;
revoke all on function professional_service.correct_pending_credential(uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function professional_service.correct_pending_credential(uuid,uuid,text,date) to service_role;
