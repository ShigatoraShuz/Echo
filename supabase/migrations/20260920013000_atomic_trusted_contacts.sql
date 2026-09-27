begin;
-- Invoker privileges preserve column grants and RLS. Ownership comes only from the JWT.
create function user_service.save_trusted_contact(
 p_contact_id uuid, p_contact_name text, p_contact_email text, p_contact_phone text,
 p_relationship text, p_is_primary boolean, p_permission_acknowledged boolean
) returns uuid language plpgsql security invoker set search_path='' as $$
declare owner_id uuid := auth.uid(); saved_id uuid;
begin
 if owner_id is null then raise insufficient_privilege using message='AUTHENTICATION_REQUIRED'; end if;
 if p_contact_name is null or char_length(btrim(p_contact_name)) not between 1 and 200
    or p_relationship is null or char_length(btrim(p_relationship)) not between 1 and 100
    or (p_contact_email is null and p_contact_phone is null)
    or (p_contact_email is not null and char_length(p_contact_email) not between 3 and 320)
    or (p_contact_phone is not null and char_length(p_contact_phone) not between 5 and 40)
    or p_is_primary is null or p_permission_acknowledged is distinct from true then
   raise check_violation using message='INVALID_CONTACT';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 481));
 if p_contact_id is not null then
   select id into saved_id from user_service.trusted_contacts
    where id=p_contact_id and user_id=owner_id for update;
   if saved_id is null then raise no_data_found using message='CONTACT_NOT_FOUND'; end if;
 end if;
 if p_is_primary then
   update user_service.trusted_contacts set is_primary=false where user_id=owner_id and is_primary;
 end if;
 if p_contact_id is null then
   insert into user_service.trusted_contacts(user_id,contact_name,contact_email,contact_phone,relationship,is_primary,permission_acknowledged_at)
   values(owner_id,btrim(p_contact_name),p_contact_email,p_contact_phone,btrim(p_relationship),p_is_primary,now()) returning id into saved_id;
 else
   update user_service.trusted_contacts set contact_name=btrim(p_contact_name),contact_email=p_contact_email,
    contact_phone=p_contact_phone,relationship=btrim(p_relationship),is_primary=p_is_primary,permission_acknowledged_at=now()
    where id=saved_id and user_id=owner_id;
 end if;
 return saved_id;
end $$;
revoke all on function user_service.save_trusted_contact(uuid,text,text,text,text,boolean,boolean) from public,anon,service_role;
grant execute on function user_service.save_trusted_contact(uuid,text,text,text,text,boolean,boolean) to authenticated;
commit;
