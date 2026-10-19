# ECHO whole-app QA execution

## Current evidence and release status

The [route manifest](../../frontend/e2e/route-manifest.json) maps all 62 `page.tsx` routes and `/callback`. CI runs the manifest check, so a new page without a record fails the check. The existing public Playwright suite covers mobile navigation, authentication form layout, the landing-page anchor, reduced motion, crisis fallbacks, accessibility, and overflow. The staging route suite adds desktop, iPhone WebKit, Android Chromium, and 200% text-size checks, plus visible-control and request-timing evidence. The staging journeys exercise mobile Settings navigation, failed-save recovery, Grounding interactions, Journal upload retry, and owned/missing/other-user journal detail. The existing disposable-account API/browser journeys cover ordinary-user persistence, Journal drafts/photos, Buddy continuation, two-account professional messaging, an appointment linked to Calendar, and cleanup.

**Release status: pending.** No staging URL or project ref has been supplied for this run. The staging suites have not been executed, privileged route states have not been provisioned, and real Google/email/push, physical-device, and model-worker acceptance remain open. A green route smoke check alone does not prove every button works.

## Safe staging target

Use a separate Supabase project and a staging web/API deployment with matching HTTPS configuration. Put server-only keys in `backend/.env.qa.local` (ignored by Git); never add them to Playwright browser state manually or paste them into a chat. The staging guard rejects the currently linked project, mismatched Supabase ref, local HTTP targets, and an API URL that does not end in `/api/v1`.

PowerShell setup, replacing only the example URLs and ref:

```powershell
$env:ECHO_QA_ENV_FILE = 'C:\path\to\Echo\backend\.env.qa.local'
$env:ECHO_STAGING_PROJECT_REF = 'separate-staging-project-ref'
$env:ECHO_STAGING_BASE_URL = 'https://staging.example.com'
$env:ECHO_STAGING_API_BASE_URL = 'https://api.staging.example.com/api/v1'
```

The env file needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from that staging project. Start with `npm.cmd run test:e2e:routes -w frontend` to confirm manifest coverage. Then run:

```powershell
npm.cmd run test:e2e:staging:core -w frontend
npm.cmd run test:staging:integration -w backend
npm.cmd run test:staging:support -w backend
```

The core browser runner creates unique confirmed synthetic accounts for each onboarding stage, a member and an unrelated user, plus a journal and calendar item. It signs in through the UI, saves short-lived browser states, checks unrelated-user journal denial, runs the public and ordinary-user route suite, deletes the fixtures, and verifies profile/journal/calendar cleanup. Failed tests still trigger cleanup; a cleanup failure reports its run ID for investigation. The Buddy/professional script uses real TOTP MFA for its disposable practitioner. It removes its synthetic organization and accounts after the journey; that organization cleanup requires the Supabase CLI to be logged in with access to the **staging** project ref.

## Route and action evidence

Run `npm.cmd run test:e2e:record -w frontend` once per release candidate. It creates a dated CSV with one **pending** row per manifest entry. Fill in device, observed result, sanitized request ID, console/network result, trace or screenshot, defect link, and pass/fail after testing each action. Add separate rows for multiple controls on the same route. The route smoke attaches a `visible-controls` inventory and `route-timing-and-api` evidence to its Playwright report. It also writes `frontend/playwright-staging-performance.json` with per-device navigation/API p95 and routes above three seconds. Correlate proxy and backend log durations by request ID; browser timing alone does not isolate the proxy. Use the control inventories to check every visible button, link, form, menu, and dialog; do not mark a route passed from heading visibility alone.

| Journey | Automated source | Acceptance still required |
| --- | --- | --- |
| Public and crisis pages | `public-mobile.spec.ts`, staging route sweep | Physical call/link behavior and directory outage on phones |
| Auth and onboarding | route sweep, ordinary-user fixture runner, backend registration tests | Real email confirmation/reset, Google sign-in, rate-limit response, 30-minute idle on staging phones |
| Dashboard, Journal, Settings, Insights, Grounding | `live-integration.mjs`, staging route/critical tests | Human action inventory, empty/error screens, 200% zoom, VoiceOver/TalkBack |
| Buddy and professional support | `live-buddy-professional.mjs` | Full route sweep with provisioned gated and admin identities, real organization review |
| AI handoff | contract/backend tests and unavailable UI | Real model output through worker, evaluation and safety evidence |

## Full release gate

For privileged route acceptance, prepare **disposable** browser states named `buddy-eligible.json`, `support-case.json`, `mfa-practitioner.json`, and `mfa-admin.json` in `ECHO_STAGING_AUTH_STATE_DIR`; the core runner creates the additional `unrelated.json` state. Provide owned synthetic IDs in `ECHO_STAGING_ROUTE_IDS_FILE` for `journalId`, `userSupportRequestId`, and `practitionerCaseId`. These states must come from real staging sign-ins with the intended gates and MFA, not cookie fabrication. The current core runner does not generate the privileged states. Run the complete route suite only after they exist, and delete them and their records after the run. Do not accept a release with those routes skipped.

Run the existing contracts build, frontend/backend typechecks, lint, unit tests, isolated SQL checks, and production build using valid staging configuration. The CI production build expects GitHub secrets `ECHO_STAGING_SUPABASE_URL`, `ECHO_STAGING_SUPABASE_PUBLISHABLE_KEY`, and `ECHO_STAGING_API_BASE_URL`; a missing secret keeps that build gate red. In a warm production build, record navigation, proxy, and API timings separately; investigate repeated calls or protected transitions above 3 seconds at p95. Test offline, timeout, 401, 403, 429, and 503 by intercepting requests in the browser. Use real staging identities for Google/email/push checks rather than mocks. Complete portrait, landscape, keyboard, 200% zoom, safe-area, reduced-motion, VoiceOver, and TalkBack checks on physical iPhone and Android devices. Release requires every route/action record passed, no open P0/P1 defects, all fixtures removed, and provider-dependent tests recorded as pending until configured.
