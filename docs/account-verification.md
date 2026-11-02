# Account verification

ECHO requires an administrator-approved identity and age verification before a
user can open Buddy or request AI-supported journal analysis.

## User flow

1. The user provides their legal name, date of birth, contact details, address,
   and government ID reference.
2. Users under 18 must also provide a parent or legal guardian's contact,
   address, ID reference, consent, and supporting documents.
3. The user uploads the documents requested for their age path.
4. Once all required files are uploaded, the user submits the application. It enters the administrator queue and is locked while under review.
5. The administrator runs security scanning before opening documents, then approves, requests changes, or rejects the application. If scanning cannot clear a file, the administrator can request a replacement.
6. Only an active, unexpired approval unlocks Buddy and AI-supported analysis.

Public crisis and support resources, grounding, and ordinary private journaling
remain available without verification.

## Grant an administrator

The account must already exist in Supabase Auth. From `backend/`, run:

```powershell
npm.cmd run admin:verification -- admin@example.com
```

To revoke future review access:

```powershell
npm.cmd run admin:verification -- admin@example.com --revoke
```

Authorization is checked against `verification_admins` on every review request.
It is not inferred from client-side state or editable user metadata.

## Data handling

- Structured identity, guardian, and review-note data is encrypted by the
  backend before storage.
- Evidence is stored in the private `verification-documents` bucket.
- Reviewers receive five-minute signed links after backend authorization.
- Browser roles have no table privileges or RLS policies on the verification
  tables.
- Documents are limited to JPG, PNG, or PDF files no larger than 8 MB.
- Approval expires after two years and requires reverification.

The current minimum account age is a product safeguard of 13. It must not be
presented as a statement of the legal age of digital consent in every
jurisdiction. Have legal and privacy counsel review the retention schedule,
accepted evidence, guardian workflow, and operational review procedure before
production use.
