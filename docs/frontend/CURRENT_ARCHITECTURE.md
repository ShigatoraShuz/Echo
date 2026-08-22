# ECHO Frontend — Current Architecture (Pre-MVVM Audit)

> Audit date: 2026-07-13  
> This document captures the baseline architecture **before** MVVM refactoring begins.

---

## 1. Framework & Dependencies

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.20 |
| UI Library | React | 19.0.0 |
| Styling | Tailwind CSS 3 + CSS custom properties | 3.4.17 |
| Icons | Lucide React | 0.468.0 |
| Language | TypeScript (strict) | 5.7.2 |
| Linting | ESLint (Next.js config) | 9.17.0 |
| Build | Next.js built-in | — |

**Not installed (will be needed):** `react-hook-form`, `zod`, `recharts`, `sonner/react-hot-toast`, `react-bits`.

---

## 2. Folder Structure

```
frontend/src/
├── app/                    # Next.js App Router pages (30 routes)
│   ├── about/
│   ├── buddy/
│   ├── crisis/
│   ├── crisis-help/
│   ├── dashboard/
│   ├── design-system/
│   ├── forgot-password/
│   ├── insights/
│   │   ├── emotion/
│   │   ├── facial/
│   │   └── risk/
│   ├── journal/
│   │   ├── [id]/
│   │   └── new/
│   ├── login/
│   ├── onboarding/
│   │   ├── consent/
│   │   ├── profile/
│   │   └── setup/
│   ├── privacy-policy/
│   ├── reset-password/
│   ├── settings/
│   │   ├── export/
│   │   ├── notifications/
│   │   ├── privacy/
│   │   ├── profile/
│   │   ├── security/
│   │   └── trusted-contacts/
│   ├── signup/
│   ├── support/
│   │   └── find-help/
│   ├── terms/
│   ├── tools/
│   │   └── grounding/
│   ├── error.tsx
│   ├── globals.css
│   ├── icon.svg
│   ├── layout.tsx
│   ├── loading.tsx
│   └── not-found.tsx
│
├── components/
│   └── echo/               # All shared components (8 files)
│       ├── mood-selector.tsx
│       ├── public-pages.tsx
│       ├── settings-shell.tsx
│       ├── shared.tsx
│       ├── shells.tsx
│       ├── sync-status.tsx
│       ├── theme-controls.tsx
│       └── theme-provider.tsx
│
├── lib/                     # Utilities and data
│   ├── mock-data.ts         # ALL mock data in one file
│   ├── theme.ts             # Theme types, constants, helpers
│   ├── unsplash-images.ts   # Image asset registry
│   └── utils.ts             # cn() utility
│
├── types/
│   └── index.ts             # All TypeScript interfaces
│
└── docs/                    # NEW — created by this audit
    ├── CURRENT_ARCHITECTURE.md
    ├── ROUTES.md
    └── FEATURE_STATUS.md
```

---

## 3. Architecture Analysis

### 3.1 Strengths
- Clean theme system with 4 variants × 3 modes, persisted in localStorage
- Consistent CSS variable approach — no hardcoded colors in components
- Good accessibility baseline (semantic HTML, ARIA labels, reduced-motion support)
- Two clear application shells (`PublicShell`, `AppShell`, `SettingsShell`)
- Crisis support is always accessible (sidebar link, FAB cards)
- All pages carry non-diagnostic disclaimers as required
- No TypeScript errors, no lint errors, production build passes

### 3.2 MVVM Gaps (to be addressed in Phase 1)
- **No ViewModels**: All logic lives in page files or shared components
- **No typed service layer**: Pages call `@/lib/mock-data` directly (see below)
- **No model isolation**: Domain types live in `types/index.ts` without Zod schemas
- **No route groups**: All pages are flat under `app/` — no `(public)`, `(auth)`, `(protected)` groups
- **No config layer**: Navigation, theme, motion, and feature flags are scattered

### 3.3 Mock-Data Dependency Inventory
Every page listed below imports directly from `@/lib/mock-data`:

| Page File | Mock Data Imported |
|-----------|-------------------|
| `app/dashboard/page.tsx` | `journalEntries`, `moodTrend`, `quickActions`, `riskTrend`, `userProfile`, `weeklyDigest` |
| `app/journal/page.tsx` | `journalEntries` |
| `app/journal/[id]/page.tsx` | `journalEntries` |
| `app/journal/new/page.tsx` | *(none — uses `MoodSelector`)* |
| `app/buddy/page.tsx` | `buddyMessages`, `promptChips` |
| `app/buddy/history/page.tsx` | `buddyMessages` |
| `app/insights/emotion/page.tsx` | `emotionWheel`, `moodTrend` |
| `app/insights/facial/page.tsx` | `facialTrend` |
| `app/insights/risk/page.tsx` | `riskTrend` |
| `app/tools/grounding/page.tsx` | `userProfile` |
| `app/crisis-help/page.tsx` | `hotlines` |
| `app/support/find-help/page.tsx` | `clinics`, `hotlines`, `providers` |
| `app/settings/*/page.tsx` | *(none — use hardcoded sample data in JSX)* |

**Total: 11 pages with direct mock-data imports.**

### 3.4 Client/Server Component Boundaries

| File | Type | Reason |
|------|------|--------|
| `app/error.tsx` | Client | `"use client"` — error boundary needs state |
| `components/echo/theme-provider.tsx` | Client | React context, localStorage, media query listener |
| `components/echo/theme-controls.tsx` | Client | Interactive buttons, state |
| `components/echo/mood-selector.tsx` | Client | Button interaction, state |
| `components/echo/sync-status.tsx` | Client | `navigator.onLine` event listener |
| Everything else | Server | Default — no `"use client"` directive |

**Observation:** The server/client split is clean but limited. No page files use `"use client"`, which means none have interactive state. All forms and buttons are either static `<Link>` elements or non-functional `<button type="button">` elements.

### 3.5 Duplicate & Oversized Components

**Oversized component:** `shared.tsx` (367 lines) contains 18 unrelated components:
- `EchoCard`, `PageHeader`, `EchoImage`, `MoodBadge`, `RiskBadge`, `RiskScoreRing`, `CrisisHelpCard`, `JournalEntryCard`, `ChatBubble`, `EmptyState`, `LoadingState`, `ErrorState`, `ConsentCard`, `FeatureCard`, `BreathingCircle`, `ProviderCard`, `DataChartCard`, `PrivacyNotice`

**Recommendation:** Split into separate files under `shared/components/`.

**Duplication identified:**
- Two crisis-adjacent routes: `/crisis` (full-screen) and `/crisis-help` (public page) — they serve different contexts, so this is acceptable
- `PrivacyNotice` appears inline in many pages as well as inside `AppSidebar` and `SettingsSidebar`
- Theme controls (`theme-controls.tsx`) appear in `SettingsHeader` — no other location has theme switching

### 3.6 Broken Interactions & Accessibility

**Non-functional buttons** (all `<button type="button">` with no `onClick` handler):
- `app/dashboard/page.tsx:25` — Notification bell button
- `app/forgot-password/page.tsx` (via `AuthPage`) — Submit button in form
- `app/reset-password/page.tsx` (via `AuthPage`) — Submit button in form
- `app/login/page.tsx` (via `AuthPage`) — Submit button in form
- `app/signup/page.tsx` (via `AuthPage`) — Submit button in form
- `app/journal/new/page.tsx:39` — "Save reflection" button
- `app/tools/grounding/page.tsx:54` — "Start session" button
- `app/tools/grounding/page.tsx:32` — Prompt chip buttons (no action)
- `app/insights/facial/page.tsx:40` — "Keep off" button
- `app/onboarding/setup/page.tsx:32` — "Ask later" button
- `app/onboarding/setup/page.tsx:44` — "Enable reminders" button
- `app/buddy/page.tsx:32` — Prompt chip buttons
- `app/buddy/page.tsx:39` — Send button

**Total: 13+ non-functional buttons.**

**Non-functional form inputs** (no state management, no submit handling):
- All search inputs (`/journal`, `/buddy/history`, `/support/find-help`)
- All filter dropdowns (mood/sort filters)
- Login/signup/forgot/reset form fields
- Journal editor title/body/tags fields
- Onboarding profile form fields
- Grounding session settings (duration, pace)

**Accessibility observations:**
- ✅ Semantic heading hierarchy (h1 → h2)
- ✅ Skip-to-content link — **missing** from all shells
- ✅ Keyboard navigation — partial (buttons lack `onClick`, dropdowns lack behavior)
- ✅ Focus states — visible through default browser rings but no custom focus-ring tokens
- ✅ ARIA labels on icon buttons — present on notification bell and send button
- ❌ Reduced-motion — supported via `prefers-reduced-motion` in CSS, but no React Bits equivalent
- ❌ No form validation messages
- ❌ No required-field indicators
- ❌ `console.error(error)` in `error.tsx` logs to console

### 3.7 Hydration Risks

- `layout.tsx` uses `suppressHydrationWarning` on `<html>` and `<body>` — acceptable (theme init script runs before hydration)
- `ThemeProvider` reads `localStorage` — must remain a Client component, correctly done

### 3.8 Hardcoded Values

- **Hardcoded hotlines** in `mock-data.ts` (988, 741741, 911) — these are US-specific and should be configurable
- **Hardcoded sample data** in settings pages (`"Mira"`, `"Asia/Manila"`, `"Sam Rivera"`, `"Avery Chen"`)
- **Hardcoded route strings** throughout — no route constants file

---

## 4. Build Verification

| Check | Result |
|-------|--------|
| `npm install` | ✅ Passed (358 packages) |
| `npm run lint` | ✅ Passed (0 warnings, 0 errors) |
| `npm run typecheck` (tsc --noEmit) | ✅ Passed (0 errors) |
| `npm run build` | ✅ Passed (37 static pages) |

---

## 5. Route Inventory

See `ROUTES.md` for complete route map with 30 functional routes.
