# Account verification

ECHO requires an administrator-approved identity and age verification before a
user can open Buddy or request AI-supported journal analysis.

## User flow

1. The user provides their legal name, date of birth, contact details, address,
   and government ID reference.
2. Users under 18 must also provide a parent or legal guardian's contact,
   address, ID reference, consent, and supporting documents.
3. The user uploads the documents requested for their age path.
4. The application is submitted and locked while an administrator reviews it.
5. The administrator approves, requests changes, or rejects the application.
6. Only an active, unexpired approval unlocks Buddy and AI-supported analysis.

Public crisis and support resources, grounding, and ordinary private journaling
remain available without verification.

## Grant an administrator

The account must already exist in Supabase Auth. There is no browser-facing or
repository CLI that can self-grant reviewer privileges. Using an authorized
local/admin database connection, insert the user's UUID into the canonical
table:

```sql
insert into public.verification_admins (user_id, is_active)
values ('00000000-0000-4000-8000-000000000000', true)
on conflict (user_id) do update set is_active = excluded.is_active;
```

To revoke future review access:

```sql
update public.verification_admins
set is_active = false
where user_id = '00000000-0000-4000-8000-000000000000';
```

Authorization is checked against `verification_admins` on every review request.
It is not inferred from client-side state or editable user metadata.

## Data handling

- Structured identity, guardian, and review-note data is encrypted by User
  Service before storage.
- Evidence is stored in the private `verification-documents` bucket.
- Reviewers receive five-minute signed links after User Service authorization.
- Browser roles have no table privileges or RLS policies on the verification
  tables.
- Documents are limited to JPG, PNG, or PDF files no larger than 8 MB.
- Approval expires after two years and requires reverification.

The current minimum account age is a product safeguard of 13. It must not be
presented as a statement of the legal age of digital consent in every
jurisdiction. Have legal and privacy counsel review the retention schedule,
accepted evidence, guardian workflow, and operational review procedure before
production use.
