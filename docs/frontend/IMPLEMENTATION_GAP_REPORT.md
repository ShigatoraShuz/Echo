# ECHO Implementation Gap Report

> Generated: 2026-07-14

---

## Critical Issues

| ID | Severity | Category | File | Evidence | Impact | Recommended Correction | Phase |
|----|----------|----------|------|----------|--------|----------------------|-------|
| C001 | CRITICAL | Sensitive logging | `src/app/error.tsx:8` | `console.error(error)` — logs entire error object to console | Potential data leakage via browser console | Remove or replace with structured logging (code only, no user data) | Fix |
| C002 | CRITICAL | Missing tests | Entire project | 0 test files, no test framework configured | No regression safety; all verified behavior is manual | Install Vitest or Jest, add tests per JOURNAL_MVVM_SPEC.md test matrix | 7 |

## High-Priority Issues

| ID | Severity | Category | File | Evidence | Impact | Recommended Correction | Phase |
|----|----------|----------|------|----------|--------|----------------------|-------|
| H001 | HIGH | Mock data in pages | `src/app/dashboard/page.tsx:13` | `import { journalEntries, moodTrend, ... } from "@/lib/mock-data"` | Dashboard cannot switch to real backend | Migrate Dashboard to MVVM with ViewModel → Service → MockAdapter | 7 |
| H002 | HIGH | Mock data in pages | `src/app/buddy/page.tsx` | `import { buddyMessages, promptChips } from "@/lib/mock-data"` | Buddy cannot switch to real backend | Migrate Buddy to MVVM | 7 |
| H003 | HIGH | Mock data in pages | `src/app/buddy/history/page.tsx` | `import { buddyMessages } from "@/lib/mock-data"` | Buddy history cannot switch to real backend | Include in Buddy MVVM migration | 7 |
| H004 | HIGH | Mock data in pages | `src/app/insights/*/page.tsx` | 3 insight pages import mock-data directly | Insights cannot switch to real backend | Migrate Insights to MVVM | 7 |
| H005 | HIGH | Mock data in pages | `src/app/tools/grounding/page.tsx` | `import { userProfile } from "@/lib/mock-data"` | Grounding cannot switch to real backend | Migrate Grounding to MVVM | 7 |
| H006 | HIGH | Mock data in pages | `src/app/crisis-help/page.tsx` | `import { hotlines } from "@/lib/mock-data"` | Crisis resources cannot switch to real backend | Migrate CrisisHelp to use service | 7 |
| H007 | HIGH | Mock data in pages | `src/app/support/find-help/page.tsx` | `import { clinics, hotlines, providers } from "@/lib/mock-data"` | Find help cannot switch to real backend | Migrate FindHelp to use service | 7 |
| H008 | HIGH | Auth missing ViewModel | `src/features/authentication/` | No view-model/ or view/ directories | Auth state logic mixed in component layer | Extract Auth ViewModel and View layers | 6 |
| H009 | HIGH | Missing route groups | `src/app/` | No `(public)`, `(auth)`, `(protected)` route groups | No shared layout boundaries; middleware cannot target groups | Create route groups with appropriate layouts | 7 |

## Medium-Priority Issues

| ID | Severity | Category | File | Evidence | Impact | Recommended Correction | Phase |
|----|----------|----------|------|----------|--------|----------------------|-------|
| M001 | MEDIUM | Non-functional buttons | Multiple pages | 13+ buttons have no onClick handler | Users cannot interact with core features | Add event handlers via ViewModels | 7 |
| M002 | MEDIUM | Search/filter non-functional | `/journal`, `/buddy/history`, `/support/find-help` | Search inputs, mood/sort dropdowns have no state | Users cannot search or filter | Implement search/filter state in ViewModels | 7 |
| M003 | MEDIUM | Skip-to-content missing | All shells | No skip-to-content link in any shell layout | Keyboard users cannot skip navigation | Add skip-to-content link to PublicShell, AppShell, SettingsShell | 3 |
| M004 | ✅ RESOLVED | Oversized component | `src/components/echo/shared.tsx` | Was 367 lines, 18 unrelated components | Poor maintainability, mixed responsibilities | Decomposed into 12 files under `shared/`, barrel preserves imports | 6.5 |
| M005 | MEDIUM | AuthPage component too large | `src/components/echo/public-pages.tsx` | 344 lines, handles 4 auth modes | Hard to maintain and test | Split into per-mode views with AuthViewModel | 6 |
| M006 | MEDIUM | No Schema library | `src/features/journal/model/journal.schema.ts` | Uses manual validation instead of Zod | Manual validation is error-prone and verbose | Install zod and migrate schemas | 7 |
| M007 | MEDIUM | No loading.tsx per route | `src/app/` | Only global loading.tsx exists | No granular loading skeletons for route transitions | Add loading.tsx for data-fetching routes | 7 |
| M008 | MEDIUM | Settings pages static | `src/app/settings/*/page.tsx` | All settings are hardcoded sample data | No settings actually work | Implement settings ViewModels and services | 7 |
| M009 | MEDIUM | Onboarding pages static | `src/app/onboarding/*/page.tsx` | No interactive consent toggles, no profile editing | Onboarding flow is non-functional | Implement onboarding MVVM | 7 |
| M010 | MEDIUM | Grounding non-functional | `src/app/tools/grounding/page.tsx` | Start/pause/resume, timer/progress not implemented | Grounding tool is presentational only | Implement grounding ViewModel | 7 |

## Low-Priority Issues

| ID | Severity | Category | File | Evidence | Impact | Recommended Correction | Phase |
|----|----------|----------|------|----------|--------|----------------------|-------|
| L001 | LOW | No active route detection | `src/components/echo/shells.tsx` | Navigation links do not highlight current page | Users cannot tell where they are | Implement active route detection in navigation components | 7 |
| L002 | LOW | Hardcoded hotlines | `src/lib/mock-data.ts` | US-specific hotlines (988, 741741, 911) hardcoded | Not configurable per deployment | Move to environment config | 7 |
| L003 | LOW | Hardcoded sample data | Settings pages | "Mira", "Asia/Manila", "Sam Rivera" hardcoded in JSX | Not realistic demo data | Replace with mock service data | 7 |
| L004 | LOW | console.error in environment.ts | `src/config/environment.ts:28` | Logs adapter validation warning | Minor console noise | Remove or silence in production | Fix |
| L005 | LOW | `EchoButton` unused import style | Various | Some components import but don't use all components | Minor bundle overhead | Clean up unused imports | 7 |
| L006 | LOW | No not-found.tsx per segment | `src/app/` | Only global not-found.tsx | No contextual 404 pages | Add not-found.tsx for dynamic routes | 7 |
| L007 | LOW | Missing metadata on some pages | Some route pages | Not all pages export metadata | Poor SEO and sharing preview | Add metadata to all pages | 7 |

## Missing Features

| Feature | Status | Evidence |
|---------|--------|----------|
| Tests | ❌ Missing | 0 test files, no testing framework |
| Search functionality | ❌ Missing | Search inputs non-functional |
| Filter/sort functionality | ❌ Missing | Dropdowns have no state |
| Journal autosave | 🟡 Partial | Autosave timer runs but doesn't persist |
| Journal draft persistence | ❌ Missing | Drafts exist in memory only |
| Buddy messaging | ❌ Missing | Chat UI is static |
| Buddy conversation management | ❌ Missing | No create/rename/delete |
| Settings editing | ❌ Missing | All settings are read-only |
| Avatar upload | ❌ Missing | No upload functionality |
| Data export | ❌ Missing | "Prepare" links are static |
| Two-factor auth | ❌ Missing | "Planned" badge |
| Facial analysis | ❌ Missing | Camera not implemented |
| Onboarding step progress | ❌ Missing | No step indicator |
| Landing page hero features | ❌ Missing | Missing "How ECHO works", testimonials, etc. |

## Backend-Dependent Limitations

| Feature | Limitation | Current Approach |
|---------|------------|-----------------|
| Authentication | No real auth — mock adapter | Mock adapter creates mock sessions |
| Journal Storage | In-memory store | Entries lost on refresh (3 hardcoded survive via generateStaticParams) |
| Buddy AI | No AI responses | Static mock messages |
| Emotion Analysis | Pre-defined responses | `generatePerspective` returns template strings |
| Risk Scoring | Random calculation | `calculateRiskScore` adds random variance |
| Data Export | Mock markdown export | No real file generation |
| Settings Persistence | No server sync | Hardcoded sample data |

## Recommended Implementation Order

1. **Fix critical issues**: Remove sensitive `console.error` in error.tsx
2. **Add test framework**: Install Vitest, configure, write model/service tests
3. **Complete Auth MVVM**: Extract Auth ViewModel and View layers
4. **Create route groups**: `(public)`, `(auth)`, `(protected)` with proper layouts
5. **Migrate Dashboard to MVVM**: Next feature after Journal (high user impact)
6. **Add loading/error boundaries**: Per-route loading.tsx and error.tsx
7. **Implement Journal tests**: Per JOURNAL_MVVM_SPEC.md
8. **Migrate remaining features**: Buddy, Insights, Grounding, Settings
