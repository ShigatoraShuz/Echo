# ECHO professional support portal

## Implemented first release

- Multiple partner organizations with separately approved staff memberships. An ECHO verification approval does not grant professional access.
- Eligible adult users can submit a support request to one active organization. They explicitly choose up to three journal snapshots; Buddy, facial data, and AI analysis are never included.
- A practitioner with active reviewed credentials and MFA can see that organization's request queue, claim an unassigned request, and open only cases assigned to them. Coordinators and organization admins can see queue metadata but cannot open private case details.
- The assigned practitioner can offer an appointment, write encrypted case notes, add a support resource, and close a case. Request availability and appointment meeting details are encrypted too. Users accept, decline, or cancel appointments and can stop future access to the request message and selected journal snapshots. Professional records remain separate from the user's private journal.
- ECHO verification admins with recent MFA can create and approve organizations, approve staff, and suspend either. Suspending an organization also suspends all its staff; reactivation requires a fresh staff review. Access changes and case reads are audited.
- The screens reuse ECHO's forest, sage, and cream design tokens, responsive controls, accessible loading announcements, and skeleton states.

## Routes

| Audience | Page | Purpose |
| --- | --- | --- |
| ECHO user | `/professional/request` | Choose organization, describe need, select optional journal snapshots, consent |
| ECHO user | `/professional/my-requests` | Track requests |
| ECHO user | `/professional/my-requests/[id]` | Review sharing and appointments; revoke sharing |
| Practitioner | `/professional` | Organization-specific queue and schedule summary |
| Assigned practitioner | `/professional/cases/[id]` | Open a case and record follow-up |
| ECHO admin | `/admin/professionals` | Approve and suspend organizations and staff |

## Local setup and review

1. Apply `supabase/migrations/20261010090000_professional_support_portal.sql` to the intended Supabase project using the normal migration workflow. Do not apply it directly to a production project before review.
2. Expose `professional_service` in the project's PostgREST API schema configuration. `supabase/config.toml` contains the local setting. Tables remain inaccessible to `anon` and `authenticated`; only the backend service role can call the restricted schema and RPCs.
3. Start the configured backend and frontend. The backend needs its existing Supabase service credentials and journal encryption key.
4. An existing verification admin signs in with MFA, opens `/admin/professionals`, enters and reviews each organization, then approves it. The admin enters an existing active ECHO user's UUID and reviews their role and credential before approving staff access.
5. Test with separate accounts for a user, practitioner in organization A, practitioner in organization B, and ECHO admin. Confirm that only the assigned practitioner can open case content and that suspension and sharing revocation take effect.

## Launch gates still open

- Live end-to-end testing against the intended hosted Supabase project, including its API schema configuration, MFA enrollment, and encryption key, has not been performed by the isolated checks.
- The product needs an approved records retention and deletion policy for encrypted shared snapshots, professional notes, referrals, and audit records, plus an operational cleanup job. The 30-day sharing expiry already stops future practitioner reads but does not delete the stored copies.
- The product needs a verified organization and credential review process, support hours, escalation ownership, and clear terms for handling professional records before real users are invited.
- Notifications, cross-organization transfers, and AI-generated professional summaries are outside this first release. Any future transfer or AI use requires separate consent and access checks.
