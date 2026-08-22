# ECHO Codebase Audit

> Audit date: 2026-07-14
> Auditor: Automated codebase analysis

---

## Executive Summary

ECHO is a privacy-first mental wellness web application built with Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS. The codebase has evolved from a Phase 0 static UI prototype through 6 implementation phases. Two features (Journal, Authentication) have been migrated to MVVM architecture. The Journal feature is a complete reference implementation. All remaining features remain in legacy static-UI state. The project builds successfully with 0 lint/type errors across 37 static routes.

---

## Repository Status

| Metric | Value |
|--------|-------|
| Branch | `main` |
| Remote | `origin/main` (up to date) |
| Commits | 20 |
| Working tree | Clean (1 untracked file: `plan/task2.md`) |
| Latest commit | `f3635c5` — Phase 6: functional AuthPage |
| Phase 4-6 dates | 2026-07-13 UTC+08:00 |
| Phase 3 dates | 2026-06-13 UTC+08:00 |
| Early commits | 2026-07-03 UTC+08:00 |
| Rewrite evidence | None detected |

---

## Build and Test Results

| Check | Result |
|-------|--------|
| Node | v24.18.0 |
| npm | 11.16.0 |
| Dependencies | 358 packages, 2 moderate vulnerabilities |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm run typecheck` | ✅ 0 errors |
| `npm run build` | ✅ 37 static pages, 0 warnings |
| Tests | ❌ No test files found |

---

## Architecture Findings

### Strengths
- Clean MVVM implementation in Journal feature (Model → Service → ViewModel → View)
- Authentication feature has Model + Service layers with mock/HTTP adapters
- Shared foundation: typed config, error model, API client, adapter pattern
- Theme system with 4 variants × 3 modes, persisted in localStorage
- Design tokens via CSS custom properties — no hardcoded colors
- 20 shared UI primitives, 5 feedback components, 5 data-display components
- Crisis support always accessible (sidebar link, FAB card, crisis banner)
- All pages carry non-diagnostic disclaimers
- 10 React Bits animation wrappers with reduced-motion fallbacks
- Centralized Unsplash image catalog with typed keys

### Weaknesses
- **No route groups** — all pages flat under `app/`, missing `(public)`, `(auth)`, `(protected)` groups
- **Auth missing ViewModel + View layers** — state logic lives in `public-pages.tsx` component
- **11 pages import mock data directly** — dashboard, buddy, insights, crisis-help, find-help, grounding
- **13+ non-functional buttons** — onClick handlers missing
- **All search/filter inputs non-functional** — no state management
- **No skip-to-content link** — missing from all shells
- **No tests** — 0 test files in the project
- **No Zod dependency** — schemas use manual validation functions
- **No loading.tsx or error.tsx for individual routes** — only global boundary
- **Dashboard uses legacy `@/lib/mock-data`** — not migrated to service

---

## Route Findings

### Route Coverage
37 routes generated (36 app routes + `/_not-found`). All expected routes from the documentation exist.

### Route Status
| Route | Shell | Status |
|-------|-------|--------|
| `/` | PublicShell | Static with React Bits animations |
| `/about`, `/privacy-policy`, `/terms` | PublicShell | Static via PublicTextPage |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | PublicShell | Functional via AuthPage (Phase 6) |
| `/onboarding/*` | PublicShell | Static |
| `/dashboard` | AppShell | Legacy — imports mock-data |
| `/journal*` | AppShell | MVVM migrated (Phase 4) |
| `/buddy*` | AppShell | Legacy — imports mock-data |
| `/insights/*` | AppShell | Legacy — imports mock-data |
| `/tools/grounding` | AppShell | Legacy — imports mock-data |
| `/support/find-help` | AppShell | Legacy — imports mock-data |
| `/crisis` | Raw | Static |
| `/crisis-help` | PublicShell | Legacy — imports mock-data |
| `/settings/*` | SettingsShell | Static |
| `/design-system` | Raw | Static showcase |

---

## UI Findings

- Semantic design tokens with full light/dark/system mode support
- 4 theme variants: echo-calm, echo-night, echo-soft, echo-focus
- Consistent typography (Inter), spacing, border-radius, shadows
- Mood/risk/emotion semantic color scales defined
- MoodSelector interactive component exists under `components/echo/`
- PrivacyNotice component reused across public pages
- Legacy `shared.tsx` (367 lines) contains 18 unrelated components

---

## Accessibility Findings

| Check | Status |
|-------|--------|
| Skip-to-content link | ❌ Missing from all shells |
| Heading hierarchy | ✅ h1 → h2 throughout |
| Semantic landmarks | ✅ `<main>`, `<nav>`, `<aside>`, `<footer>` |
| Form labels | ✅ Using `<label>` elements |
| Keyboard navigation | 🟡 Links work, buttons (13+) don't |
| Visible focus states | ✅ Browser defaults + custom ring tokens |
| Focus trapping | ❌ No dialogs with focus trapping |
| ARIA labels | 🟡 Present on some icon buttons |
| Reduced motion | ✅ CSS `prefers-reduced-motion` + React Bits fallbacks |
| Color contrast | ✅ CSS variables designed for contrast |
| Touch targets | ✅ Adequate sizing |
| Crisis no-animation | ✅ Crisis page has no animation |

---

## Responsive Findings

- Grid layouts collapse correctly on mobile
- AppShell sidebar becomes horizontal strip on tablet
- No horizontal overflow detected (uses `min-w-0` and `overflow-hidden`)
- No bottom nav or hamburger menu for mobile
- Forms use full-width inputs on mobile

---

## Performance Findings

- All 37 pages statically generated — fast initial load
- Client boundaries minimal: 6 files use `"use client"`
- Lucide icons imported individually (not barrel)
- React Bits wrappers lightweight, conditionally rendered
- Unsplash images use `next/image` with responsive sizes
- No heavy global imports or charts loaded eagerly
- No route groups — no shared layout for auth/public/protected splits
- Auth page is large (344 lines) containing all 4 modes

---

## Security Findings

| Check | Status |
|-------|--------|
| Secrets exposed | ✅ None found |
| Service-role keys | ✅ None |
| API keys in client | ✅ None |
| Password logging | ✅ None |
| Token logging | ✅ None |
| Sensitive localStorage | ✅ None (theme only) |
| `dangerouslySetInnerHTML` | 🟡 Only theme init script (acceptable) |
| `console.error` in error.tsx | ⚠️ Logs error object (contains user-visible message) |
| `console.error` in environment.ts | ⚠️ Logs adapter validation warning |
| No fake auth tokens | ✅ AuthMockAdapter returns `isMockSession: true` |
| No encryption claims | ✅ None found |
| No privacy claims | ✅ Appropriate disclaimers present |

---

## Test Findings

- **0 test files** exist in the project
- No Jest, Vitest, Playwright, or testing library configured
- No test scripts in package.json
- JOURNAL_MVVM_SPEC.md defines comprehensive test requirements (Model, Service, ViewModel, View, A11y, Route smoke tests) — none implemented

---

## Documentation Drift

| Document | Status | Issues |
|----------|--------|--------|
| CURRENT_ARCHITECTURE.md | ✅ Accurate (Phase 0 baseline) | Pre-dates Phase 2-6 migration |
| ROUTES.md | ✅ Accurate | Missing Phase 4-6 route updates |
| FEATURE_STATUS.md | 🟡 Partially outdated | Claims Journal is static UI — actually MVVM migrated |
| MVVM_GUIDE.md | ✅ Accurate | Defines target architecture correctly |
| FRONTEND_ARCHITECTURE.md | 🟡 Partially outdated | Lists "to be installed" deps already partially done |
| BACKEND_INTEGRATION.md | ✅ Accurate | Planned architecture only |
| JOURNAL_MVVM_SPEC.md | 🟡 Partially outdated | Spec matches implementation closely but has minor field diffs (JournalAnalysis model differs) |

---

## Overall Health

**Score: 71/100**

The codebase has a solid foundation with clean architecture emerging in Journal and Authentication features. The core infrastructure (config, errors, API client, theme, shared components) is well-implemented. However, most features remain in pre-MVVM legacy state with direct mock-data imports, non-functional buttons, and zero test coverage. The project is on a good trajectory but requires significant work to complete feature migrations.
