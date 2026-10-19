# Authentication and mobile acceptance plan

**Date:** 2026-10-18

**Scope:** R2 and R3 in the [user release gaps tracker](./2026-10-17-user-release-gaps-execution-plan.md)
**State:** Local remediation and emulated-device verification in progress. Hosted authentication and physical-device acceptance remain open.

## Goal and boundaries

A new user can register, confirm email, sign in with email or Google, recover access, and use every ordinary-user route on a phone. Authentication failures explain a safe next step. Mobile layouts remain readable and operable at 200% zoom and with assistive technology. Record actual hosted and physical-device evidence before marking either task accepted.

This is an acceptance and targeted-remediation plan. Preserve the current uncommitted work and existing ECHO UI. Do not change provider limits, OAuth settings, send bulk email, create or delete accounts, or deploy as part of planning. Later execution may use approved disposable accounts and a test inbox; record cleanup separately. Do not use Lloyd's account.

## Current baseline and relevant code

| Area | Existing implementation or evidence | Remaining gap |
| --- | --- | --- |
| Email and password | Supabase Auth SDK handles signup, login, OTP and recovery in `frontend/src/services/authentication/auth.supabase-adapter.ts`; signup also has a registration draft/resend API in `frontend/src/services/authentication/registration-api.ts` and `backend/src/features/registration/`. | Prove the active UI path against the **hosted** project, including email delivery, callbacks, limits and recovery. Do not assume the local `supabase/config.toml` governs the hosted project. |
| Google | `frontend/src/features/authentication/components/secure-google-button.tsx`, backend registration proof and `frontend/src/app/(auth)/callback/route.ts` form the current flow. | Verify the exact hosted origin, client configuration, callback and account state on iPhone Safari and Android Chrome. |
| Local mobile coverage | `frontend/playwright.config.ts` defines Pixel 5, iPhone 13 WebKit, 320 px and touch-tablet projects; `frontend/e2e/public-mobile.spec.ts` exercises public pages and selected login behavior. A prior disposable-account smoke covered a few protected pages in emulation. | Automated signed-in route coverage, 200% zoom, assistive technology, failure states and physical phones remain open. |
| Security controls | Express registration has a local 12/minute limiter; Supabase Auth calls use SDK fields. | Inspect effective hosted Auth settings, verify the 30-minute inactivity sign-out and server-side protection, and record behavior without load-testing production. |

Before execution, save `git status --short`, inspect diffs on any file to be edited, and follow `frontend/AGENTS.md` plus the installed Next.js documentation when touching frontend routes. Existing dirty files are not a reason to reset or overwrite work.

## Phase A — Hosted authentication configuration inventory (P0)

1. Identify the exact staging/hosted web origin, Supabase project reference, public callback URL, Google OAuth Web client and test inbox. Record names and URLs in a private QA record; never copy tokens, SMTP passwords or personal mail into the plan.
2. Read the **effective hosted** Auth settings: email signup/confirmation, site and allowlisted redirect URLs, password policy, email-send and OTP/verify/request limits, CAPTCHA, custom SMTP status and sender domain. Read Google authorized JavaScript origins and redirect configuration for the active client. Compare each with the application's generated callback URLs and local expectations.
3. Record the provider's current values and observation date. Use the Supabase Auth dashboard or read-only Management API; avoid rate-limit stress tests. A local config file, UI copy or one successful request cannot establish the hosted limit.
4. Resolve a mismatch by changing only the responsible configuration or application boundary **during implementation**, with separate authorization for external provider changes. Keep a before/after record.

Supabase's [rate-limit documentation](https://supabase.com/docs/guides/auth/rate-limits) identifies the hosted Auth configuration and Management API; its [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) governs signup and recovery links. Confirm the actual project's values because provider defaults and account quotas can change.

## Phase B — Authentication journey matrix (P0)

Run each successful journey with disposable identities on the hosted test environment and both real phones. Use a separate controlled fixture or mocked provider response for 429, email quota and 503; do not exhaust the live sender to trigger a failure.

| Journey | Required result and failure check |
| --- | --- |
| Email signup | Submit once; see accurate confirmation instructions; receive mail; open the link on the same and another mobile browser; reach the intended onboarding destination. A repeated tap cannot create duplicate requests. |
| Confirmation and resend | Expired/used link explains how to request a fresh one; resend respects the actual cooldown; incorrect code, mail failure or quota gives a safe retry path without revealing whether another account exists. |
| Email login | Correct credentials establish a protected session after reload. Invalid credentials, offline, timeout and hosted throttling leave input usable and show a specific next action. |
| Google login | New and existing approved users reach the correct destination and keep the session after reload. Test popup/credential cancellation, blocked popup, changed origin, provider/network failure and mobile browser return. Capture whether failure occurs before or after the GIS credential callback. |
| Password recovery | Request from phone, receive mail, follow an allowlisted link, set a new password, then sign in. Expired/used link and unknown address use safe copy; old credentials no longer work after the change. |
| Session and access | Verify 30 minutes of true inactivity ends the session, active use does not; logout/back navigation cannot reveal protected content. A 401/expired session takes the user to reauthentication without exposing draft or account data to another user. |

Record status/error code and sanitized request ID for each failure, plus whether the UI preserves fields, enables retry, and avoids duplicate submission. Never log passwords, OTPs, access tokens or private journal text. Verify account ownership and redirect allowlisting with existing tests before adding any new endpoint.

**Likely repair files, only if a failure is reproduced:** authentication views and view-models under `frontend/src/features/authentication/`; `auth.supabase-adapter.ts`; `secure-google-button.tsx`; callback route; registration routes/service; their focused tests. Provider configuration changes remain separate from code changes.

## Phase C — Signed-in mobile route matrix (P0)

Create a non-sensitive disposable user fixture with the permissions needed for each ordinary-user destination. Use a stable production-mode staging build for performance observations; Next.js development compilation is not a route-performance result.

| Group | Routes and actions to traverse |
| --- | --- |
| Core shell | Dashboard, navigation drawer, Calendar, notification bell/inbox, profile menu, logout; open/close with touch, keyboard and browser Back. |
| Journal | Library, new entry, draft resume, saved entry, photo upload and retry, delete confirmation; verify text and selected-photo loss prevention. |
| Buddy | New chat, saved history, reopen and continue; gated/disabled-history and failed-send states. |
| Insights and Grounding | Overview and insight detail routes; grounding start/pause/resume/history; keep unavailable AI results labeled accurately. |
| Support | Find Help, Crisis, professional support discovery/request/message/appointment/history where the fixture is authorized; appointments link to Calendar. Crisis actions stay reachable during API failure. |
| Settings | Profile, Privacy, Notifications, Security, Trusted Contacts, Verification, Export and Deletion; each control shows its current value, save feedback, reload result and useful failure recovery. |

For every route, run at 320 px, 390 px and 768 px emulated widths first, then on a physical iPhone/Safari and Android/Chrome in portrait and landscape. At **200% browser text/page zoom**, check reflow without horizontal scrolling or clipped dialogs, visible primary actions, safe-area insets, software keyboard and sticky composer/action placement. Test long translated-like strings and empty/loading states where relevant.

## Phase D — Accessibility, motion and failure-state checks (P0)

1. Run `@axe-core/playwright` on representative public and signed-in screens, triage all serious/critical violations, then manually check items automation cannot prove: reading order, visible focus, meaningful control names, labels/errors, touch target spacing, contrast, dialog focus trap/return and Escape.
2. Use VoiceOver on iPhone and TalkBack on Android for navigation, forms, notifications, Journal, Buddy and Settings. Confirm actions are announced and can be completed without relying on visual motion or color.
3. Check system Reduced Motion and ECHO's Full Motion override. Content and success/error feedback remain present in both modes; urgent Crisis/Find Help actions stay immediate.
4. Simulate slow network, offline, 401, 403, 429 and 503 at the UI/API boundary. Check that errors are visible, retry is possible, in-progress writing/settings input remains intact, and loading indicators stop. Do not force live production outages.
5. At the end of each route, check browser console and network requests for unhandled errors and repeated requests. Record navigation timing using a production build, separating backend latency from rendering.

**Likely repair files, only after a failed case:** `frontend/src/shared/components/layout/app-shell.tsx`, navigation and notification components, `frontend/src/config/navigation.config.ts`, affected feature view/view-model/service, `frontend/src/app/globals.css`, and `frontend/e2e/*`. Keep repairs narrow and preserve existing animation and theme.

## Evidence and acceptance gate

Maintain a dated QA table with: environment/project, device model, OS and browser version, viewport/zoom, route, action, expected/observed result, sanitized status/request ID, console result, screenshot/video path, and pass/fail. Never include credentials or private content. Label automated emulation, hosted provider checks and physical-device observations separately.

- **R2 accepted:** Hosted settings recorded; signup, confirmation/resend, email login, Google login, recovery, throttling/failure copy and inactivity/session behavior pass on the intended hosted origin and real phones. Any provider issue has a named owner and fix or remains a release blocker.
- **R3 accepted:** Every ordinary-user route in the matrix is reachable and usable on iPhone Safari and Android Chrome; 200% zoom, keyboard/screen reader, Reduced Motion, failed requests and production-mode route performance have dated evidence. No critical/serious accessibility blocker or data-loss failure remains.
- **Regression after fixes:** Run focused frontend/backend tests and typechecks, Playwright public plus new protected-route tests, lint, production build with legitimate staging configuration, `git diff --check`, then repeat the affected physical-phone journey. Update R2/R3 in the parent tracker with the actual outcome; do not mark them done from a passing unit test or emulator alone.

## Execution order and dependencies

1. Read-only hosted configuration inventory and staging URL/fixture preparation.
2. Email and Google journeys, then recovery and session/security checks.
3. Automated protected-route and failure-state checks; fix only observed issues.
4. Physical iPhone/Android, 200% zoom, VoiceOver/TalkBack and production-mode measurements.
5. Final regression, evidence review and tracker update. If phones, test inbox or provider access are unavailable, keep the affected acceptance item pending rather than substituting emulation.

## Execution record — 2026-10-18

| Check | Result | Boundary |
| --- | --- | --- |
| Linked Supabase project inventory | CLI confirmed the linked project is active and healthy. | The dashboard requires a separate sign-in; effective Auth email/OTP limits, CAPTCHA, SMTP, OAuth origin and redirect settings were not readable from this workspace. Do not infer them from the local config. |
| Signup failure recovery | Backend rolls a reserved registration draft back to the account step when Supabase returns or throws a provider error. It reports a safe 429/503 message; if rollback is uncertain, it asks the user to check the inbox and start again. Frontend handles network loss, 429 and 5xx without displaying raw provider errors. Focused frontend and backend tests passed. | Real email quota, inbox receipt and callback were not exercised. |
| Public mobile routes | Playwright: 92 passed, 4 tablet-only exclusions across Pixel 5 Chromium, iPhone 13 WebKit, 320 px Chromium and 768 px touch tablet. Login, signup, recovery and reset pages reflow at 200% root text size. Automated axe checks found no serious or critical violations on login/signup. | Emulation is not physical Safari/Chrome or a screen-reader pass. |
| Signed-in mobile | Disposable linked-project accounts reached Dashboard, Settings, navigation and Journal flows. Focused iPhone WebKit Settings/Journal 200% and Journal Back/draft/photo/save/reload/overview checks passed; each account was removed. A longer route sweep exposed the shared 120/min per-IP API limiter and a temporary access-check redirect after synthetic rapid navigation. | The full rapid route sweep cannot be marked accepted from that run. The smoke harness now reports failed saves explicitly and can separate route and Journal checks. |
| Regression | Frontend/backend typechecks and lint passed. Focused auth/proxy/Settings/notification tests passed (173 frontend, 23 backend); 11 idle-session tests passed. Backend build and `git diff --check` passed. | Production frontend build with staging configuration, an actual 30-minute device observation, live Google/email recovery, assistive technology and physical phones remain pending. |

**Next acceptance actions:** Inspect effective hosted Auth settings with an authorized Supabase dashboard session; test disposable signup, email confirmation/resend, Google and recovery with a test inbox; repeat the signed-in route and Journal flows on an iPhone and Android device, including 200% zoom and VoiceOver/TalkBack. Record device, browser, status and sanitized request IDs. Do not mark R2 or R3 accepted until these are observed.
