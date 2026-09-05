# Verification administrator setup

The review workspace is `/admin/verifications`; `/admin` redirects there. Authentication still uses an ordinary, verified Supabase account. Authorization is enforced by User Service against the canonical `public.verification_admins` table on every list, detail, claim, and decision operation. Hiding or showing the frontend link never grants access.

## Provisioning

This repository deliberately does not expose an administrator-provisioning HTTP endpoint or accept passwords in an operator script. Provision or revoke a reviewer only through an authenticated database-administration session for the intended Supabase project, using an explicitly approved user UUID.

Example SQL to review before running in the Supabase SQL editor or an equivalent trusted session:

```sql
insert into public.verification_admins (user_id, is_active)
values ('approved-auth-user-uuid', true)
on conflict (user_id) do update set is_active = excluded.is_active;

-- Revoke without deleting the account or its audit history:
update public.verification_admins
set is_active = false
where user_id = 'approved-auth-user-uuid';
```

Never place the Supabase service-role key, a custom database-role key, or reviewer provisioning capability in the frontend. Confirm the target project and account owner before mutation.

## Review safeguards

- User Service rejects ordinary users before private application data is returned.
- Reviewers cannot approve their own application.
- Evidence files live in private Storage and are exposed only by short-lived signed URLs.
- Claim and decision transitions are server-validated and audited.
- Approval covers identity verification only; it does not grant policy acceptance, onboarding completion, optional journal-analysis consent, or model availability.

Use `/admin-login` for an existing reviewer account. The page signs in normally and then verifies reviewer permission through the API Gateway before navigation.
