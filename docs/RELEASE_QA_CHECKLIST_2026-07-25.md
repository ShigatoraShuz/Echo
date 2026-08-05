# ECHO release QA checklist — 2026-07-25

This checklist records what was actually verified in this workspace. A checked item is evidence-backed; an unchecked item is a required release action, not an implied pass.

## Signup, consent, and AI transparency

- [x] Signup requires a display name, valid email, password confirmation, Terms acknowledgement, Privacy acknowledgement, data-processing acknowledgement, and AI-feature acknowledgement.
- [x] Journal analysis consent is clearly optional and defaults to off.
- [x] The signup UI links to the current Terms and Privacy pages and uses the ECHO moss/ivory visual language.
- [x] The privacy and AI disclosure states that AI-assisted reflection is optional, non-diagnostic, non-emergency monitoring, and only processes entries actively selected for analysis.
- [x] Consent metadata carries a version (`2026-07-25`) with the Supabase Auth signup request.
- [x] Database trigger stores versioned Terms, Privacy, data-processing, AI-information, and journal-analysis decisions when an account is created, including email-confirmation flows.
- [x] Consent history cannot be deleted directly by authenticated browser clients.
- [x] The new consent migration is applied to the linked Supabase project (`20260725104500`).
- [ ] Obtain institutional/legal review of the final Terms, Privacy Notice, retention schedule, consent wording, and any jurisdiction-specific requirements before public release.
- [ ] Add a controlled settings workflow to revoke optional AI analysis consent and verify its effect against a live account.
- [ ] Complete and test the Google OAuth callback consent step before enabling Google signup; external OAuth must not bypass the required declarations.

## Crisis-support experience

- [x] Crisis support is reachable without a protected app session at `/crisis`.
- [x] The crisis screen makes emergency action the first priority and explicitly says ECHO is not a crisis monitor or emergency service.
- [x] The screen offers a short, user-controlled safety plan: call emergency services, move toward safety, ask a trusted person to stay, and create distance from hazards when safe.
- [x] The 988 call/text and chat actions are labelled as United States services, avoiding a misleading global claim.
- [x] A breathing prompt is explicitly secondary and only shown as something to use while safe and waiting for support.
- [x] Crisis resource cards request only active, verified resources from the backend directory; a failure state tells the user to use local emergency services.
- [x] Buddy urgent-language handling flags the event and routes the response toward crisis support rather than attempting clinical advice.
- [ ] Migrate the legacy `/crisis-help` route from mock hotline data to this verified directory (or redirect it to `/crisis`) before public release.
- [ ] Have a qualified mental-health/safety reviewer validate the wording, escalation policy, local resource coverage, and any required safeguarding obligations before deployment.
- [ ] Add region detection only after privacy review and a tested fallback; do not infer location silently.
- [ ] Test every hotline number and website in the production verified-resource directory on its review cadence.

## Authentication and access control

- [x] Next middleware protects dashboard, journal, Buddy, insights, tools, settings, and admin paths when Supabase configuration is present.
- [x] Backend personal routes require a bearer token validated by the configured token verifier.
- [x] Buddy AI routes are gated by the account-verification middleware.
- [x] Profile-menu keyboard navigation and Escape focus restoration are covered by tests.
- [x] Account-verification migration is applied to the linked Supabase project (`20260724192001`).
- [ ] Run signed-in end-to-end tests with a non-admin, verified user, unverified user, and verification admin in the production-like environment.
- [ ] Configure and test production email confirmation, password policy, OAuth providers, CAPTCHA/rate limits, and session lifetime in the hosted Supabase project.

## Sensitive data and database safeguards

- [x] Backend encryption uses AES-256-GCM with a random 12-byte IV and authenticated encryption tag.
- [x] Journal and Buddy content use encrypted ciphertext fields rather than browser-readable plaintext columns.
- [x] Database RLS is enabled for private tables and owner-scoped policies are defined in migrations.
- [x] Service-managed audit metadata rejects common sensitive-content keys.
- [x] Backend enables Helmet, explicit CORS origins, a 1 MB JSON body limit, request IDs, safe error middleware, and rate limiting.
- [x] Supabase migration list confirms local and remote migration histories match.
- [ ] Perform an independent RLS policy test against the hosted project using two real test users.
- [ ] Rotate and securely store Supabase service-role, encryption, and AI-service secrets; verify they never reach browser bundles or logs.
- [ ] Run dependency vulnerability scanning, static security analysis, penetration testing, backup/restore rehearsal, and incident-response exercises before public launch.
- [ ] Verify audit-log retention, data-export/deletion workflows, storage-document access, and admin-review access against the hosted project.

## Frontend and backend validation executed

| Check | Result | Evidence |
| --- | --- | --- |
| Frontend type check | Pass | `npm --workspace echo-theme-system run typecheck` |
| Backend type check | Pass | `npm --workspace @echo/backend run typecheck` |
| Frontend unit/component tests | Pass | 24 files, 153 tests |
| Backend tests | Pass | 7 files, 18 tests |
| Workspace lint | Pass | Frontend Next lint and backend ESLint have no errors |
| Production build | Pass | Next production build generated 41 routes; backend TypeScript build passed |
| Supabase migration state | Pass | All seven local migrations are marked remote in `supabase migration list` |
| Rendered browser smoke check | Blocked | The Browser sandbox could not connect to the local dev server even though Windows reports port 3000 listening; use a local browser pass before release |

## Release decision

- [ ] **Do not call this a fully production-secure or clinically validated release yet.** The automated checks and migrations pass, but the unchecked operational, legal, live-integration, accessibility, and safety-review items above need completion and evidence.
