# Professional Support QA — 2026-10-13

## Result

The linked Supabase project now has the Professional Support workspace and Calendar migrations (`20261011100000` and `20261012090000`). The missing workspace tables caused `GET /api/v1/professional/hub` to return 503. A service-role read confirms the practitioner, message, appointment, organization, and calendar tables/columns are available. An authenticated user confirmed that the hub and Calendar pages load after migration.

The linked project has **zero organizations, memberships, and practitioner profiles**. Real practitioner discovery, two-party messaging, and appointment completion cannot be accepted as live end-to-end tested until an administrator provisions reviewed test accounts. Do not populate the public directory with invented practitioners.

## Verified in this checkout

| Flow | Evidence | Result |
| --- | --- | --- |
| Hub availability | Both migrations applied; service-role schema reads; authenticated user refresh | Loads without the former 503 |
| Unauthenticated access | Local hub and appointment requests without credentials | Both return 401 |
| Practitioner access | Backend owner/assignee and MFA route tests | Pass |
| Directory | Frontend search/credential controls test and server query inspection | Pass with mocked practitioners; no live practitioners exist |
| User messages | Assigned-case send, closed-case read-only, and shared-record failure tests | Pass with mocks |
| Appointments | Accept/change action tests and owner-scoped range test | Pass with mocks; no live appointment exists |
| Calendar connection | Proposed appointment appears on its local date; link to appointment controls; independent failure state | Pass with mocks |
| Support history | Closed-case detail, consultation, referral, and timeline test | Pass with mocks |
| Type and lint | Focused frontend/backend typechecks and changed-file ESLint | Pass |

The Calendar appointment query uses an owner-checked relationship and a bounded date range, so appointments from cases older than the recent-request list remain eligible. The previous 50-request dependency was removed from this query.

## Two-account acceptance run still needed

1. An ECHO verification admin with recent MFA creates and approves a real test organization in `/admin/professionals`, then approves an existing eligible test practitioner after reviewing credentials. Confirm that a different ordinary account cannot perform these actions.
2. A separate eligible user finds that practitioner, submits a support request with explicit consent, and sees the request in My Requests. Confirm another user cannot open it.
3. The assigned practitioner signs in with MFA, opens only their assigned case, replies, proposes an appointment, and records a referral. Confirm another practitioner cannot open the case.
4. The user receives the message once, replies, accepts the appointment, and sees it on the correct local Calendar day. Decline/cancel/change paths should update the appointment state and Calendar accordingly.
5. Close the case and confirm the user sees the consultations, referral, and timeline in Support History while messaging is read-only. Revoke sharing and confirm the practitioner can no longer read shared content.
6. Repeat the user pages at mobile and desktop widths and inspect Network/Console for 4xx/5xx responses, duplicate messages, and layout overflow.

The local Supabase test stack was unavailable because Docker was not running, so database SQL tests were not rerun in this QA pass. The full two-account run above remains the release gate. `GET /professional/my-requests` currently returns the 50 most recent cases; older cases need pagination before claiming unlimited support history.
