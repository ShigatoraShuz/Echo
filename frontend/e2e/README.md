# Professional frontend browser checks

Run `npm run test:e2e --workspace frontend` from the repository root. The default browser is installed Microsoft Edge; set `ECHO_E2E_BROWSER_CHANNEL=chrome` for installed Chrome. Install workspace dependencies first. No browser download, backend, credentials, or database operations are required. Port 3101 must be free.

These are **mocked browser journeys**, not live authenticated integration tests. Playwright runs actual professional views, the workspace gate, dialogs and existing Tailwind styles in a loopback Vite harness. Test-only aliases replace Next navigation/image loading, Google rendering and service boundaries. Fictional service responses are intercepted by Playwright; external traffic is blocked. No fake JWT, login session, authentication bypass or mock route is added to the production application. The harness is outside `src/app` and is not a Next route. It has no real API destination.

Coverage includes login validation; pending/suspended/expired/MFA gates; organization choice and switching; request filters and claims; My Cases; consent clearing; notes and closure; appointments/referrals; authorization, session, network and service failures; and isolated preview inspectors. Responsive checks use 360, 768, 1280 and 1920 pixel widths, long organization labels, mobile touch targets, dialog bounds and keyboard focus restoration. Screenshots, traces and video are disabled. Generated results are ignored under `.artifacts`.

Production and nonlocal preview restrictions are exercised separately against the actual route/proxy code:

```sh
npm run test --workspace frontend -- src/app/dev/professional-preview/page.test.tsx src/proxy.test.ts
```

The harness-only `/synthetic-preview` renders the fictional presentation component directly; it does **not** exercise or replace the guarded application route `/dev/professional-preview`.

Still required for release acceptance: owner visual QA with actual Next fonts/layouts and supported browsers, real Google/email sign-in and MFA, live authorized service integration, and deployment-level verification of preview unavailability. Service mocks do not establish server authorization, consent enforcement, delivery guarantees, or database readiness. The unapplied credential migration and unsupported escalation, task, notification and rescheduling APIs remain out of scope.
