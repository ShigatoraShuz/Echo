# ECHO Frontend — Feature Status (Phase 0 Audit)

> Audit date: 2026-07-13  
> Status: `📐 static-ui` = presentational, no interactivity  
> `❌ missing` = not implemented  
> `✅ complete` = fully functional  

---

## 1. Landing Page (`/`)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Hero section | ✅ | Present with ECHO branding, "Start privately" CTA |
| Privacy-first message | ✅ | Present in hero subtitle |
| Main CTAs | 🟡 | Only "Start privately" and "Crisis resources" — missing "Meet Your Buddy", "Explore Grounding", "Learn About Privacy" |
| Product preview | ❌ | No feature overview, screenshots, or mockups |
| Feature overview | ❌ | Missing |
| How ECHO works | ❌ | Missing |
| Privacy and trust section | ❌ | Missing |
| Non-diagnostic disclaimer | 🟡 | In footer only, not on landing hero |
| Crisis-support visibility | ✅ | Link in hero section |
| Testimonials | ❌ | Missing |
| Final CTA | ❌ | Missing |
| Professional footer | ✅ | Present with links |

---

## 2. Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| Login (email, password) | 📐 | Static form — no validation, no submit handler |
| Show/hide password | ❌ | Not implemented |
| Remember session | ❌ | Not implemented |
| Forgot-password link | ✅ | Present |
| Signup link | ✅ | Present |
| Signup (name, email, password, confirm) | 📐 | Static form |
| Password-strength feedback | ❌ | Not implemented |
| Terms acceptance | ❌ | Not implemented |
| Privacy acknowledgement | ❌ | Not implemented |
| Forgot password form | 📐 | Static form |
| Reset password form | 📐 | Static form |

---

## 3. Onboarding

| Feature | Status | Notes |
|---------|--------|-------|
| Consent page | 📐 | Static consent cards, no toggle/checkbox interaction |
| Privacy explanation | ✅ | Present |
| AI limitations | ✅ | Present |
| Facial-analysis opt-in | ❌ | Missing from consent page |
| Profile page | 📐 | Static form fields |
| Preferred name | 📐 | Static input |
| Goals / Buddy tone | ❌ | Missing |
| Notification preference | 🟡 | Text description, no toggle |
| Setup page | 📐 | Static permission explanations |
| Theme selection | ❌ | Missing from onboarding |
| First mood check-in | ✅ | Present on profile page |
| Completion summary | ✅ | Present |
| Step progress indicator | ❌ | Missing |

---

## 4. Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Greeting with name | ✅ | Static from mock data |
| Current date | ❌ | Not shown |
| Mood check-in | ❌ | Missing widget |
| Quick journal action | ✅ | Link to `/journal/new` |
| Talk to Buddy action | ✅ | Link to `/buddy` |
| Recent journal entries | ✅ | Static cards from mock data |
| Mood trend summary | ✅ | Static chart, from mock data |
| Emotion summary | ✅ | Present |
| Recent grounding activity | ❌ | Missing |
| Privacy/sync status | ✅ | Present in sidebar |
| Crisis-help shortcut | ✅ | CrisisHelpCard component |
| Loading skeleton | ❌ | Missing |
| Empty state | ❌ | Missing |
| Error state | ❌ | Missing |

---

## 5. Journal

| Feature | Status | Notes |
|---------|--------|-------|
| Journal list | 📐 | Static cards from mock data |
| Search input | 📐 | Non-functional |
| Mood filtering | 📐 | Non-functional dropdown |
| Date filtering | ❌ | Missing |
| Sorting | 📐 | Non-functional dropdown |
| Pagination/load-more | ❌ | Missing |
| Empty state | ✅ | Present ("Filtered entries will appear here") |
| Create entry | 📐 | Static form |
| Edit entry | ❌ | Not implemented |
| Delete confirmation | ❌ | Not implemented |
| Draft saving | ❌ | Not implemented |
| Autosave indicator | ❌ | Not implemented |
| Word/character count | ❌ | Not implemented |
| Mood selection | ✅ | Interactive via MoodSelector |
| Emotion tags | 📐 | Static input |
| Privacy status | ❌ | Missing |
| Analysis display | ✅ | Static "ECHO perspective" card |

---

## 6. Buddy

| Feature | Status | Notes |
|---------|--------|-------|
| Conversation display | 📐 | Static messages from mock data |
| New conversation | ❌ | Missing |
| Rename conversation | ❌ | Missing |
| Delete conversation | ❌ | Missing |
| Search history | 📐 | Non-functional input |
| Message input | 📐 | Static textarea, non-functional send |
| Enter-to-send | ❌ | Not implemented |
| Typing indicator | ❌ | Missing |
| Streaming-ready UI | ❌ | Missing |
| Retry message | ❌ | Missing |
| Copy response | ❌ | Missing |
| Feedback action | ❌ | Missing |
| Grounding suggestion cards | ✅ | Present |
| Crisis-escalation card | ✅ | Present |
| Empty state | ❌ | Missing |
| Error state | ❌ | Missing |
| Offline state | ❌ | Missing |

---

## 7. Insights

| Feature | Status | Notes |
|---------|--------|-------|
| Emotion overview | ✅ | Static |
| Time-range controls | ❌ | Missing |
| Emotion trend chart | ✅ | Static bar chart |
| Emotion distribution | ✅ | Conic gradient wheel |
| Journal-source breakdown | ❌ | Missing |
| Most frequent emotions | ✅ | Static list |
| Positive/difficult balance | 📐 | Text description only |
| Plain-language explanations | ✅ | Present |
| Empty state | ❌ | Missing |
| Privacy notice | ✅ | Present |
| Facial camera permission | 📐 | Static UI, no real camera |
| Camera start/stop | ❌ | Not implemented |
| Permission-denied state | ❌ | Missing |
| Camera-unavailable state | ❌ | Missing |
| Risk current signal | ✅ | Present |
| Risk band history | ✅ | Static list |
| Supporting factors | ✅ | Present |
| Clear uncertainty language | ✅ | Present |

---

## 8. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Profile (name, timezone) | 📐 | Static display, no editing |
| Avatar upload | ❌ | Missing |
| Privacy controls | 📐 | Static display |
| Security / change password | 📐 | Static "Update" text |
| Two-factor readiness | 📐 | "Planned" badge |
| Active sessions | 📐 | "Review" text |
| Notifications | 📐 | Badge toggles (On/Off/Optional) |
| Quiet hours | ❌ | Missing |
| Export | 📐 | "Prepare" text links |
| Deletion request | 📐 | "Sensitive" badge |
| Trusted contacts list | 📐 | Static sample contacts |
| Add/edit/remove contact | ❌ | Not implemented |
| Empty state | ❌ | Missing |

---

## 9. Grounding Tools

| Feature | Status | Notes |
|---------|--------|-------|
| Breathing circle | ✅ | Static animation (CSS) |
| 5-4-3-2-1 sensory | 📐 | Static description card |
| Box breathing | 📐 | Static description card |
| Start/pause/resume | ❌ | Not implemented |
| Timer/progress | ❌ | Missing |
| Duration selector | 📐 | Non-functional dropdown |
| Pace selector | 📐 | Non-functional dropdown |
| Completion state | ❌ | Missing |
| Reduced-motion mode | ✅ | CSS-level |

---

## 10. Crisis Support

| Feature | Status | Notes |
|---------|--------|-------|
| Immediate-help heading | ✅ | Present |
| Emergency-service guidance | ✅ | Present |
| Hotline/support resources | 📐 | Static from mock data |
| Contact trusted person | ❌ | Missing |
| Find local professional help | ✅ | Link to `/support/find-help` |
| Grounding action | ✅ | Present |
| Safety-focused language | ✅ | Present |
| Clear exit/navigation | ✅ | Present |

---

## 11. Accessibility

| Requirement | Status | Notes |
|-------------|--------|-------|
| Full keyboard navigation | 🟡 | Links work, buttons don't |
| Visible focus states | ✅ | Browser defaults, custom ring tokens needed |
| Proper heading hierarchy | ✅ | h1 → h2 throughout |
| Semantic landmarks | ✅ | `<main>`, `<nav>`, `<aside>`, `<footer>` |
| Form labels | ✅ | Using `<label>` elements |
| Screen-reader descriptions | 🟡 | Some ARIA, missing on many controls |
| Accessible dialogs | ❌ | No dialogs exist |
| Accessible charts | 🟡 | Basic ARIA labels on conic chart |
| Sufficient color contrast | ✅ | CSS variables designed for contrast |
| Skip-to-content link | ❌ | Missing from all shells |
| Reduced-motion support | ✅ | CSS `prefers-reduced-motion` |
| Touch targets | ✅ | Adequate sizing |
| Crisis resources no-animation | ✅ | Crisis page has no animation |

---

## 12. Responsive Design

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Small mobile | 🟡 | Mostly works, some horizontal scroll risk |
| Standard mobile | ✅ | AppShell grid collapses to single column |
| Tablet | ✅ | Sidebar becomes horizontal strip |
| Desktop | ✅ | Sidebar + content layout |
| No horizontal overflow | ✅ | `min-w-0` and `overflow-hidden` used |
| Mobile-friendly forms | ✅ | Full-width inputs |
| Mobile navigation | 🟡 | No bottom nav or hamburger menu |

---

## Summary

| Category | Total Requirements | ✅ Complete | 📐 Static UI | ❌ Missing |
|----------|-------------------|-------------|--------------|------------|
| Landing | 10 | 3 | 1 | 6 |
| Auth | 13 | 2 | 4 | 7 |
| Onboarding | 12 | 4 | 5 | 3 |
| Dashboard | 13 | 6 | 2 | 5 |
| Journal | 18 | 4 | 4 | 10 |
| Buddy | 19 | 4 | 2 | 13 |
| Insights | 18 | 8 | 1 | 9 |
| Settings | 14 | 0 | 8 | 6 |
| Grounding | 10 | 2 | 4 | 4 |
| Crisis | 8 | 7 | 1 | 0 |

## 13. Phase 2 Implementation

The following shared foundation has been implemented:
- Typed environment configuration with validation
- Centralized route constants for all 30+ routes
- Typed navigation configuration (public, app, settings, mobile, crisis)
- Motion tokens for future animation
- Feature flags with environment-driven values
- `AppError` model with 10 error codes and user-safe messages
- Error normalizer (AbortError, TimeoutError, NetworkError, HTTP errors, unknown)
- Discriminated union types: `AsyncState<T>`, `ServiceResult<T>`, `PaginationState`
- `AuthTokenProvider` interface with null provider for mock/public mode
- Typed API client with GET, POST, PATCH, PUT, DELETE, token injection, abort, timeout
- Abort-signal composition utility
- Service adapter foundation (mock vs HTTP selection)

**Not yet implemented:** Shared UI components, route groups, application shells, domain services, React Bits wrappers, form/validation libraries.

## 14. Phase 3 — Design System & Shared Components

The following design foundation and reusable component library has been implemented:

**Style Foundation:**
- Semantic CSS custom properties (`tokens.css`) for surfaces, emotions, typography, spacing, shape, elevation, z-index across 4 theme variants + dark mode
- Motion utilities (`motion.css`) with fade, slide, scale, progress, skeleton, stagger animations and `prefers-reduced-motion` fallback
- Accessibility utilities (`accessibility.css`) including skip-to-content, focus-visible rings, sr-only, touch targets, form error states
- Tailwind config updated with shared/config content paths and semantic color mappings (surface, overlay, emotion, info)

**UI Primitives (`shared/components/ui/`):**
- `EchoButton` — 7 variants, 4 sizes, loading state with spinner
- `EchoIconButton` — icon-only ghost/primary/secondary/soft variants
- `EchoInput` — label, description, error, leading/trailing icons, ARIA
- `EchoTextarea` — label, description, error, character count
- `EchoSelect` — label, description, error, placeholder, custom arrow
- `EchoCheckbox` — label, description, error, custom check mark
- `EchoRadioGroup` — fieldset/legend, options with descriptions
- `EchoSwitch` — label, description, role="switch"
- `EchoLabel` — optional required indicator
- `EchoCard` — title, description, action, compact variant
- `EchoBadge` — 6 color variants, 2 sizes
- `EchoAvatar` — image, initials, or fallback icon
- `EchoDivider` — optional label
- `EchoProgress` — label, percentage, 3 semantic variants, 2 sizes
- `EchoTabs` — accessible tablist with active state
- `EchoDialog` — modal with overlay, Escape, focus trap
- `EchoSheet` — slide-in panel from left/right
- `EchoSkeleton` — text, circular, rectangular; group variant
- `EchoTooltip` — hover/focus reveal on 4 sides

**Feedback Components (`shared/components/feedback/`):**
- `EchoEmptyState` — icon, title, description, optional action button
- `EchoErrorState` — full and compact variants with retry
- `EchoLoadingState` — spinner and skeleton variants
- `EchoInlineMessage` — info/success/warning/error with icons
- `EchoStatusBanner` — dismissible page-level alerts in 4 variants

**Data Display (`shared/components/data-display/`):**
- `EchoStatCard` — metric display with trend arrow
- `EchoSectionHeading` — title, description, action slot
- `EchoPageHeading` — page-level title with badge and action
- `EchoMoodIndicator` — 6 mood levels with icons and labels
- `EchoRiskIndicator` — 4 risk levels with dot indicator

**Crisis (`shared/components/crisis/`):**
- `EchoCrisisBanner` — always accessible (never behind FF), full and compact variants

**Navigation (`shared/components/navigation/`):**
- `EchoPublicNavbar` — public site header
- `EchoPublicFooter` — public site footer
- `EchoSidebar` — app sidebar with nav links, sync status, crisis badge

**Layout Shells (`shared/components/layout/`):**
- `EchoPublicShell` — public page wrapper
- `EchoAppShell` — authenticated app wrapper
- `EchoSettingsShell` — settings page wrapper with subnav

**Legacy Decomposition:**
- `CrisisHelpCard` and `PrivacyNotice` extracted to dedicated files
- Legacy `shared.tsx`, `shells.tsx`, `public-pages.tsx` preserved with backward-compatible exports
- Design system preview page (`/design-system`) updated to use all new components

**Overall:** 55 ✅ complete, 32 📐 static-ui, 63 ❌ missing  
## 15. Phase 4 — Journal MVVM

The Journal feature has been fully migrated to MVVM architecture:

**Model Layer:**
- Interfaces: `JournalEntry`, `JournalEntryDraft`, `JournalFilter`, `JournalSortOption`, `JournalAnalysis`
- DTOs with Zod schemas for runtime validation
- Mappers for client ↔ DTO conversion
- Constants for moods, emotion tags, sort options, page sizes

**Services:**
- `JournalService` interface with CRUD + filter/sort + analysis + autosave operations
- `JournalMockAdapter` — in-memory store with realistic delays, search, mood filtering, date range
- `JournalHttpAdapter` — placeholder for future backend connection
- Factory with environment-driven mock/real selection

**ViewModels (3):**
- `useJournalListViewModel` — entries, filters, sorting, pagination, loading/error states
- `useJournalEditorViewModel` — draft management, autosave, validation, mood/emotion selection
- `useJournalDetailViewModel` — single entry display, delete confirmation, analysis panel

**Components (7):**
- `JournalCard` — entry card with risk indicator, mood, emoji, date, actions
- `JournalFilters` — search, mood, sort, date range controls
- `JournalEmptyState` — contextual empty/error/loading states
- `JournalDeleteDialog` — confirmation with danger button
- `JournalAutosaveStatus` — saving/saved/error indicator
- `JournalMoodSelector` — mood grid with active highlight
- `JournalAnalysisPanel` — sentiment summary display

**Views (3):**
- `JournalListView` — orchestrates list, filters, empty state
- `JournalEditorView` — orchestrates editor, mood selector, autosave
- `JournalDetailView` — orchestrates detail, analysis, delete dialog

**Route pages:**
- Thin pages with no mock-data imports, no filtering/CRUD logic
- `generateStaticParams` restored for static export compatibility

## 16. Phase 5 — React Bits Wrappers & Unsplash Catalog

**React Bits Animation Wrappers (`shared/components/react-bits/`):**
- `EchoReveal` — fade + slide on scroll into view (up/down/left/right/none)
- `EchoFade` — simple opacity toggle
- `EchoBlurText` — blur-to-clear entrance animation
- `EchoCountUp` — number count animation triggered on scroll
- `EchoSpotlightCard` — card hover spotlight effect
- `EchoAnimatedList` — staggered list entrance
- `EchoStepTransition` — fade + slide for step/stepper transitions
- `EchoTextTransition` — cycling text with cross-fade
- `EchoBreathingVisual` — breathing circle display
- All wrappers respect `prefers-reduced-motion`

**Unsplash Catalog:**
- Centralized in `lib/unsplash-images.ts` with typed `EchoImageAsset` interface
- Responsive `sizes` attribute, `priority` flag
- Meaningful alt text, no fabricated testimonials
- Used via `EchoImage` component (not raw `<img>` or `<Image>`)

**Auth Service Interface (Phase 6 foundation):**
- `AuthService` interface with login, signup, forgot/reset password, session management
- `AuthMockAdapter` — functional mock with validation, field errors, realistic delays
- `AuthHttpAdapter` — placeholder for future backend
- Factory with environment-driven selection

## 17. Phase 5b — In-Page React Bits & Unsplash Integration

**React Bits in public pages:**
- `PublicTextPage` — `EchoReveal` on hero content and card section
- `AuthPage` — `EchoReveal` on left content section (staggered delay on form card), per-mode feature cards hidden on reset-password
- `HomePage` — `EchoReveal` on hero, image section, 3 feature cards (staggered), `EchoCountUp` on stats

**React Bits in dashboard (restrained, safety-aware):**
- Stat cards: staggered `EchoReveal` (0/100/200ms)
- Mood trends + risk ring: `EchoReveal` delayed 100ms
- Recent entries: `EchoReveal` delayed 150ms
- Weekly digest: `EchoReveal` delayed 150ms
- Quick actions: `EchoReveal` delayed 200ms
- No animations on: risk history, privacy disclaimer, CrisisHelpCard

**Unsplash per-mode auth imagery:**
- Login: `cozyChairWindow`
- Signup: `calmChairPlant`
- Forgot password: `meditationRoomPlant`
- Reset password: `plantDeskWarmLight`

**Bulk of work needed:** Buddy interactions, form validation, settings interactivity, landing page redesign, backend integration.
