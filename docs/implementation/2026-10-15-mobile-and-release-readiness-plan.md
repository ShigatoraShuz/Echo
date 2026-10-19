# ECHO user-side mobile implementation plan

**Updated:** 2026-10-17

**Scope:** Public visitor pages and the ordinary signed-in user's web experience.

**Excluded:** Admin screens, practitioner portal, database migrations, worker or model implementation, provider configuration, and production deployment. Those systems may be dependencies, but this plan does not authorize changing them.
**Status:** Public-page mobile fixes, the shared phone shell, Settings navigation, Journal library navigation, and focused user-side availability/recovery fixes are implemented locally. Login error recovery and 320 px password layout have been checked. A disposable-account signed-in phone smoke passed in Chromium and WebKit. Full signed-in route, hosted Auth rate-limit, and physical-device acceptance remain open.

## 0. Delivery tracker

Update this table after each implementation slice. **Implemented locally** means code and focused checks exist; **accepted** requires the full user journey and device checks listed later. Existing uncommitted work is preserved.

| Work package | Current state | Evidence in this checkout | Still needed for acceptance |
| --- | --- | --- | --- |
| Public landing and information pages | Implemented locally | Mobile intro, equal-width hero actions, readable showcase, compact reflection paths, persistent header, and corrected landing fragment navigation; `frontend/e2e/public-mobile.spec.ts` passed 68 checks with 4 intentional tablet skips on 2026-10-17, including mobile login controls, motion preferences, and crisis call actions during directory failure. | Physical iPhone/Android checks, broader slow-network and failure cases, complete accessibility review. |
| A0 login and authentication | Implemented locally, provider acceptance pending | Password login now recovers from a rejected request without losing credentials or locking its button, and Supabase 429 errors explain that the user should wait before retrying. The 320 px form separates Remember me and Forgot password with 44 px targets. Local Supabase Auth config limits sign-in/sign-up and OTP verification to 30 requests per IP per five minutes; Express registration has an additional 12/minute limiter and the API has a 120/minute global limiter. Login passes credentials as fields to Supabase Auth SDK; no login SQL string is assembled. Focused unit tests, three phone browser layout checks, and disposable-account password login in Chromium/WebKit passed. | Verify the hosted Supabase project's actual Auth limits and CAPTCHA/abuse posture, plus email-code, password, and Google login on physical phones. Process-local Express limits do not protect direct Supabase Auth requests or aggregate across backend replicas. |
| M0 app motion | Browser-checked locally, acceptance pending | Landing canvas animation ran in Chromium and WebKit phone emulation and tablet, stopped under Reduced Motion, and returned with the user's Full Motion override. A disposable-account run also confirmed the signed-in Journal page transition in normal and reduced-motion modes in 320 px Chromium and iPhone WebKit. | Inspect common route transitions, interruption, and performance on physical phones. |
| U1 shared phone shell | Implemented locally, acceptance pending | Page title, accessible menu, focus/Escape behavior, public-menu restrictions, and one viewport-specific notification entry in `app-shell.tsx`; notification panel now has Retry, Escape, focus return, and a bounded phone layout. Signed-in 320px Chromium and iPhone WebKit smoke reached Journal through the phone menu and opened/closed notifications. | Authenticated journey across all user routes, tablet/desktop visual pass, notification API failure/recovery, and physical devices. |
| U2 Settings phone navigation | Implemented locally, acceptance pending | `/settings` index and seven section links; Privacy and Notifications Retry retain edited forms. Notification and masked-alert copy states that delivery is unavailable and settings save preferences only; onboarding uses the same truthful wording. Disposable-account API smoke passed Settings actions, and all seven phone Settings sections opened without viewport overflow in Chromium and WebKit. | Physical-device and assistive-technology QA, plus full preference-to-effect review. Reminder, push, and email delivery remain unavailable and need separate service work. |
| U3 Journal library navigation | Implemented locally, acceptance pending | Phone entries open the full page, show the first saved photo in a square Polaroid, and clear filters in one action. A partial photo-upload retry skips photos that succeeded earlier in the same editor session. Internal app links confirm before discarding selected photos and save the text draft before leaving; crisis links stay immediate. The disposable-account 320 px Chromium and iPhone WebKit flows passed create → leave → resume → add photo → save → detail → reload → overview, after fixing a concurrent draft-save race. The test account and data were removed. | Repeat on physical phones; cover browser Back with unsaved photos and upload failure. Selected photos are still not stored with text drafts. |
| U4 Dashboard, Calendar, Insights, facial | Partially implemented locally | Dashboard now distinguishes simulated analysis from user results; Distress Insights shows reported bands and provenance instead of a fabricated 0–100 score. Simulated results cannot start a Buddy handoff. | Calendar and facial responsive/failure-state review, source-label audit across remaining panels, controlled contract fixtures, and authenticated mobile QA. AI model integration remains Lloyd's separate task. |
| U5 Buddy, Grounding, Find help, Crisis | Partial user-side implementation; acceptance pending | Buddy has a viewport-height thread, reachable composer, desktop conversation rail, and phone history sheet. Grounding now explains background timer behavior, retries history loading, and handles an uncertain save without silently posting a duplicate. Public crisis call actions remain reachable when the resource API fails in Chromium and WebKit phone emulation. | Signed-in Buddy QA against the real backend, full Grounding/Find help touch journeys, physical devices, and broader failure-state coverage. |
| U6 user professional support and notifications | Partial user-side recovery; acceptance pending | The appointments page can reload after an API failure without discarding previously loaded appointments; focused component tests cover this path. Existing routes and services are listed in section 4. | Two-account QA fixture, appointment/Calendar journey, notification destination tests, and physical-device QA. |

**Five-hour usage-window estimate:** The first slice—shared navigation, Settings discovery and failed-save recovery, Journal library navigation, focused tests, a public browser pass, and disposable-account API checks—is coded and locally checked. Signed-in phone smoke now covers Settings discovery and the Journal draft/photo journey in Chromium and WebKit. Completing every U2–U6 browser flow and physical-device QA will take additional sessions. Model implementation and evaluation remain Lloyd's separate work. These are scope estimates, not promises about Codex usage percentages or elapsed time.

**Usage snapshot (2026-10-16 14:19 China time):** At that time the account's shared five-hour Codex window was 33% used, leaving about 67%. This historical snapshot is not a current usage estimate; the work-package states above are the durable progress record.

## 1. Outcome and design direction

A person using a phone must be able to discover ECHO, sign in, reach any user feature, complete or resume a task, understand a result, and recover from a failed request. The same content and controls must remain available on desktop. Mobile adaptation changes composition and interaction, not the product's privacy and safety boundaries.

Preserve ECHO's existing cream, forest green, sage, Cormorant display type, Manrope interface type, photographic hero, and purposeful motion. The public site should persuade calmly; the signed-in app should help users operate quickly. Keep urgent support immediately actionable. Use the installed Codex **Impeccable** skill for responsive adaptation and UI review, and **Design Taste Frontend** for public landing and marketing pages. Design Taste Frontend is scoped to the public site; it is not a replacement system for Settings or other multi-step product UI. These are Codex skills already available on this machine, not npm runtime libraries.

### Local design and mobile QA toolkit

| Tool available locally                                                                                 | Use in this plan                                                                                                                                                                                                           | Boundary                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Impeccable** Codex skill (`C:/Users/ADMIN/.agents/skills/impeccable/SKILL.md`)                       | Audit and refine responsive layout, interaction states, accessibility, and motion on both public and signed-in user pages. Use its design review after UI changes.                                                         | Agent workflow only; do not add it to the frontend bundle.                                                                 |
| **Design Taste Frontend** Codex skill (`C:/Users/ADMIN/.agents/skills/design-taste-frontend/SKILL.md`) | Shape the landing page and other public marketing pages while preserving ECHO's existing visual identity.                                                                                                                  | Do not apply its marketing-page rules to task-heavy Settings, Journal, or AI result screens.                               |
| **Webapp Testing** Codex skill (`C:/Users/ADMIN/.codex/skills/webapp-testing/SKILL.md`)                | Guide local browser inspection, interaction checks, screenshots, and console/network diagnosis when implementing the remaining user flows.                                                                                 | Browser evidence complements, but does not replace, real-device acceptance.                                                |
| `@playwright/test` and `@axe-core/playwright`                                                          | Run the checked-in mobile Chromium/WebKit suite and automated accessibility checks. The packages are frontend development dependencies in `frontend/package.json`; device projects are in `frontend/playwright.config.ts`. | Automated scans cannot establish full accessibility conformance or verify authenticated flows without a safe test account. |

These tools are already present locally. Invoke the relevant Codex skill during implementation and extend the existing Playwright tests as each user-facing flow is completed. No additional production UI library is required by this plan; reuse the app's current components and design tokens.

For quality criteria, use [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) for product quality, [ISO 9241-210:2019](https://www.iso.org/standard/77520.html) for human-centred iteration, [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) for security governance, and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for measurable accessibility checks. A responsive interface or automated audit does not prove certification or conformance.

### Required phone behavior

- Core tasks have visible labels, clear page context, a reliable back path, and no hover-only action.
- Touch controls have comfortable target areas and enough separation; text remains readable at 320 px and 200% zoom.
- Navigation, forms, overlays, and alerts work with keyboard and screen reader as well as touch.
- Loading, empty, success, and failure states say what happened and what the user can do next.
- Motion explains hierarchy or state changes, respects reduced-motion preference, and never delays crisis actions.
- No page has unintended horizontal viewport overflow; intentional carousels identify their controls and current position.
- A request failure does not discard a draft, form input, selected files, or unsent message without an explicit warning.

## 2. Current user-side route inventory

| Area                       | Routes and current source                                               | Mobile decision                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Landing                    | `/`, `features/landing/view/landing-view.tsx`, landing components       | Keep the brand world; compact the narrow hero and test every CTA, anchor, carousel/tab, and footer link.                          |
| Public information         | `/about`, `/privacy-policy`, `/terms`, `features/public-content/*`      | Keep readable single-column composition and complete access from the mobile menu/footer.                                          |
| Public support             | `/crisis`, `/crisis-help`, `/support/find-help`                         | Emergency contacts must bypass any intro or loading gate; directory failures must not hide urgent actions.                        |
| Authentication             | `/login`, `/signup`, password recovery routes                           | Make form labels, validation, error recovery, keyboard behavior, and long legal copy usable on phones.                            |
| User shell                 | `shared/components/layout/app-shell.tsx`, `config/navigation.config.ts` | Add clear page location, notification access, discoverable destinations, and accessible drawer behavior.                          |
| Dashboard and Calendar     | `/dashboard`, `/calendar`                                               | Keep summaries and dates legible; open relevant entry or appointment in one clear action.                                         |
| Journal                    | `/journal`, `/journal/new`, `/journal/drafts`, `/journal/[id]`          | Make history → draft → editor → full page a direct phone flow; keep photos bounded and recoverable.                               |
| Buddy                      | `/buddy`, `/buddy/history`                                              | Preserve new/continue chat, history-off behavior, and draft on failed send.                                                       |
| Insights and Body/facial   | `/insights`, `/insights/emotion`, `/insights/risk`, `/insights/facial`  | State the source and availability of each result; handle camera permission and missing analysis.                                  |
| Grounding                  | `/tools/grounding`                                                      | Keep controls easy to tap and timer state clear after backgrounding.                                                              |
| User professional support  | `/professional-support/*`                                               | User request, messages, appointment, Calendar, and history must connect on a phone. Practitioner and admin surfaces are excluded. |
| Settings and notifications | `/settings/*`, `shared/components/navigation/notification-bell.tsx`     | Replace hidden section hunting; expose in-app notifications on phones and label unsupported delivery honestly.                    |

**Confirmed source findings and fixes:** `/journal` uses `journal-notebook-view.tsx`; its phone list now links to the full entry instead of stacking a selected preview below. The Journal editor still states that selected photos are not included in the text draft. The phone `AppShell` now exposes `NotificationBell` for signed-in users and mounts only the active viewport's bell, and Settings now offers a seven-section phone index instead of requiring a hidden horizontal row. Privacy and Notifications save retries preserve edited form state. The disposable-account browser smoke verified the core navigation and Journal journey; remaining route-specific acceptance is tracked above.

## 3. Public pages: changes made and remaining checks

### Implemented locally in this pass

1. Added `@playwright/test` and `@axe-core/playwright` as frontend development dependencies, installed Chromium and WebKit browser binaries, and added `frontend/playwright.config.ts` plus `frontend/e2e/public-mobile.spec.ts`. The suite covers 320 px narrow Chromium, mobile Chromium, mobile WebKit, and 768 px tablet. It checks page headings, viewport overflow, public mobile navigation, an automated accessibility scan, and first-viewport landing actions. Test artifacts are ignored by Git.
2. Restricted the first-visit animated intro in `shared/components/branding/echo-intro-gate.tsx` to the desktop landing page. Direct public links and phone/tablet visits render their requested content immediately. `/crisis` keeps its immediate bypass. Desktop landing motion remains available.
3. Rebalanced the narrow landing hero in `features/landing/components/landing-hero.tsx` and `shared/components/ui/arc-gallery-hero-component.tsx`: five compact portrait circles, reduced top space, and fluid title sizing put both actions inside the initial narrow phone viewport while retaining the ECHO visual identity.
4. Added an explicit mobile-menu relationship and Escape/focus return in `shared/components/navigation/echo-marketing-header.tsx`.

### Public-page acceptance before release

| Journey                   | Required manual check                                                                                                                           | Automated coverage                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Landing first visit       | At 320, 390, and 768 px, hero message and actions are readable; no intro blocks a phone; motion completes without hiding text.                  | Route, CTA bounds, overflow, critical axe violations.                                       |
| Features and How it works | Menu anchors land on the correct section; tab controls change content by touch and keyboard; illustrative UI is not mistaken for live data.     | Phone hero/menu anchor and tab interaction assertions added; extend to remaining content actions. |
| About, Privacy, Terms     | Headings and paragraphs reflow; long sections are readable; policies and footer links reach the intended route.                                 | Route and overflow assertions.                                                              |
| Crisis and Find help      | Emergency action appears without intro/sign-in; public resources remain reachable when a directory request fails.                               | Route, overflow, and directory-failure assertions, including visible call actions.           |
| Login and Signup          | Inputs, validation, consent, resend, loading, and errors remain visible above the software keyboard; no form input is lost on a failed request. | Login phone layout/validation, route, and overflow assertions; add full signup/resend and keyboard-flow tests using disposable accounts or safe mocks. |

The browser suite is an emulator check. Real iPhone Safari and Android Chrome still need a final touch, keyboard, and browser-chrome pass. The app's Next.js development build is useful for layout QA but is not a production performance baseline.

### Initial local verification, 2026-10-16

- Public route and navigation suite: initially 57 passed, 3 intentional tablet skips across mobile Chromium, mobile WebKit, 320 px Chromium, and 768 px tablet. The later run in section 7 includes new crisis failure coverage. The suite covers `/`, About, Privacy, Terms, Crisis, Crisis Help, Find Help, Login, Signup, and public Dashboard preview, plus phone CTA alignment, How it works anchor/step navigation, and the About-to-landing path. The automated axe assertion checks critical findings on the landing page; it is not a full accessibility audit.
- Focused shell, top bar, Settings, Journal, and navigation unit tests: 13 passed. Frontend TypeScript check passed. ESLint on the changed files had no errors and three existing warnings in `settings-views.tsx`. The Impeccable detector reported no findings on the updated shell, Settings, and Journal views.
- Visual review: landing screenshots were inspected at 320 px and 1440 px after animations settled. Both phone CTAs are visible in the first 700 px viewport, and the desktop hero retains its existing composition.
- Production build: blocked by the repository's existing `next.config.ts` guard because this local environment lacks production Supabase and public API configuration. Do not replace those values with fake endpoints to claim a release build.
- Not yet verified: authenticated user routes, real physical devices, noncritical accessibility findings, slow/offline requests, and the full signed-in Settings and notification flows. These remain explicit acceptance work in U1–U6 below.

### Follow-up implementation and checks, 2026-10-16

- Notification center: added failed-load Retry, Escape and focus return, a focus trap, and phone-height scrolling. Opening a notification closes the panel before navigating.
- Landing refinement: mobile showcase uses a light, readable surface and a static product preview while desktop retains its scroll presentation. Hero actions align at equal width; reflection links have compact mobile rows; How it works displays all five steps without a sideways tab rail. Landing fragment navigation now reaches the section consistently from the hero, mobile menu, direct URL, and About. The public header stays fixed during the content entrance animation. Mobile WebKit screenshots are saved alongside the workspace for visual review.
- Settings: clarified that reminder, push, email, and future lock-screen masking choices save preferences but currently do not deliver device or email alerts. Onboarding uses the same wording.
- Journal: retry after a partial photo upload skips photo IDs that already succeeded in the active editor session.
- Dashboard and Distress Insights: removed a displayed 0–100 score derived from risk-band position; show reported bands and source labels. Simulated results are labeled and do not offer a Buddy handoff.
- Frontend unit suite: 113 files and 503 tests passed earlier in this implementation pass; focused landing/provider/About tests (8) passed after the landing refinement. Frontend typecheck and lint passed. Public mobile browser suite: 57 passed, 3 intentional tablet skips across mobile Chromium, mobile WebKit, narrow Chromium, and tablet. The Impeccable detector returned no findings for changed UI targets.
- Signed-in phone smoke passed with a disposable account on 320px Chromium and iPhone WebKit: password login, Settings index → Privacy → back → Notifications, truthful delivery copy, notification panel and Escape close, app menu → Journal, and no Journal viewport overflow. The optional live-script flag is `ECHO_UI_SMOKE=1`; it requires the local frontend on port 3000. This is browser emulation, not a physical-device check.
- Linked-project API smoke script passed on 2026-10-16 with disposable accounts: current onboarding and policy access, unauthenticated/invalid-request rejection, CORS, two-user row isolation and immutable consent, Settings requests, Journal draft/create/read/list/delete, Dashboard, Insights, Grounding history, verified support directory, verification submission, and the unverified Buddy access gate. The script reported removal of its temporary users and test data. It now uses the current policy flow and preserves the MFA requirement for admin review. Approved Buddy, practitioner messaging and appointments, full signed-in feature journeys, physical devices, and accessibility review remain unverified.

## 4. Remaining signed-in user work packages

### A0 — Login, auth abuse controls, and mobile motion (P0)

**Files:** `frontend/src/features/authentication/view/login-view.tsx`, `view-model/use-login-view-model.ts`, `frontend/src/services/authentication/auth.supabase-adapter.ts`, `frontend/e2e/public-mobile.spec.ts`, `backend/tests/e2e/live-integration.mjs`, `supabase/config.toml`, `backend/src/features/registration/registration.routes.ts`, and motion styles/tests.

**Security boundary:** The login form calls `client.auth.signInWithPassword` or `signInWithOtp` using structured SDK arguments. It neither builds SQL nor queries a table to authenticate. Keep that boundary: do not interpolate email or password into SQL, and do not strip SQL-looking characters from a valid password. Client-side email validation and the OTP resend cooldown improve usability but are not abuse controls. Local Supabase Auth config has 30 sign-in/sign-up and 30 token-verification requests per IP per five minutes; its separate email-send setting is 2/hour and explicitly depends on SMTP. Express registration has 12 requests/minute and a 120/minute API-wide limit. The Express stores are process-local, while direct Supabase Auth calls bypass Express entirely. Confirm the hosted project's effective limits and CAPTCHA settings through provider configuration and a safe staging test before public release; this repository file alone does not prove hosted enforcement. A distributed edge/provider control is required if multiple app instances or higher attack volume make the current limits insufficient.

**Mobile and motion acceptance:** At 320 and 390 px, users can switch between email code and password, reach Forgot password and Google sign-in, see validation and rate-limit errors, and retry a failed network request without losing input. The form remains readable with the software keyboard, zoom, and long error copy. Normal app page motion should run on navigation; Reduced Motion should remove spatial movement while keeping content and feedback visible. The user's Full Motion override should restore it. Complete physical Safari/Chrome and legitimate-account sign-in tests before calling authentication release-ready.

### U1 — Shared phone navigation and notification entry (P0)

**Files:** `frontend/src/shared/components/layout/app-shell.tsx`, `frontend/src/shared/components/navigation/app-topbar.tsx`, `frontend/src/shared/components/navigation/notification-bell.tsx`, `frontend/src/config/navigation.config.ts`, focused tests.

**Implement:** Use a labeled phone header with page title, menu, and notification trigger. Choose a small primary destination set using the existing navigation model; show all other user features in an explicit full menu. Keep Crisis support immediately reachable. Add `aria-expanded`, `aria-controls`, accessible icon names, focus entry/restoration, Escape close, background blocking while the drawer is open, and close-on-navigation for every link. Account for safe areas and the software keyboard. Do not show protected or practitioner-only destinations to an ineligible user.

**Acceptance:** From Dashboard, Journal, Buddy, Insights, and Settings, a phone user can find every other user feature without guessing an icon. The notification count and inbox are available on every standard signed-in page. The drawer cannot trap or lose focus and leaves no overlay after navigation. At 320 px, no navigation label is clipped.

### U2 — Settings as a phone-friendly control center (P0)

**Files:** `frontend/src/features/settings/components/settings-shell.tsx`, `frontend/src/features/settings/view/settings-views.tsx`, settings view models/services, Settings route pages, focused tests.

**Implement:** Replace the phone's hidden horizontal section row with a Settings index listing Profile, Verification, Privacy, Notifications, Trusted contacts, Security, and Data & account. Keep existing URLs and desktop behavior. Each section needs a clear back path, accurate current state, save feedback, failure recovery, and confirmation for destructive actions. Audit every control against its existing request and observable effect. Where push, email, reminder, or masked-alert behavior is not available, show that status honestly rather than a successful-looking preference alone. Keep the previously requested 30-minute inactivity sign-out behavior visible and testable in Security.

**Acceptance:** A person can find every section without horizontal swiping. A save survives reload; a failed save preserves input and provides Retry. Each label states what the app truly does. Export/deletion states align with the published privacy notice. Tests cover keyboard focus, zoom, and long translated or user-entered values.

### U3 — Journal library, draft, editor, photos, and reading (P1)

**Files:** `frontend/src/features/journal/view/journal-notebook-view.tsx`, `journal-editor-view.tsx`, `journal-drafts-view.tsx`, `journal-detail-view.tsx`, `components/journal-photo-stack.tsx`, view models/services and focused tests.

**Implement:** On phones, an entry tap should open its full page rather than changing a preview far below the list. Keep a prominent New reflection action and Continue draft card, visible search/filter state, clear pagination, and meaningful empty/error states. Preserve the square Polaroid crop for high-resolution photos without distortion. Decide the photo-draft contract with the data owner before UI promises persistence: either recover private pending attachments, or explicitly confirm they will be lost on leaving and keep the finish action in reach. Do not create a client-only photo state that claims to be saved server-side.

**Acceptance:** Create → leave → resume → publish → open → reload works on a phone. Photos display in bounded square frames; upload failure does not lose written text; ownership errors are handled. Search and mood filters can be cleared in one action. The reading page has no nested scrolling trap.

### U4 — Dashboard, Calendar, Insights, and Body/facial (P1)

**Files:** `frontend/src/features/dashboard/*`, `frontend/src/features/insights/*`, Calendar views/services, shared chart/media components, focused tests.

**Implement:** Rank the primary action and saved information above decoration on phones. Keep charts readable without horizontal page overflow; provide text summaries or accessible data descriptions. Distinguish saved mood/check-in data from unavailable AI analysis. Present analysis status and result fields through the existing authenticated service adapters and shared contracts, without connecting a model from the browser or changing the submission flow. Facial capture must show consent, camera permission, capture progress, denial, and unavailable result states accurately. Calendar items and accepted appointments must appear on the user's local date and link to the relevant entry or request.

**Acceptance:** A user can explain what each displayed value comes from, open its source, and recover from camera or API denial. Pending, failed, simulated, and unavailable analysis remain distinct from completed validated results. No unavailable analysis is shown as a low-risk score. Charts remain understandable at 320 px and to screen reader users. Section 5 defines the integration handoff without prescribing model behavior.

### U5 — Buddy, Grounding, Find help, and Crisis support (P1)

**Files:** User-facing Buddy views, `frontend/src/features/grounding/*`, public Find help and Crisis components, focused tests.

**Implement:** Keep Buddy's composer, previous chats, new chat, and history-off state clear at phone size. Failed send must preserve the message draft. Grounding controls should remain reachable while an exercise runs; make pause/resume and backgrounded timer behavior explicit. Find help must distinguish verified public resources from loaded directory results. Crisis support should keep immediate call actions at the top and remain usable if nonessential services fail; avoid entrance motion before urgent actions.

**Acceptance:** Each flow completes by touch and keyboard at 320 and 390 px. A network failure shows recovery without losing user input. Reduced motion does not remove instructions or controls. Crisis actions are available without authentication or intro delay.

### U6 — User professional support and notification journeys (P1)

**Files:** `frontend/src/features/professionals/*` user views, `frontend/src/services/professionals/professional-api.ts`, user Calendar UI, `notification-bell.tsx`, notification service, focused tests.

**Implement:** Connect the user's discovery/request, consent, messages, appointment, Calendar, and history on a phone. Show a clear unavailable/empty state when no reviewed practitioner exists. For notifications, provide a phone-sized inbox with read/unread state, a destination link, and retry feedback. Do not imply that email or push was sent merely because an in-app notification exists. In-app previews may show private details only after authentication; future device-level payloads should be generic by default.

**Acceptance:** A user can follow a message or appointment notification to the owned request, see the appointment on the correct local Calendar date, and return to support history. Failed loads and empty directories are understandable. Full two-account service QA remains a separate dependency before claiming the feature is ready.

## 5. AI analysis integration readiness — handoff only

This section prepares the **user-facing Journal, Dashboard, and Insights surfaces** to consume future validated outputs. It does not select, train, evaluate, deploy, or connect a model; change the order of analysis stages; add a second submission path; or change consent and safety policy. The model implementation and any worker/provider changes are Lloyd's separate work. Keep the present private-save behavior when analysis is not requested or cannot run.

### Existing connection points to preserve

| Boundary        | Current repository contract                                                                                                                                                                                       | User-side integration rule                                                                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request         | Authenticated `POST /journals` and `POST /journals/:journalId/analyze` in `backend/src/features/journals/journals.routes.ts`; the backend checks ownership, analysis eligibility, policy acceptance, and consent. | Keep the existing optional analysis choice. Never turn saving a reflection into mandatory inference or submit a request without explicit user intent.                                                                                                                                   |
| Job progress    | `GET /analysis-jobs/:jobId/status`; `analysisProgressSchema` and `analysisStatuses` in `packages/contracts/src/analysis.ts`; owner-readable `public.analysis_status_projection`.                                  | Render the authoritative job state, including `waiting_for_provider`, `retrying`, `safety_action_required`, `failed`, and `completed`. Reuse the current Realtime plus polling fallback in `analysis-status-experience.tsx`; do not invent progress or infer success from elapsed time. |
| Results         | `GET /journals/:journalId/analyses` and `GET /dashboard/insights`; `journalAnalysisResultSchema` (`echo-journal-analysis-v1`) and `dashboardInsightsSchema` in the shared contracts.                              | Display a result only after the authenticated API returns a validated completed record. Preserve `isSimulated`, `providerName`, `modelVersion`, and optional `null` fields in labels and empty states. Do not derive missing model values in the UI.                                    |
| Facial signal   | `faceMeshCaptureSchema` accepts a versioned 478-landmark/52-blendshape mesh, not image or video; `facialAnalysisStatusSchema` includes `captured_pending_provider` and `unavailable`.                             | Keep capture opt-in, permissions explicit, and the mesh-only privacy boundary. A captured mesh is not a facial inference result. Do not show an emotion or combined result until the API supplies one.                                                                                  |
| Worker boundary | `LocalWorkerProtocol` and authenticated `/internal/ai/*` routes support health, claim, heartbeat, progress, safety, final result, and failure callbacks with leases and idempotency.                              | The browser never calls worker routes or handles worker credentials. UI changes depend only on the owner-scoped API contracts above.                                                                                                                                                    |

### Integration preparation checklist

1. **Keep one source of truth for UI data.** Map Journal detail, analysis progress, Dashboard, and Insights from the existing frontend service adapters (`frontend/src/services/journal/` and `frontend/src/services/insights/`). Share status and provenance labels where they refer to the same job. A stored mood check-in, a completed PHQ-8 questionnaire, and a journal-derived symptom estimate are separate sources and must not be merged or relabeled as one another.
2. **Render every supported state honestly.** Before a validated provider is available, show the saved journal and existing user-entered data while analysis remains waiting, failed, or unavailable. Keep development fixtures visibly simulated and excluded from real-model claims. An optional facial or sanctuary-perspective field that is absent/null stays unavailable, including when text analysis completes.
3. **Preserve the user's control.** Make analysis consent and facial capture choices readable at phone width; ensure denial, withdrawal, missing camera permission, network failure, and leaving/reopening the page do not erase the saved reflection or turn an unavailable result into a reassuring score. Keep crisis help directly accessible when the existing safety state requires attention.
4. **Validate the handoff contract before integration.** The future worker output must satisfy `journalAnalysisResultSchema`, including schema version, allowed values, distribution totals, provenance, and optional-field semantics. The current `ai-service/app/schemas/analysis_response.py` exposes a narrower `phq8_score` response and `ai-service/app/api/routes/analysis.py` intentionally returns 503. That older FastAPI shape is **not** a drop-in final-result payload. The model integration work must explicitly reconcile or adapt it to the shared contract before any UI claims completion; this plan does not choose that adapter or alter the model output.
5. **Keep the availability boundary truthful.** `AI_ANALYSIS_MODE=disabled` is the default in `backend/.env.example`; `development_stub` is rejected in production, and worker protocol health does not assert model health. A green API/worker health check alone must not enable “AI ready” copy. Availability requires a real validated result through the existing authenticated job path.

**Ready-for-integration acceptance:** With controlled contract fixtures, verify optional private save, accepted analysis request, waiting/retry/failure/safety/completed displays, page reload and resumed status, owner-only result retrieval, no duplicate result on repeated callbacks, simulated provenance, absent facial output, and a completed valid result on 320/390 px plus desktop. Contract tests should reject malformed output and an output that confuses a journal estimate with a completed PHQ-8 questionnaire. These are interface tests, not evidence that a model has been trained or clinically evaluated. A separate model handoff must provide the actual output mapping, model/version metadata, health behavior, evaluation evidence, and failure semantics before release.

## 6. Implementation sequence and files to avoid

1. **Finish public acceptance:** Run all four Playwright projects, inspect the landing/public screenshots at 320/390/768 and desktop, and fix only measured mobile defects. Include reduced motion and menu keyboard behavior.
2. **Shared app shell (U1):** Establish location and navigation once before changing individual signed-in pages.
3. **Settings (U2):** Complete the control-to-request audit, then implement the phone index and honest state labels.
4. **Frequent flows (U3–U5):** Journal first, then Dashboard/Insights, Buddy/Grounding, and public support.
5. **AI user-side readiness (section 5):** Verify existing adapters, status labels, provenance, and missing-result states with contract fixtures. Leave worker and model integration to the separate model work.
6. **Connected flows (U6):** Professional user journey and notification inbox; mark unavailable external delivery honestly.
7. **Final visual and functional QA:** Compare 320, 390, 768, and 1440 px; run automated and real-device checks; review any design change against ECHO's existing tokens and reduced-motion behavior.

Do not modify admin pages, practitioner portal, database records, external services, or unrelated visual assets as part of this user-side plan. Backend/API shortcomings found during UI QA should be recorded as explicit dependencies with the affected control and request, rather than silently worked around in the browser.

## 7. Testing commands and evidence

From the repository root on Windows:

```powershell
npm.cmd run test:e2e:mobile -w frontend
npm.cmd run test -w frontend
npm.cmd run typecheck -w frontend
npm.cmd run lint -w frontend
npm.cmd run build -w frontend
```

The mobile E2E suite uses Playwright's Chromium and WebKit emulation and `@axe-core/playwright`. It is located in `frontend/e2e/public-mobile.spec.ts`; `frontend/playwright.config.ts` defines the device projects. Add signed-in journey tests only with a disposable account fixture or approved mock boundary, and keep credentials out of the repository and screenshots.

### Latest local verification, 2026-10-17

| Area | Result | Limit |
| --- | --- | --- |
| Frontend unit/component suite | 113 files and 509 tests passed. Focused Journal concurrent draft-save, photo-navigation, Grounding recovery, and appointment reload tests passed after their final edits. | Component tests use mocked services and do not prove every live account flow. |
| Frontend typecheck and lint | Typecheck passed; ESLint reported no errors and existing warnings. | A production build was not run while the user's development server was active. |
| Public mobile browser suite | 68 passed and 4 phone-only checks intentionally skipped on tablet. Chromium phone, WebKit phone, 320 px, and 768 px routes were exercised; login controls remained readable, landing motion respected Reduced Motion and Full Motion, and directory failure left crisis call actions visible. | Emulators do not replace physical Safari/Chrome, complete accessibility review, or slow-network checks. |
| Login auth behavior | 31 focused adapter/view-model/view tests passed; typecheck and targeted lint passed. Rate-limit errors, rejected network requests, duplicate submit prevention, and mobile layout were checked. | Hosted Auth rate limits, Google login, and actual email delivery are provider/device acceptance items. |
| Signed-in Journeys | Disposable-account API checks passed for onboarding, Settings actions, Journal CRUD/drafts, Dashboard, Insights, Grounding history, support directory, and access isolation. All seven Settings sections opened on Chromium and WebKit phones. The Journal draft/photo/reload/overview journey and signed-in page animation/reduced-motion behavior passed in 320 px Chromium and iPhone WebKit; test accounts and their data were removed. | Physical devices and the remaining Grounding, approved Buddy, professional two-account, and notification destination browser journeys remain open. |

Record a dated QA table for each route with viewport/browser, visual result, touch/keyboard result, console/network errors, and any unverified behavior. Do not call a route production-ready based only on a passing local browser or unit test. For performance, measure route transitions in a production build; Next.js development compilation is a separate phenomenon. Real-device acceptance should include iPhone Safari and Android Chrome, portrait/landscape, 200% zoom, reduced motion, slow network, and failed requests.

## 8. User-side completion criteria

All public routes load without an unnecessary first-visit gate on phones or direct links. A user can navigate the signed-in app, find Settings and notifications, create and recover a Journal entry, use Buddy and Grounding, understand Insights and support availability, and reach Crisis support quickly. Every visible control either completes its named action or clearly states why it is unavailable. Mobile QA evidence and remaining service dependencies are documented separately; no ISO or production claim follows automatically from this file.
