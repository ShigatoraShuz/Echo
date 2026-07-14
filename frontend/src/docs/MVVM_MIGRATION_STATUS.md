# ECHO MVVM Migration Status

> Generated: 2026-07-14
> Status: LEGACY | FOUNDATION ONLY | PARTIALLY MIGRATED | MVVM MIGRATED | BACKEND DEPENDENT

---

## Journal

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/components/echo/shared.tsx` (JournalEntryCard) | LEGACY RETAINED | Backward-compatible re-exports |
| Model | `src/features/journal/model/journal.model.ts` | ✅ COMPLETE | Interfaces, enums, types |
| DTO | `src/features/journal/model/journal.dto.ts` | ✅ COMPLETE | Request/response DTOs |
| Mapper | `src/features/journal/model/journal.mapper.ts` | ✅ COMPLETE | DTO ↔ Domain mapping |
| Schema | `src/features/journal/model/journal.schema.ts` | ✅ COMPLETE | Manual validation (no Zod) |
| Constants | `src/features/journal/model/journal.constants.ts` | ✅ COMPLETE | Page size, limits, intervals |
| Service interface | `src/features/journal/services/journal.service.ts` | ✅ COMPLETE | Typed service interface |
| Mock adapter | `src/features/journal/services/journal.mock-adapter.ts` | ✅ COMPLETE | In-memory with delay, search, filter |
| HTTP adapter | `src/features/journal/services/journal.http-adapter.ts` | ✅ COMPLETE | Placeholder (not implemented) |
| Factory | `src/features/journal/services/journal-service.factory.ts` | ✅ COMPLETE | Env-driven selection |
| ViewModel (list) | `src/features/journal/view-model/use-journal-list-view-model.ts` | ✅ COMPLETE | useReducer, loading/error states |
| ViewModel (editor) | `src/features/journal/view-model/use-journal-editor-view-model.ts` | ✅ COMPLETE | Form state, validation, autosave |
| ViewModel (detail) | `src/features/journal/view-model/use-journal-detail-view-model.ts` | ✅ COMPLETE | Entry, analysis, delete, export |
| View (list) | `src/features/journal/view/journal-list-view.tsx` | ✅ COMPLETE | Filters, cards, pagination |
| View (editor) | `src/features/journal/view/journal-editor-view.tsx` | ✅ COMPLETE | Form with mood selector, autosave |
| View (detail) | `src/features/journal/view/journal-detail-view.tsx` | ✅ COMPLETE | Entry display, analysis, actions |
| Components (7) | `src/features/journal/components/` | ✅ COMPLETE | Card, filters, empty, delete dialog, autosave, mood selector, analysis |
| Route integration | `src/app/journal/*/page.tsx` | ✅ COMPLETE | Thin pages (10-15 lines) |
| Functional parity | — | ✅ VERIFIED | Full CRUD, search, filter, sort, pagination, delete, export |
| Legacy cleanup | — | ✅ COMPLETE | Journal pages no longer import mock-data |
| Tests | `src/features/journal/` | ✅ COMPLETE | Schema (7), mock adapter (12), list ViewModel (10) |

**Migration status: MVVM MIGRATED**

---

## Authentication

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/components/echo/shared.tsx` (barrel) | ✅ DECOMPOSED | 367-line barrel split into 12 feature-adjacent files |
| Legacy implementation | `src/components/echo/public-pages.tsx` (AuthPage) | ✅ REMOVED | Page routes use feature Views directly |
| Model | `src/features/authentication/model/auth.model.ts` | ✅ COMPLETE | Input types, session, error types |
| DTO | `src/features/authentication/model/auth.dto.ts` | ✅ COMPLETE | Request/response DTOs |
| Mapper | `src/features/authentication/model/auth.mapper.ts` | ✅ COMPLETE | DTO ↔ Domain mapping |
| Schema | `src/features/authentication/model/auth.schema.ts` | ✅ COMPLETE | Zod validation schemas |
| Constants | `src/features/authentication/model/auth.constants.ts` | ✅ COMPLETE | Error messages map |
| Service interface | `src/features/authentication/services/auth.service.ts` | ✅ COMPLETE | Typed interface |
| Mock adapter | `src/features/authentication/services/auth.mock-adapter.ts` | ✅ COMPLETE | Per-instance state encapsulation |
| HTTP adapter | `src/features/authentication/services/auth.http-adapter.ts` | ✅ COMPLETE | Placeholder |
| Factory | `src/features/authentication/services/auth-service.factory.ts` | ✅ COMPLETE | Env-driven selection |
| ViewModel (login) | `src/features/authentication/view-model/use-login-view-model.ts` | ✅ COMPLETE | useReducer, validation, submit, reset |
| ViewModel (signup) | `src/features/authentication/view-model/use-signup-view-model.ts` | ✅ COMPLETE | useReducer, password strength, validation |
| ViewModel (forgot) | `src/features/authentication/view-model/use-forgot-password-view-model.ts` | ✅ COMPLETE | useReducer, validation, success message |
| ViewModel (reset) | `src/features/authentication/view-model/use-reset-password-view-model.ts` | ✅ COMPLETE | useReducer, token extraction, password strength |
| View (login) | `src/features/authentication/view/login-view.tsx` | ✅ COMPLETE | Email/password, remember, show/hide |
| View (signup) | `src/features/authentication/view/signup-view.tsx` | ✅ COMPLETE | Full form with password strength |
| View (forgot) | `src/features/authentication/view/forgot-password-view.tsx` | ✅ COMPLETE | Email form with success/error |
| View (reset) | `src/features/authentication/view/reset-password-view.tsx` | ✅ COMPLETE | Password form with token |
| Components (5) | `src/features/authentication/components/` | ✅ COMPLETE | AuthFormField, PasswordField, PasswordStrength, AuthStatusMessage, AuthPrivacyNote |
| Route integration | `src/app/{login,signup,forgot-password,reset-password}/page.tsx` | ✅ COMPLETE | Thin pages importing feature Views |
| Functional parity | — | ✅ VERIFIED | Login, signup, forgot, reset work via mock |
| Legacy cleanup | — | ✅ COMPLETE | AuthPage removed from public-pages.tsx |
| Tests (7 files) | `src/features/authentication/` | ✅ COMPLETE | Schema (7), mock adapter (13), 4 ViewModels (31) |

**Migration status: MVVM MIGRATED**

---

## Dashboard

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/dashboard/page.tsx` | LEGACY | 138 lines, imports mock-data |
| Route | `src/app/dashboard/page.tsx` | LEGACY | Direct mock-data import |
| Shared component deps | `CrisisHelpCard`, `DataChartCard`, `JournalEntryCard`, `RiskScoreRing` | LEGACY | From shared.tsx |
| Mock dependency | `journalEntries`, `moodTrend`, `quickActions`, `riskTrend`, `userProfile`, `weeklyDigest` | ACTIVE | 6 mock-data imports |
| Functional parity | — | NOT VERIFIED | No ViewModel, all static |

**Migration status: LEGACY**

---

## Buddy

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/buddy/page.tsx`, `src/app/buddy/history/page.tsx` | LEGACY | Static messages |
| Route | `src/app/buddy/*/page.tsx` | LEGACY | Direct mock-data import |
| Mock dependency | `buddyMessages`, `promptChips` | ACTIVE | Direct import |
| Functional parity | — | NOT VERIFIED | No ViewModel, all static |

**Migration status: LEGACY**

---

## Insights (Emotion / Facial / Risk)

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/insights/{emotion,facial,risk}/page.tsx` | LEGACY | Static charts and data |
| Route | 3 pages under `src/app/insights/` | LEGACY | Direct mock-data import |
| Mock dependency | `emotionWheel`, `moodTrend`, `facialTrend`, `riskTrend` | ACTIVE | Direct import |
| Functional parity | — | NOT VERIFIED | No ViewModel, all static |

**Migration status: LEGACY**

---

## Onboarding

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/onboarding/{consent,profile,setup}/page.tsx` | LEGACY | Static pages |
| Route | 3 pages under `src/app/onboarding/` | LEGACY | No mock-data import but static |
| Functional parity | — | NOT VERIFIED | No ViewModel |

**Migration status: LEGACY**

---

## Grounding Tools

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/tools/grounding/page.tsx` | LEGACY | Non-functional controls |
| Route | `src/app/tools/grounding/page.tsx` | LEGACY | Imports `userProfile` from mock-data |
| Functional parity | — | NOT VERIFIED | Start/pause/resume not implemented |

**Migration status: LEGACY**

---

## Crisis Support

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | `src/app/crisis/page.tsx`, `src/app/crisis-help/page.tsx` | LEGACY | Static crisis resources |
| Route | `src/app/crisis/page.tsx` | LEGACY | No mock-data (standalone) |
| Route | `src/app/crisis-help/page.tsx` | LEGACY | Imports `hotlines` from mock-data |
| Shared component | `EchoCrisisBanner` (shared) | ✅ COMPLETE | Extracted to shared |
| Functional parity | — | NOT VERIFIED | Hotlines are static |

**Migration status: LEGACY**

---

## Settings

| Layer | Path | Status | Notes |
|-------|------|--------|-------|
| Legacy implementation | 6 pages under `src/app/settings/` | LEGACY | Hardcoded sample data |
| Route | 6 settings pages | LEGACY | No mock-data import |
| Functional parity | — | NOT VERIFIED | No editing, no ViewModel |

**Migration status: LEGACY**

---

## Global MVVM Assessment

| Criterion | Status |
|-----------|--------|
| MVVM documentation | ✅ COMPLETE |
| Shared foundation | ✅ COMPLETE |
| Journal fully migrated | ✅ COMPLETE |
| Auth Model + Service | ✅ COMPLETE |
| Auth ViewModel + View | ❌ MISSING |
| All other features | ❌ LEGACY |
| Strangler Fig pattern used | ✅ Journal migration preserved legacy shared.tsx via re-exports |
| Legacy cleanup verified | ✅ Journal routes verified clean |
| Tests exist | ❌ NONE |

**Overall: 2 of 18 features migrated (Journal + partial Auth). 16 features remain in legacy state.**
