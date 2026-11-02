# Journal support check-in

## What changed

The journal's right card now places the first callable **active, verified** resource in the server's existing priority order near the top, beside a prominent professional-support option. Soft sage and warm cream replace alert-style presentation. Other verified contacts stay in an expandable section. Loading failures retain professional support and the verified-directory link; contact URLs are validated before rendering, and switching country never displays the previous country's cached contact.

Support appears on the **first** backend safety flag. The additional check-in is a required journal UI step, not a suicide prediction, clinical risk score, diagnosis, or treatment/admission decision. This distinction follows [NICE guidance on risk assessment tools](https://www.nice.org.uk/guidance/ng225/chapter/recommendations#risk-assessment-tools-and-scales).

## Three consecutive submissions

`GET /journal-support/check-in` authenticates the current user and examines their three latest nondeleted saved journals. Each must have analysis consent and its latest nondeleted analysis request must currently be `safety_action_required`. Pending, failed, completed, unprocessed, or nonconsented entries break this sequence. Multiple requests/retries for the same journal never count as extra journals. Private request status stays behind the backend with explicit user and journal filters; no database grants or schemas change.

The invitation requires one support destination before returning to writing:

- **Talk to a professional** → `/professional-support`.
- **Try a grounding exercise** → `/tools/grounding`.
- No skip/close action. Escape and backdrop clicks do not dismiss it. Immediate-support options remain accessible, and users can leave the journal for other app pages.

No one is automatically contacted. Existing professional-request and trusted-contact consent, authorization, and review steps remain intact. Grounding is explicitly optional and is not presented as a substitute for urgent support.

The same or overlapping set of three journals is acknowledged only after a destination has actually mounted and the user confirms readiness on return. Opening or reloading either prompt does not acknowledge it. Three entirely new flagged journals can offer another check-in. This is not a lifetime counter. Acknowledgement never clears a model flag, overrides safety review, or claims the person is now safe.

## Returning to journal

Choosing a support destination records a small account-scoped session marker. It contains only identifiers, a timestamp, destination and completion state—never journal text, model output, or contact details. Version-2 markers expire after 24 hours and clear on logout/sensitive-state reset. Previous optional-flow acknowledgements do not grant readiness in the required flow. Memory-only fallback keeps navigation usable if browser storage is denied; persistence across a hard reload then cannot be guaranteed.

Once the selected destination page has mounted, the next journal visit shows a welcome explaining what actually happened:

- A finished grounding timer: acknowledges the practice without claiming improved mood or safety.
- A confirmed successful professional request: acknowledges submission and explains that responses may take time. It does not claim appointment acceptance or admission.
- Simply exploring either destination: acknowledges the visit without claiming completion or submission.

**I'm ready to write** is disabled until the user selects **I feel ready to continue writing. I can pause or return to support at any time.** The welcome cannot be closed with Escape, a close button, or the backdrop; it remains after reload until acknowledgement. Another grounding pause remains available. This is writing readiness, not a declaration of being clinically well or safe. Each completion is bound to a unique visit token, so a delayed response from an older visit/account cannot mark a later visit complete. The previous analysis overlay is minimized during deliberate navigation to support or grounding.

## Motion and accessibility

The invitation uses unfolding orbital linework, a leaf emblem, staggered reveals and a single button sheen. Effects are finite, use transform/opacity where possible, and respect reduced motion. The shared dialog retains focus management and accessible naming. A new opt-in nondismissible mode is used only for this required workflow; ordinary app dialogs retain their normal dismissal behavior. Journal children are inert during the bounded state check and required prompts, preventing interaction behind them. Priority actions have visible focus states and responsive layouts. No model settings, weights, or existing journal/dashboard/insights layouts were replaced.

## Verification performed, 2026-11-02

- 145 affected frontend tests passed, including journal saving/progress, support-panel failures, expiry, logout, account isolation, overlapping windows, stale responses, grounding completion, and successful/failed professional submissions.
- 71 backend tests passed across journal regressions and the added duplicate-job/latest-status check. Anonymous access to the new endpoint returned HTTP 401.
- Frontend/backend type checks, targeted lint, and the production frontend build passed.
- Actual signed-in browser test created a clearly fictional normal journal followed by three clearly fictional flagged journals through the UI and the real installed model pipeline. Eligibility was **false, false, false, true** respectively. The first flag already displayed priority support; the third opened the invitation.
- Verified priority contact presentation, professional-support navigation, truthful return after browsing, dismiss/reload suppression, 390px mobile layout, reduced motion and ready-to-write acknowledgement. The completed-exercise return was tested with an accelerated browser clock and a mocked practice-save response; no practice record was created. Professional submission success/failure completion was tested using mocked API responses, not by sending a real request.
- No professional/trusted contact was notified. All four test journals were removed using their exact newly created IDs and matching fictional titles. An existing user draft is preserved by the test.
- No page errors were recorded on the successful browser run. Private screenshots and detailed evidence remain ignored under `artifacts/model-integration/support-checkin-20261102/`.

Repeat with the app/models already running and credentials for an intended development test account:

```powershell
node frontend/scripts/check-journal-support.cjs
```

Set `ECHO_TEST_EMAIL` and `ECHO_TEST_PASSWORD` first. The script creates and then removes four fictional test journals and respects existing rate/admission limits. It does not change privacy consent. If an existing draft is present, it preserves that draft and submits the test journals through the authenticated API instead of overwriting the editor. Do not run multiple copies concurrently.

The rule is a product check-in, not independently validated clinical triage. Model flags can be imperfect; immediate support remains available without this invitation. These changes have been verified locally and are included on the review branch.


## Dashboard startup correction

The global analysis gateway no longer restores saved journal progress from browser storage when the app opens. It never automatically opens an analysis/support overlay on Dashboard, and it does not carry inline journal submissions onto other pages. A live overlay on another route is tied to that route and is discarded on navigation or logout. Saved journals, model flags and manual support access are unchanged.

Regression verification: 22 gateway/current-analysis/support-journey tests, frontend type check and targeted lint passed. An actual browser was seeded with an existing genuinely flagged journal's saved submission; dashboard opening and reload produced neither a support overlay nor historical status polling. Journal-to-dashboard navigation also stayed clear, and reopening the flagged journal still displayed its inline priority support. No journal or flag was changed. Private evidence: `artifacts/model-integration/support-checkin-20261102/dashboard-replay-verification.json`.


## Required-choice follow-up verification

- The contact disclosure now has a visible Show/Hide pill and rotating chevron, using the native details/summary expanded state.
- 140 affected frontend tests passed; type check, targeted lint and production build passed.
- Browser verification used real authentication and actual professional/grounding routes with controlled qualifying-episode API fixtures. No new journal, practice or professional-request record was created for this follow-up. The backend model eligibility calculation was unchanged and had already been tested through actual model flags in the earlier run.
- Verified no close/skip control; Escape/backdrop/reload cannot dismiss the qualifying prompt. Journal controls remain inert. Navigating to Dashboard stays clear of the prompt; returning to Journal still requires the choice.
- Both actual destination pages record arrival. Reloading before readiness preserves the welcome and leaves Continue disabled until the checkbox is selected. Acknowledgement clears only the visit/presentation state, never the model flag. Verified contact Show/Hide, mobile layout and no browser page errors.
- Private screenshots and machine-readable follow-up evidence are `required-choice.png`, `required-readiness.png`, `required-choice-mobile.png`, `required-readiness-mobile.png`, `expanded-contacts.png` and `required-choice-verification.json` under the existing ignored support-checkin evidence folder.

This is an app UI workflow, not a server authorization or clinical-clearance mechanism. Unknown/unavailable eligibility data does not invent a restriction; urgent help and other app routes remain available. Session storage restrictions can limit persistence across a full browser restart. These changes are included on the review branch; no production deployment was performed.
