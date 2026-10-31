# Professional credential verification — BE-005

Implemented locally against the current working tree; deployment requires project-owner approval. This is a professional credential workflow, separate from personal identity/age verification and clinical membership activation. It reuses the existing encryption service, `verification_service.verification_admins`, verified session assurance, professional audit events and backend-only database access. No new admin UI or authentication system is introduced.

## Evidence and review model

- An eligible, authenticated applicant with MFA submits their own clinical role, organization, non-sensitive credential display label, expiry date and an **evidence reference**. References are 20–4000 trimmed characters: for example, an issuer/registry record locator or a reference to evidence held through an approved secure channel. They are not binary uploads, access credentials, bearer tokens or a replacement for reviewing the original evidence.
- `ProfessionalCredentialService` encrypts references using Echo's existing AES-256-GCM envelope/key-version support before sending them to PostgreSQL. No additional provider, secret or storage bucket is required. The backend never fetches a supplied reference or generates a public evidence URL.
- The existing identity-document uploader is scoped to personal identity documents and its configured default scanner quarantines uploads. It is deliberately not repurposed to expose unscanned professional documents. Binary credential uploads/provider integration are outside this reference-based implementation and require a separately approved, functioning scanning/storage path.
- `credential_reviews` stores immutable subject, organization, clinical role, label, expiry, ciphertext and submission time. Stored review states are `pending`, `approved`, `rejected`. Review sets the verified actor and server timestamp; rejection requires a fixed reason code. There is no client-supplied reviewer or timestamp.
- Responses also expose effective `status: expired` for pending/approved records whose expiry date is before the current UTC date, while retaining `reviewStatus` and historical reviewer metadata. Rejected records remain rejected. SQL uses `current_date`, consistent with the existing professional migration; deployment must retain the expected UTC database timezone. Expiry equal to today is valid.
- An active application verification administrator, with MFA and authentication within 600 seconds, can read evidence and approve/reject. SQL independently checks active administrator authority. Organization `org_admin` membership confers no review authority. Even an application administrator cannot approve or reject their own credential or activate their own professional membership.
- Decisions lock the pending row; a second decision conflicts. Approved/rejected records and evidence cannot be edited through the service role or HTTP. Corrections/renewals require a new submission and independent review; a pending/rejected replacement does not invalidate a different, still-valid approved credential. This workflow does not introduce revocation of an already-approved review; existing membership suspension remains the access-removal mechanism.
- Approval rechecks organization status, applicant eligibility and expiry. Approval itself grants **no professional membership**. The existing admin membership endpoint separately activates membership using a matching approved review ID. Database enforcement matches subject, organization, role, label and expiry, and rejects inactive organizations/accounts, missing reviews and self-approval.

## HTTP contracts

All paths are relative to `/api/v1`, pass the existing application access guard, and return the standard success/error envelopes. Professional rate limits remain; submissions also have an 8-per-minute actor limit. Bodies are strict objects and path IDs are UUIDs.

| Method/path | Authorization and input | Result |
| --- | --- | --- |
| `GET /professional/credentials` | Authenticated actor + MFA. | `{ credentials }`: latest 100 own records, metadata only. |
| `POST /professional/credentials` | Authenticated actor + MFA. `{ organizationId, role, credentialLabel, expiresAt, evidenceReference }`; clinical role only, label 2–160 characters, ISO date. | 201 `{ credential }`, pending metadata; no evidence echoed. |
| `GET /professional/admin/organizations/:organizationId/credentials` | Active application admin + MFA + recent authentication. | `{ credentials }`: latest 100 for that organization, metadata only. |
| `GET /professional/admin/organizations/:organizationId/credentials/:credentialId` | Same admin gates; SQL checks admin and exact organization/record pairing, then records evidence access. | `{ credential }`, metadata plus decrypted `evidenceReference`; `Cache-Control: no-store`. |
| `POST /professional/admin/organizations/:organizationId/credentials/:credentialId/decision` | Same admin gates; `{ decision: "approved", reasonCode: null }` or `{ decision: "rejected", reasonCode: "invalid_evidence" \| "expired_credential" \| "unable_to_verify" }`. | `{ credential }`, reviewed metadata only. |
| Existing `POST /professional/admin/memberships` | Existing admin gates and input, plus required `credentialId` for clinical roles. Existing `credentialChecked: true` alone is insufficient. | Existing 201 `{ membershipId }`. Nonclinical roles do not require a clinical review. Self-provisioning is denied for every role. |

Credential metadata: `id, organizationId, userId, role, credentialLabel, expiresAt, status, reviewStatus, submittedAt, reviewedAt, reviewedBy, reasonCode`. Labels must describe the qualification rather than hold sensitive evidence. Evidence is absent from owner history, admin lists, submission/decision results, membership projections and case/queue queries. Only the designated review-detail endpoint decrypts it after authorization and auditing.

Expected failures: invalid/overposted input 400; unauthorized/self-review 403; unavailable or mismatched organization/record 404; expired/already-reviewed conflicts 409; database/audit/decryption failures 503 with fixed messages. No raw database message, detail, hint, evidence or ciphertext is logged by this workflow. The professional module's existing database diagnostic helper now logs only operation and SQL error code.

## Database controls and migration proposal

[20261012160000_professional_credential_reviews.sql](../../supabase/migrations/20261012160000_professional_credential_reviews.sql) is a **local, unapplied proposal**. No remote Supabase inspection, migration or permission operation was performed.

It adds the credential review table, membership `approved_credential_id`, audit `credential_review_id`, service-role-only submission/read/review RPCs and a membership approval trigger. The table enables RLS without browser-role allow policies; `PUBLIC`, `anon`, `authenticated` receive no table or function access. The backend service role can select records but cannot insert/update/delete reviews directly. Security-definer RPCs check service-role execution, verified backend actor arguments, eligibility, organization pairing and independent reviewer authority. They use the existing verification-admin registry, not a parallel role system.

`credential.submitted`, `credential.evidence_viewed`, `credential.approved`, and `credential.rejected` events carry organization, subject, actor, credential ID and time, never evidence or free-text reasons. Audit insertion and the underlying operation share a transaction. Audit failure prevents evidence return or commits no decision. Existing membership mutation auditing and BE-004 authorization/MFA checks remain in place.

### Rollout and rollback considerations

1. **Owner approval is required before any remote operation.** Review and back up affected schema/data and count active clinical memberships before scheduling deployment; these operations have not been performed here.
2. The migration deliberately changes existing active clinical memberships to `pending`, preserving their historical label, expiry and approval metadata. It cannot fabricate missing evidence. Such practitioners lose professional access until they submit evidence, receive independent approval, and have membership explicitly reapproved. Nonclinical membership states are preserved. Agree this interruption and reapproval process with the owner before deployment.
3. Deploy the migration transactionally with the backend change; coordinate or pause provisioning during rollout. The new backend fails closed if the credential table/functions are absent. Existing clinical membership API clients must supply the new approved review ID; no frontend changes are included.
4. Prefer a forward fix. For an application rollback, keep credential provisioning unavailable until a compatible backend is restored; do not remove approval checks or automatically reactivate legacy memberships. A schema rollback requires an owner-reviewed backup/restore plan covering review history, ciphertext, membership links, audit links, trigger and functions. Dropping these objects destroys verification history and does not safely restore pre-migration access. No destructive rollback script is supplied or executed.
5. Remote schema/grant parity, the database timezone, and deployment smoke tests remain owner-controlled release QA. Local tests do not prove production configuration.

## Implementation and evidence

- [Credential service](../../backend/src/features/professionals/professional-credentials.service.ts), [professional routes](../../backend/src/features/professionals/professional.routes.ts), [membership provisioning](../../backend/src/features/professionals/professional.service.ts).
- [Service/HTTP tests](../../backend/src/features/professionals/__tests__/professional-credentials.test.ts): encryption, metadata filtering, MFA/admin/recent-auth gates, forged fields, privacy-safe errors/logging, expiry, subject/organization/role matching, self-provisioning and the legacy-path denial.
- [SQL tests](../../backend/src/features/professionals/__tests__/professional-credentials.database.test.ts): both migrations executed only in isolated PGlite with synthetic identities; legacy re-review, review states, self-review, inactive admin/account/organization, browser privileges, immutable evidence, audit rollback, cross-organization mismatch, expiry and approved practitioner case workflows.
- Existing BE-004 authorization, route, session-verifier, authentication fail-closed and verification-admin security tests remain part of targeted validation.

FE-005 onboarding screens and later organization/session workflows are not implemented or marked complete by BE-005. Binary upload/scan integration, evidence retention/deletion policy and release operation approvals remain separate decisions; no insecure upload fallback was introduced.
