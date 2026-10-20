# Professional frontend browser checks

The default `npm run test:e2e --workspace frontend` discovers both Professional mocked journeys and Lloyd's actual Next.js mobile QA. It starts the loopback Vite harness on port 3101 and Next.js on port 3000. Staging remains separately opt-in.

- `npm run test:e2e:professional --workspace frontend`: Professional mocked journeys only, using installed Microsoft Edge (`ECHO_E2E_BROWSER_CHANNEL=chrome` can select Chrome). No backend, credentials, or database is needed.
- `npm run test:e2e:mobile --workspace frontend`: Lloyd's public mobile QA on actual Next.js, including Chrome, WebKit, 320px phones, and tablets. Install Playwright's Chromium and WebKit browsers first.
- `npm run test:e2e:staging --workspace frontend`: existing guarded staging suite; requires the declared separate HTTPS staging app/project. Never substitute the linked project or local fixture credentials.

These are **mocked browser journeys**, not live authenticated integration tests. Playwright runs actual professional views, the workspace gate, dialogs and existing Tailwind styles in a loopback Vite harness. Test-only aliases replace Next navigation/image loading, Google rendering and service boundaries. Fictional service responses are intercepted by Playwright; external traffic is blocked. No fake JWT, login session, authentication bypass or mock route is added to the production application. The harness is outside `src/app` and is not a Next route. It has no real API destination.

Professional coverage includes login validation; pending/suspended/expired/MFA gates; organization choice and switching; request filters and claims; My Cases; consent clearing, PHQ-8 snapshots and case messages; coordinator assignment; notes and closure; appointments/referrals; authorization, session, network and service failures; and isolated preview inspectors. Responsive checks cover 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 pixel widths across the suites. Fictional screenshot captures and generated results are ignored under `.artifacts`.

Production and nonlocal preview restrictions are exercised separately against the actual route/proxy code:

```sh
npm run test --workspace frontend -- src/app/dev/professional-preview/page.test.tsx src/proxy.test.ts
```

The harness-only `/synthetic-preview` renders the fictional presentation component directly; it does **not** exercise or replace the guarded application route `/dev/professional-preview`.

Still required for release acceptance: live authorized integration on the intended deployment, deployment-level preview guards, and owner device/visual QA. Professional mocks do not establish server authorization, consent enforcement, delivery guarantees, or database readiness. The additive `20261020103920_professional_shared_case_snapshot.sql` connects v2 shared records to the existing audited Professional snapshot; it requires separate review/application before deployed v2 clinical reads are accepted. The historical 18-version release manifest was not expanded or deployed by this merge. Unsupported escalation remains unavailable.
