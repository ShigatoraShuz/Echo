# Local Professional Portal fixtures

These are fictional, offline-provisioned fixtures for the Docker Desktop Supabase stack in this checkout. They are not real practitioners, licenses, approvals or client records. Do not use this script against staging or production. It is not an application feature, login shortcut, automatic seed, or migration.

## Create and inspect

From `C:\1Thesis\Echo`, with dependencies installed and the local Supabase stack running:

```powershell
node --import tsx backend/scripts/professional-local-fixtures.mts setup
node --import tsx backend/scripts/professional-local-fixtures.mts inspect
node --import tsx backend/scripts/professional-local-fixtures.mts check
```

The runner requires the existing `desktop-linux` Docker context to resolve to the local Docker Desktop named pipe. It verifies running container project/workdir labels, Auth's database host, local port bindings, Mailpit routing, PostgreSQL system identifier, and all professional migration ledger entries before fixture writes. It does not read application `.env` files, linked project references, remote URLs or externally supplied API keys. HTTP calls are pinned to `http://127.0.0.1:54321`; redirects are rejected. Local keys are read privately from the local Studio container and never printed or saved in the fixture manifest.

The older `20260830010000` migration sets `authenticator`'s `pgrst.db_schemas` without `professional_service`, overriding the current local config. `setup` appends that schema to this **verified local database only**, then reloads PostgREST configuration/schema and waits for readiness. No browser grants, RLS rules, migration files or remote configuration are changed. Remote API-schema readiness remains a separate owner-controlled release concern.

| Fictional email | Organization | Fixture state |
| --- | --- | --- |
| `client@professional.echo.test` | None | Eligible client; no professional membership |
| `approved-a@professional.echo.test` | Fictional Echo Test Organization A | Active counselor; independently approved credential |
| `approved-b@professional.echo.test` | Fictional Echo Test Organization B | Active counselor; independently approved credential |
| `pending@professional.echo.test` | A | Pending membership and pending credential; no professional access |
| `suspended@professional.echo.test` | A | Previously approved credential/membership, then suspended through the existing service |
| `org-admin@professional.echo.test` | A | Active nonclinical `org_admin`; no credential-review authority |
| `reviewer@professional.echo.test` | None | Existing application verification-admin registry; no clinical membership |

Organization slugs are `echo-professional-local-v1-a` and `echo-professional-local-v1-b`. The reviewer is separate from every approved member. Organization membership alone never makes someone a reviewer.

Setup uses existing registration eligibility/agreement RPCs, the actual signup-provisioning trigger, supported Supabase Auth admin account creation, existing onboarding services, the canonical verification-admin bootstrap, and professional organization/credential/membership services. Test emails are administratively confirmed as part of local fixture provisioning; email delivery/verification is not claimed as tested. The sole direct membership fixture insert records a **pending**, non-authorized application; it never activates access.

Evidence references explicitly say they are fictional. They use the existing AES-GCM encryption service. Clinical activation requires matching, independently reviewed, unexpired credential records; suspension uses the existing RPC. All constraints, triggers, audits and private-schema permissions remain enabled. The trusted offline provisioner does not impersonate a signed-in administrator or claim to test HTTP MFA/approval journeys.

## Private local material and idempotence

Random per-account passwords, a fixture-only encryption key, a registration secret, IDs and database fingerprint are stored in `backend/tmp/professional-fixtures/state.json`, already excluded by `.gitignore`. **Do not print, commit, attach or share this file.** Treat it as local credentials. Files request owner-only permissions where supported; Windows access follows directory ACLs, so keep the checkout in the developer's private account. `inspect` prints only fictional identities, IDs and status information.

Use the local manifest privately for test login passwords. No default/shared password is embedded in source. A future backend instance used with these fixtures must use this fixture encryption key as version 1 and the verified local Supabase URL/keys in its own ignored local environment. Do not overwrite an existing application environment or reuse remote encryption keys. Runtime environment setup is outside this fixture step.

Repeated setup preserves account IDs/passwords, organization IDs, approvals, expiry and membership states. It does not renew credentials or silently reactivate changed memberships. Approval expiry is fixed to 180 days after the first setup. Checks fail when state drifts or expires. Namespace collisions, mismatched database fingerprints and unknown accounts are refused. A lock prevents concurrent runs. After a process crash, remove only `setup.lock` after verifying no setup process is running; rerun setup to resume. Preserve the manifest to recover an interrupted account creation safely.

## MFA and Mailpit

Mailpit is already configured as the local Auth SMTP destination and is available at `http://127.0.0.1:54324`. The runner verifies its HTTP health and Auth SMTP routing; it does not send mail or claim a delivery/recovery journey passed. Password recovery/verification messages can be inspected there during later local Auth testing; do not share message links or OTPs.

At the initial fixture checkpoint, local TOTP enrollment and verification were disabled. The subsequent real-app integration checkpoint enabled both in `supabase/config.toml`, restarted the local stack **without resetting its data**, and verified a genuine TOTP enrollment/challenge for `approved-a`. Runtime MFA remains required: no AAL2 claims, JWTs or sessions are fabricated. Other fictional professionals/reviewers must enroll through supported Auth MFA when needed. Reviewer actions additionally require recent authentication. Offline fixture approvals do not satisfy session requirements.

## Focused validation

`setup` and `check` run 45 assertions against actual local Supabase Auth/PostgREST/PostgreSQL:

- Seven confirmed, tagged, eligible/onboarded identities and five expected membership states.
- Approved A/B and organization-admin scoped dashboard access.
- Cross-organization, client, pending and suspended denial at both the existing service and SQL RPC boundaries.
- Organization admins cannot review credentials; independent approver and encrypted evidence checks.
- Real PostgreSQL self-review rejection inside a transaction that is rolled back, leaving no extra credential/audit fixture.
- Real password login, existing token/session verifier, AAL1 denial by the unchanged MFA middleware, and authenticated-browser private-table denial.
- Mailpit HTTP availability.

Checks create normal dashboard access audits and a short-lived real local Auth session (signed out afterward); they are not strictly read-only. They create no requests, cases, appointments, notes, referrals, confidential records or synthetic successes in the application. This is not Postman, browser E2E, an AAL2 journey or concurrency testing.

Boundary regression tests (no database/network required):

```powershell
npm --workspace backend test -- --run tests/security/professional-local-fixtures.test.ts
```

## Safe cleanup

```powershell
node --import tsx backend/scripts/professional-local-fixtures.mts cleanup
```

Cleanup **retires** these fixtures without deleting history: it suspends the two fixture organizations, bans the seven fixture Auth accounts, marks their profiles suspended, and revokes fixture reviewer authority. It checks exact tagged identities/manifest IDs and refuses organizations containing nonfixture members or any case data. No table truncation, database reset, trigger disabling or cascading deletion is used. Repeating cleanup is safe. Existing MFA/session guards and database eligibility checks still apply.

Cleanup is prepared but was **not executed** at the setup checkpoint, so the fixtures remain available. After retirement, `setup` intentionally refuses to silently restore privileges. Use a separately prepared disposable local stack and archive its old private manifest outside version control if a fresh lifecycle is needed; verify the new database before setup. Any physical database reset or removal of historical records is a separate operation requiring explicit authorization. Never substitute a remote project.

## Run the actual application locally

Start Docker Desktop and the existing local Supabase stack first. From the repository root, run these in separate terminals:

```powershell
node --import tsx backend/scripts/professional-local-app.mts backend
node --import tsx backend/scripts/professional-local-app.mts frontend
```

Open `http://127.0.0.1:3000/professional/login`. These guarded launchers invoke the existing workspace `npm run dev` commands. They inject local Supabase/public API settings and fixture encryption/registration keys into their child processes. Existing backend/frontend `.env` files and remote credentials are not overwritten. The frontend uses the real HTTP adapter; the backend runs with AI processing disabled. Google credentials are deliberately not reused in this isolated password/TOTP test. Use `127.0.0.1` consistently for the app, backend and Supabase. Stop the terminal processes to stop these app instances; that does not reset Supabase.

The scoped, opt-in **actual browser** check is:

```powershell
node --import tsx frontend/e2e/professional-local-live.mts
```

It uses installed Edge/Playwright, the actual Next login/access/dashboard pages, the actual Express backend and local Supabase. It performs no API mocking or session injection, never uses the preview, and blocks browser requests to nonlocal origins. It enters the existing fixture password, enrolls/challenges real TOTP through the UI, verifies an organization-A dashboard response and AAL2 membership, and checks organization-B denial. Additional actual HTTP checks verify pending/suspended membership states and their AAL1 dashboard denial; the separate fixture check verifies membership denial directly at service/SQL level.

The automated authenticator secret for this fictional account is retained privately in the ignored `backend/tmp/professional-fixtures/mfa.json` so subsequent runs use the same verified factor. Do not print, upload or commit this file. For manual login, privately import that test factor into an authenticator and use the existing private fixture password. The test refuses to replace a verified factor if its secret is unavailable. No screenshots, traces, video, passwords, OTPs or bearer tokens are written to test reports.

Integration fixes: the professional access page encodes Supabase's multiline SVG data URL before handing it to Next Image; otherwise Next rejects its trailing control character and the MFA page crashes. The local-only applied audit migration (originally `20261018140000_security_professional_http_audit.sql`, now `20261018150000_security_professional_http_audit.sql` after a verified local-ledger version correction without DDL replay) adds the already-emitted `professional.request` event to the existing security-event constraint, retaining every prior allowed event and all RLS/grants. Professional request audit inserts now succeed. Apply this migration remotely only through a separately approved release; no remote change was made. Do not roll it back by deleting audit history.
