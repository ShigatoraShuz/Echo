# ECHO Full Frontend UI Enhancement and MVVM Refactor

You are a senior frontend architect, React engineer, UI/UX designer, accessibility specialist, and mental-health product designer.

Your task is to fully enhance and refactor the existing **ECHO mental wellness web application** into a polished, consistent, responsive, accessible, production-ready frontend.

The application uses:

* Next.js 15 App Router
* React 19
* TypeScript
* Tailwind CSS
* Lucide React
* React Bits
* Existing ECHO theme system
* Existing frontend routes and components

The backend directory is currently empty. Do not invent a fake production backend. Build the frontend so it is fully backend-ready through typed service interfaces and adapters.

---

# 1. Product overview

ECHO is a privacy-first mental wellness companion application that provides:

* Private journaling
* Mood and emotion tracking
* Reflective AI Buddy conversations
* Grounding exercises
* Emotion insights
* Facial-expression insights
* Risk and wellbeing signals
* Crisis-help resources
* Trusted-contact management
* Privacy and security controls
* Data export
* Notification preferences
* Onboarding and consent management

ECHO is not a diagnostic or medical application.

The interface must communicate that all results are:

* Non-diagnostic
* Reflective
* Informational
* Intended to support self-awareness
* Not a substitute for licensed professional care

Crisis resources must remain visible and accessible at all times.

---

# 2. Primary objective

Transform the current frontend into a complete, polished application that:

1. Uses a strict feature-based MVVM architecture.
2. Uses React Bits selectively for premium visual interactions.
3. Preserves every existing route.
4. Makes every frontend feature interactive and complete.
5. Removes inconsistent page designs and duplicated styling.
6. Uses reusable components and centralized design tokens.
7. Supports mobile, tablet, laptop, and large desktop layouts.
8. Supports light, dark, and system appearance modes.
9. Respects reduced-motion preferences.
10. Is ready to connect to a real FastAPI and Supabase backend.
11. Passes linting, type checking, and production build.
12. Contains no broken routes, placeholder buttons, or dead controls.

Do not only redesign the landing page. Apply a unified design system to the entire application.

---

# 3. Existing routes

Preserve and improve all existing routes:

```text
/
about
login
signup
forgot-password
reset-password
privacy-policy
terms

/onboarding/consent
/onboarding/profile
/onboarding/setup

/dashboard

/journal
/journal/new
/journal/[id]

/buddy
/buddy/history

/insights/emotion
/insights/facial
/insights/risk

/crisis
/crisis-help
/support/find-help

/settings/profile
/settings/privacy
/settings/security
/settings/notifications
/settings/export
/settings/trusted-contacts

/tools/grounding

/design-system
```

Do not remove or rename routes unless an existing route is clearly duplicated. If duplicate crisis routes exist, preserve compatibility by redirecting one route to the canonical page.

---

# 4. Required architecture

Refactor the frontend into a feature-based MVVM architecture.

Use this structure as the baseline:

```text
frontend/src/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── (onboarding)/
│   ├── (protected)/
│   ├── crisis/
│   ├── crisis-help/
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   └── globals.css
│
├── features/
│   ├── authentication/
│   │   ├── model/
│   │   ├── view-model/
│   │   ├── view/
│   │   ├── components/
│   │   └── services/
│   ├── onboarding/
│   ├── dashboard/
│   ├── journal/
│   ├── buddy/
│   ├── mood/
│   ├── insights/
│   ├── facial-analysis/
│   ├── risk-support/
│   ├── grounding/
│   ├── crisis-support/
│   ├── settings/
│   ├── trusted-contacts/
│   ├── notifications/
│   └── data-export/
│
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── feedback/
│   │   ├── forms/
│   │   ├── data-display/
│   │   └── react-bits/
│   ├── hooks/
│   ├── services/
│   ├── validation/
│   ├── constants/
│   ├── types/
│   ├── utils/
│   └── accessibility/
│
├── config/
│   ├── navigation.config.ts
│   ├── theme.config.ts
│   ├── motion.config.ts
│   ├── feature-flags.config.ts
│   └── environment.ts
│
└── styles/
    ├── tokens.css
    ├── motion.css
    └── accessibility.css
```

The exact structure may be adapted when necessary, but feature isolation and MVVM separation are mandatory.

---

# 5. MVVM responsibilities

## Model

Models must contain:

* TypeScript interfaces
* Domain types
* Enums
* Zod validation schemas
* Domain constants
* API response types
* Mapping and transformation functions

Models must not contain JSX.

Example domains:

* User profile
* Consent
* Journal entry
* Mood check-in
* Emotion score
* Buddy conversation
* Buddy message
* Risk signal
* Trusted contact
* Notification preference
* Export request

## ViewModel

ViewModels must manage:

* UI state
* Loading states
* Error states
* Empty states
* Form validation
* Service calls
* Data transformation
* Filtering
* Sorting
* Searching
* Pagination
* Modal state
* User actions
* Route transitions
* Optimistic updates where appropriate

Use custom hooks such as:

```text
useLoginViewModel
useSignupViewModel
useDashboardViewModel
useJournalListViewModel
useJournalEditorViewModel
useBuddyViewModel
useEmotionInsightsViewModel
useFacialInsightsViewModel
useRiskInsightsViewModel
useGroundingViewModel
useProfileSettingsViewModel
usePrivacySettingsViewModel
```

Do not place business logic inside page files or large View components.

## View

Views must:

* Render UI
* Receive state and handlers from ViewModels
* Compose reusable components
* Display loading, empty, error, and success states
* Remain focused on presentation

Views must not:

* Call APIs directly
* Read environment variables
* Access Supabase directly
* Contain database logic
* Transform raw API payloads
* Contain complex business rules

## Service layer

All data access must go through typed services.

Create services such as:

```text
auth.service.ts
profile.service.ts
journal.service.ts
mood.service.ts
buddy.service.ts
insights.service.ts
facial-analysis.service.ts
risk.service.ts
trusted-contacts.service.ts
notifications.service.ts
export.service.ts
```

Use a shared API client.

The UI must not call `fetch()` directly from page or View components.

---

# 6. Backend-ready service strategy

The backend is currently unavailable.

Implement the frontend using service interfaces that can later connect to FastAPI and Supabase.

Use dependency-friendly adapters:

```text
journal.service.ts
journal.mock-adapter.ts
journal.http-adapter.ts
```

The mock adapter may temporarily provide local development functionality, but it must be isolated from the UI.

Do not import `mock-data.ts` directly into pages or Views.

Use one centralized environment or feature flag to switch between:

* Local development adapter
* Real HTTP adapter

Do not hardcode backend URLs throughout the application.

---

# 7. Design direction

The visual design must feel:

* Calm
* Trustworthy
* Private
* Warm
* Modern
* Soft
* Human
* Emotionally safe
* Non-clinical
* Professional

Avoid:

* Generic SaaS dashboard styling
* Excessive gradients
* Neon cyberpunk effects
* Aggressive warning colors
* Dense medical dashboards
* Overly playful cartoon styling
* Excessive glassmorphism
* Constant background movement
* Overwhelming particle effects
* Decorative animation on crisis pages
* Emojis as primary interface icons

Use Lucide icons consistently.

---

# 8. Design system

Create a complete ECHO design system using reusable semantic tokens.

Include:

* Brand colors
* Neutral colors
* Surface colors
* Text colors
* Border colors
* Focus-ring colors
* Success states
* Warning states
* Risk states
* Crisis states
* Mood colors
* Emotion colors
* Typography scale
* Spacing scale
* Border-radius scale
* Shadow scale
* Container widths
* Motion durations
* Motion easing
* Z-index layers

Do not scatter raw color values across components.

Use semantic names such as:

```text
background
surface
surface-muted
foreground
foreground-muted
primary
primary-foreground
border
focus
success
warning
risk-low
risk-moderate
risk-elevated
crisis
mood-calm
mood-joy
mood-sadness
mood-anxiety
```

Maintain full compatibility with the existing theme provider.

---

# 9. React Bits integration

Use React Bits to improve selected experiences, but do not apply animation blindly.

Create internal ECHO wrappers inside:

```text
shared/components/react-bits/
```

Examples:

* EchoReveal
* EchoFade
* EchoBlurText
* EchoCountUp
* EchoSpotlightCard
* EchoAnimatedList
* EchoBackground
* EchoStepTransition
* EchoTextTransition
* EchoBreathingVisual

Pages must import the ECHO wrappers instead of importing copied React Bits components directly.

Each wrapper must:

* Use TypeScript
* Support className
* Respect reduced motion
* Work in light and dark themes
* Avoid hydration problems
* Avoid layout shifts
* Avoid excessive JavaScript
* Provide a static fallback
* Work on mobile devices

Recommended use:

### Landing page

* Gentle text reveal
* Subtle aurora or gradient background
* Spotlight feature cards
* Animated trust statistics
* Soft section transitions

### Authentication

* Gentle form entrance
* Calm illustration or visual surface
* Password-strength feedback
* Clear validation transitions

### Onboarding

* Animated step progress
* Smooth content transitions
* Consent-card feedback
* Mood-selection feedback

### Dashboard

* Staggered dashboard cards
* Count-up summaries
* Gentle mood visualization
* Recent-activity transitions

### Journal

* Minimal list entrance
* Smooth filtering
* Calm empty state
* No distracting animation while writing

### Buddy

* Message entrance
* Typing indicator
* Smooth conversation loading
* Scroll-to-latest behavior
* Reduced-motion fallback

### Insights

* Animated charts
* Count-up percentages
* Smooth tab transitions
* Clear explanations

### Grounding tools

* Guided breathing animation
* Sensory grounding steps
* Timer progress
* Pause, resume, and reset controls

### Crisis and risk pages

Use little or no decorative motion.

Information must remain direct, stable, readable, and accessible.

---

# 10. Application shells

Create consistent shells for:

* Public pages
* Authentication pages
* Onboarding
* Protected application pages
* Settings pages
* Crisis-support pages

The protected shell should include:

* Desktop sidebar
* Mobile bottom navigation or mobile drawer
* Page header
* User menu
* Theme control
* Sync or connection status
* Always-accessible crisis-help action
* Responsive main-content container

Navigation must clearly identify the current route.

---

# 11. Landing page requirements

Redesign the landing page with:

* Strong hero section
* Clear privacy-first message
* Main calls to action
* Product preview
* Feature overview
* How ECHO works
* Privacy and trust section
* Non-diagnostic disclaimer
* Crisis-support visibility
* Testimonials or illustrative use cases without fabricated medical claims
* Final call to action
* Professional footer

Suggested calls to action:

* Start Journaling
* Meet Your Buddy
* Explore Grounding Tools
* Learn About Privacy

Do not make unsupported claims such as:

* Prevents suicide
* Diagnoses depression
* Replaces therapy
* Guarantees emotional improvement

---

# 12. Authentication features

Implement complete frontend behavior for:

## Login

* Email
* Password
* Show or hide password
* Remember-session option
* Validation
* Loading state
* Error state
* Forgot-password link
* Signup link

## Signup

* Name
* Email
* Password
* Confirm password
* Password-strength feedback
* Terms acceptance
* Privacy acknowledgement
* Validation
* Loading and success states

## Forgot password

* Email form
* Validation
* Confirmation state
* Resend behavior

## Reset password

* New password
* Confirm password
* Strength requirements
* Invalid or expired-link state
* Success state

Do not use nonfunctional social-login buttons unless a real provider interface exists.

---

# 13. Onboarding features

Create a complete three-step onboarding journey.

## Consent

Include:

* Privacy explanation
* Data-use explanation
* AI limitations
* Facial-analysis opt-in
* Journal-analysis consent
* Crisis-resource acknowledgement
* Clear required and optional choices

## Profile

Include:

* Preferred name
* Age range if needed
* Goals
* Preferred Buddy tone
* Notification preference
* Optional timezone

Do not collect unnecessary sensitive information.

## Setup

Include:

* Theme selection
* Reminder preferences
* Privacy defaults
* Trusted-contact introduction
* First mood check-in
* Completion summary

Include progress indicators, back navigation, validation, and save states.

---

# 14. Dashboard features

Build a personalized dashboard with:

* Greeting
* Current date
* Mood check-in
* Quick journal action
* Talk to Buddy action
* Recent journal entries
* Mood trend summary
* Emotion summary
* Recent grounding activity
* Privacy or sync status
* Insight disclaimer
* Crisis-help shortcut

Include:

* Loading skeleton
* Empty state
* Error state
* Partial-data state
* Responsive card layout

Avoid showing fabricated clinical scores.

---

# 15. Journal features

Implement:

* Journal list
* Search
* Mood filtering
* Date filtering
* Sorting
* Pagination or load-more behavior
* Empty state
* Create entry
* Edit entry
* Delete confirmation
* Draft saving
* Autosave indicator
* Word count
* Character count
* Mood selection
* Emotion tags
* Privacy status
* Analysis consent
* View analysis result
* Export individual entry

The editor must be distraction-free.

Do not use heavy animations inside the writing experience.

The journal detail page must show:

* Entry content
* Date
* Mood
* Emotion analysis
* Reflective insights
* Risk-support notice when appropriate
* Edit and delete actions

---

# 16. Buddy features

Implement a complete reflective conversation interface.

Include:

* Conversation list
* New conversation
* Rename conversation
* Delete conversation
* Search conversation history
* Message input
* Send button
* Enter-to-send behavior
* Multiline input
* Typing indicator
* Streaming-ready UI
* Retry message
* Copy response
* Feedback action
* Grounding suggestion cards
* Conversation disclaimer
* Crisis-resource escalation card
* Empty state
* Error state
* Offline or unavailable state

Buddy responses must be positioned as reflective support, not medical treatment.

Do not claim that Buddy is a therapist.

---

# 17. Emotion insights

Build:

* Emotion overview
* Time-range controls
* Emotion trend chart
* Emotion distribution
* Journal-source breakdown
* Most frequent emotions
* Positive and difficult emotion balance
* Explanations in plain language
* Empty state
* Privacy notice

Support the ECHO emotion system:

* Anger
* Anticipation
* Disgust
* Fear
* Joy
* Sadness
* Surprise
* Trust

Charts must be responsive and accessible.

Do not rely on color alone. Include labels and readable values.

---

# 18. Facial insights

Build the facial-analysis experience as explicit opt-in.

Include:

* Camera permission explanation
* Privacy-first processing explanation
* Start-camera action
* Stop-camera action
* Permission-denied state
* Camera-unavailable state
* Analysis-in-progress state
* Result state
* Retake action
* Delete-result action
* Opt-out action

Clearly explain:

* Camera use is optional
* Facial results are non-diagnostic
* Raw video should not be uploaded by default
* Only permitted aggregate results should be stored
* Users can disable the feature

Do not simulate camera permission or claim that analysis occurred when it did not.

---

# 19. Risk and wellbeing insights

Build a careful, non-alarming interface.

Include:

* Current wellbeing signal
* Recent changes
* Supporting factors
* Clear uncertainty language
* Explanation of how the signal is generated
* Recommended next steps
* Talk to Buddy
* Use grounding tool
* Contact trusted person
* Find professional help
* Access crisis resources

Avoid labels such as:

* Diagnosed
* Clinically depressed
* Suicidal person
* Mentally unstable

Use wording such as:

* Elevated distress signal
* Difficult emotional pattern
* Increased support may be helpful
* Consider speaking with someone you trust

---

# 20. Crisis support

The crisis-support experience must always be reachable.

Include:

* Immediate-help heading
* Emergency-service guidance
* Hotline or support-resource section
* Contact trusted person
* Find local professional help
* Grounding action
* Safety-focused language
* Clear exit and navigation options

Do not hide crisis resources behind multiple clicks.

Do not use decorative animated backgrounds, confetti, or dramatic motion.

Do not fabricate country-specific hotline numbers in source code. Use a configurable resource layer.

---

# 21. Grounding tools

Implement interactive grounding exercises such as:

* Box breathing
* 4-7-8 breathing
* 5-4-3-2-1 sensory grounding
* Short body scan
* Calm countdown
* Name five things
* Short reflective prompt

Each exercise should include:

* Instructions
* Start
* Pause
* Resume
* Restart
* Exit
* Timer or progress
* Reduced-motion mode
* Audio toggle only if real audio assets exist
* Completion state
* Save-completion preference

---

# 22. Settings

## Profile

* Preferred name
* Avatar placeholder or upload-ready interface
* Personal goals
* Buddy tone
* Timezone
* Save and cancel states

## Privacy

* Journal-analysis consent
* Facial-analysis opt-in
* Data-sharing controls
* Local-device preference
* Analytics preference
* Privacy summary
* Delete-data entry point

## Security

* Change password
* Active-session list
* Logout other sessions
* Two-factor-authentication readiness
* Security alerts
* Login activity placeholder only through service interfaces

## Notifications

* Journal reminders
* Mood reminders
* Grounding reminders
* Buddy follow-up
* Security notifications
* Quiet hours
* Browser-notification permission state

## Export

* Select export format
* Select data categories
* Request export
* Export status
* Download-ready state
* Failure state
* Privacy warning

## Trusted contacts

* Add contact
* Edit contact
* Remove contact
* Relationship
* Preferred contact method
* Consent acknowledgement
* Emergency-use explanation
* Empty state

---

# 23. Shared frontend states

Every feature must support:

* Initial loading
* Skeleton loading
* Empty state
* Error state
* Retry state
* Offline state where applicable
* Success feedback
* Disabled state
* Permission-denied state where applicable
* No-results state
* Confirmation dialogs for destructive actions

Do not leave buttons that do nothing.

---

# 24. Forms and validation

Use React Hook Form and Zod when available or install them if appropriate.

Forms must include:

* Inline validation
* Accessible error messages
* Required-field indicators
* Loading state
* Prevented double submission
* Unsaved-change warning where necessary
* Success confirmation
* Server-error mapping support

Do not use browser alerts.

Use accessible dialogs, sheets, toasts, and inline messages.

---

# 25. Accessibility

Meet WCAG-oriented frontend requirements.

Ensure:

* Full keyboard navigation
* Visible focus states
* Proper heading hierarchy
* Semantic landmarks
* Form labels
* Screen-reader descriptions
* Accessible dialogs
* Accessible charts
* Sufficient color contrast
* Skip-to-content link
* Reduced-motion support
* No interaction requiring only hover
* Touch targets of adequate size
* No information communicated only through color
* Crisis resources accessible without animation

Add a global reduced-motion strategy.

---

# 26. Responsive behavior

Support:

* Small mobile
* Standard mobile
* Tablet
* Laptop
* Desktop
* Large desktop

Requirements:

* No horizontal overflow
* No clipped cards
* No unusable fixed heights
* Mobile-friendly forms
* Responsive charts
* Collapsible navigation
* Accessible mobile menus
* Sticky actions only when they do not hide content
* Journal editor usable on small screens
* Buddy composer remains accessible when the keyboard opens

---

# 27. Performance

Apply performance best practices:

* Use Server Components where appropriate
* Add `"use client"` only when needed
* Lazy-load heavy charts and animation components
* Avoid unnecessary rerenders
* Memoize expensive derived values
* Avoid huge client bundles
* Use dynamic imports where appropriate
* Optimize images
* Prevent cumulative layout shift
* Avoid loading all React Bits effects globally
* Do not render invisible animated components
* Avoid hydration mismatches
* Keep typing in the journal and Buddy input responsive

---

# 28. Error handling

Use the existing:

* `error.tsx`
* `loading.tsx`
* `not-found.tsx`

Enhance them to match the ECHO design system.

Create reusable error-boundary and retry components.

Provide friendly messages without exposing technical stack traces.

---

# 29. Privacy and security requirements

Do not:

* Store sensitive journal text in insecure browser storage by default
* Log journal content to the console
* Log Buddy messages to the console
* Expose service-role keys
* Hardcode secrets
* Send facial video without consent
* Claim encryption that has not been implemented
* Render raw server errors
* Use unsafe HTML rendering without sanitization

Create a validated environment configuration.

Provide `.env.example` using placeholders only.

---

# 30. Existing code migration

Inspect the current source before changing it.

Preserve:

* Existing theme behavior
* Existing route behavior
* Useful components
* Existing types
* Existing responsive logic
* Existing accessibility behavior

Refactor instead of rewriting blindly.

Remove or replace:

* Duplicated page layouts
* Oversized shared components
* Direct mock-data imports from pages
* Dead components
* Unused imports
* Inconsistent naming
* Business logic inside JSX
* Repeated Tailwind class groups
* Unused routes
* Broken links
* Placeholder controls

Do not delete working functionality merely because the code is being reorganized.

---

# 31. Required documentation

Create or update:

```text
frontend/README.md
frontend/src/docs/FRONTEND_ARCHITECTURE.md
frontend/src/docs/MVVM_GUIDE.md
frontend/src/docs/DESIGN_SYSTEM.md
frontend/src/docs/ROUTES.md
frontend/src/docs/REACT_BITS_USAGE.md
frontend/src/docs/BACKEND_INTEGRATION.md
frontend/src/docs/ACCESSIBILITY.md
frontend/src/docs/FEATURE_STATUS.md
```

Document:

* Folder structure
* MVVM rules
* Feature ownership
* Service interfaces
* Theme system
* React Bits wrappers
* Accessibility rules
* Mock-to-live backend migration
* Completed features
* Remaining backend dependencies

---

# 32. Implementation process

Work in controlled phases.

## Phase 1: Audit

* Inspect the full frontend.
* Run lint, type checking, and build.
* Identify existing issues.
* List all current routes.
* Identify duplicated code.
* Identify mock-data dependencies.
* Identify hydration or console errors.

## Phase 2: Architecture foundation

* Create MVVM feature folders.
* Create shared services.
* Create centralized configuration.
* Create typed API client.
* Isolate mock adapters.
* Refactor routes into thin page components.

## Phase 3: Design system

* Consolidate theme tokens.
* Standardize typography.
* Standardize cards, forms, buttons, dialogs, navigation, and feedback.
* Build the application shells.

## Phase 4: React Bits wrappers

* Add only selected components.
* Create accessible ECHO wrappers.
* Add reduced-motion support.
* Verify no hydration errors.

## Phase 5: Public and authentication pages

* Landing
* About
* Terms
* Privacy
* Login
* Signup
* Forgot password
* Reset password

## Phase 6: Onboarding and dashboard

* Consent
* Profile
* Setup
* Dashboard
* Mood check-in

## Phase 7: Journal

* List
* Search
* Filters
* Create
* Edit
* Delete
* Drafts
* Detail
* Analysis display

## Phase 8: Buddy

* Conversation list
* Chat experience
* History
* Message actions
* Grounding suggestions
* Risk-support escalation

## Phase 9: Insights

* Emotion
* Facial
* Risk
* Charts
* Explanations
* Empty and error states

## Phase 10: Settings and support

* Profile
* Privacy
* Security
* Notifications
* Export
* Trusted contacts
* Find help
* Crisis resources

## Phase 11: Grounding tools

* Breathing
* Sensory grounding
* Timers
* Reduced-motion behavior

## Phase 12: Verification

* Lint
* Type checking
* Build
* Route testing
* Responsive testing
* Accessibility checks
* Console-error checks
* Hydration checks
* Dead-button audit
* MVVM architecture audit

Do not attempt to redesign every page in one uncontrolled change.

---

# 33. Required checks

Run the commands available in the project, including:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

If `typecheck` does not exist, add:

```json
"typecheck": "tsc --noEmit"
```

Also check:

* Every route loads directly.
* No route returns an unexpected 404.
* There are no console errors.
* There are no hydration errors.
* There are no TypeScript errors.
* There are no ESLint errors.
* There are no missing imports.
* There are no nonfunctional buttons.
* There is no horizontal overflow.
* Mobile navigation works.
* Light and dark themes work.
* Reduced-motion mode works.
* Forms show validation.
* Destructive actions require confirmation.
* Loading and empty states are present.
* MVVM boundaries are respected.

---

# 34. Coding rules

* Use TypeScript strictly.
* Avoid `any`.
* Use named exports for reusable components.
* Keep page files small.
* Keep components focused.
* Prefer composition over large monolithic components.
* Do not call APIs inside Views.
* Do not place JSX inside Models.
* Do not place raw backend responses directly into state.
* Avoid duplicated types.
* Avoid hardcoded route strings when route constants can be used.
* Avoid hardcoded animation values when motion tokens exist.
* Avoid hardcoded colors when theme tokens exist.
* Do not use emojis as interface icons.
* Do not add fake backend claims.
* Do not add placeholder buttons.
* Do not leave TODO-only implementations.
* Do not remove crisis-resource access.
* Do not weaken privacy messaging.

---

# 35. Definition of done

The task is complete only when:

* The entire application has a consistent ECHO visual identity.
* Every existing route is preserved and enhanced.
* Every feature follows MVVM separation.
* Page components are thin.
* Business logic is located in ViewModels and services.
* Models contain typed domain structures and schemas.
* React Bits is used through accessible ECHO wrappers.
* Motion is subtle and appropriate.
* Crisis and risk pages avoid distracting animations.
* Every control has a real frontend behavior.
* Mock data is isolated behind service adapters.
* The frontend is ready for real API integration.
* Mobile, tablet, and desktop layouts work.
* Light, dark, and system themes work.
* Reduced-motion mode works.
* Empty, loading, error, and success states exist.
* No console, hydration, TypeScript, lint, or build errors remain.
* Documentation accurately reflects the final architecture.

---

# 36. Final response format

After implementation, report:

1. Initial issues found
2. Architecture changes
3. New folder structure
4. Features completed
5. React Bits components integrated
6. Accessibility improvements
7. Responsive improvements
8. Files created
9. Files modified
10. Files removed
11. Mock-data dependencies remaining
12. Backend endpoints still required
13. Lint result
14. Type-check result
15. Production-build result
16. Remaining limitations

Do not simply say that the redesign is complete. Provide concrete file paths, verification results, and any remaining backend dependencies.
