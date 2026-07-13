# ECHO Frontend Architecture

> Version 1.0 — Architecture specification for the ECHO mental wellness web application.

---

## 1. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15 (App Router) | Routing, SSR, SSG, API routes |
| UI Library | React 19 | Component model |
| Language | TypeScript 5.7 (strict) | Type safety |
| Styling | Tailwind CSS 3 + CSS custom properties | Utility-first styling with theme tokens |
| Icons | Lucide React | Consistent iconography |
| Forms | React Hook Form + Zod (to be installed) | Form state and validation |
| Charts | Recharts (to be installed) | Accessible charts |
| Notifications | Sonner or react-hot-toast (to be installed) | Toast notifications |
| Animation | React Bits (to be installed, Phase 4) | Premium visual interactions via ECHO wrappers |

---

## 2. Target Folder Structure

```
frontend/src/
├── app/                          # Next.js App Router — thin page files only
│   ├── (public)/                 # Public routes (landing, about, etc.)
│   ├── (auth)/                   # Authentication routes
│   ├── (onboarding)/             # Onboarding routes
│   ├── (protected)/              # Protected app routes
│   ├── crisis/                   # Crisis support (no layout)
│   ├── layout.tsx                # Root layout with ThemeProvider
│   ├── loading.tsx               # Global loading state
│   ├── error.tsx                 # Global error boundary
│   ├── not-found.tsx             # 404 page
│   └── globals.css               # Global styles + CSS theme tokens
│
├── features/                     # Feature-based MVVM modules
│   ├── authentication/
│   │   ├── model/
│   │   ├── view-model/
│   │   ├── view/
│   │   ├── components/
│   │   └── services/
│   ├── onboarding/
│   ├── dashboard/
│   ├── journal/                  # First MVVM reference implementation
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
├── shared/                       # Shared cross-cutting code
│   ├── components/
│   │   ├── ui/                   # EchoButton, EchoInput, EchoSelect...
│   │   ├── layout/               # EchoCard, PageHeader...
│   │   ├── navigation/           # Sidebar, BottomNav, Breadcrumbs...
│   │   ├── feedback/             # LoadingState, ErrorState, EmptyState, EchoToast...
│   │   ├── forms/                # EchoFormField, EchoCheckbox...
│   │   ├── data-display/         # EchoBadge, EchoAvatar...
│   │   └── react-bits/           # ECHO wrappers around React Bits (Phase 4+)
│   ├── hooks/                    # useDebounce, useMediaQuery, useReducedMotion...
│   ├── services/                 # Shared API client, auth context
│   ├── validation/               # Shared Zod schemas
│   ├── constants/                # Route paths, storage keys, breakpoints
│   ├── types/                    # Shared types (AppError, ApiResponse)
│   ├── utils/                    # cn(), formatDate, truncateText...
│   └── accessibility/            # SkipLink, FocusTrap, screenReaderUtils...
│
├── config/                       # Centralized application configuration
│   ├── navigation.config.ts      # Route definitions, nav link structures
│   ├── theme.config.ts           # Theme variant configs
│   ├── motion.config.ts          # Animation durations, easings
│   ├── feature-flags.config.ts   # Feature gating
│   └── environment.ts            # Environment variable validation
│
├── styles/                       # Additional style files
│   ├── tokens.css                # Design token CSS variables
│   ├── motion.css                # Motion-specific CSS
│   └── accessibility.css         # Accessibility overrides
│
├── docs/                         # Architecture documentation
│   ├── CURRENT_ARCHITECTURE.md   # Pre-MVVM baseline (Phase 0)
│   ├── ROUTES.md                 # Route inventory
│   ├── FEATURE_STATUS.md         # Feature-by-feature status
│   ├── MVVM_GUIDE.md             # MVVM rules and patterns
│   ├── FRONTEND_ARCHITECTURE.md  # This file
│   ├── BACKEND_INTEGRATION.md    # Backend contract + ERD
│   ├── JOURNAL_MVVM_SPEC.md      # Journal feature specification
│   └── ... (more docs in later phases)
│
└── lib/                          # Legacy utilities (to be migrated)
    ├── mock-data.ts              # All mock data (to be replaced by adapters)
    ├── theme.ts                  # Theme types and helpers
    ├── unsplash-images.ts        # Image asset registry
    └── utils.ts                  # cn() utility
```

---

## 3. Route Groups

### Public Routes `(public)`
- `/` — Landing page
- `/about` — About ECHO
- `/privacy-policy` — Privacy policy
- `/terms` — Terms of use
- `/crisis-help` — Crisis resources directory

**Layout:** `PublicShell` (navbar + footer + crisis-action)

### Auth Routes `(auth)`
- `/login` — Login
- `/signup` — Signup
- `/forgot-password` — Password reset request
- `/reset-password` — New password

**Layout:** `AuthShell` (minimal, no footer)

### Onboarding Routes `(onboarding)`
- `/onboarding/consent` — Consent and disclosures
- `/onboarding/profile` — Profile setup
- `/onboarding/setup` — Permissions and completion

**Layout:** `OnboardingShell` (step progress indicator)

### Protected Routes `(protected)`
- `/dashboard` — Main dashboard
- `/journal`, `/journal/new`, `/journal/[id]` — Journal feature
- `/buddy`, `/buddy/history` — Buddy feature
- `/insights/emotion`, `/insights/facial`, `/insights/risk` — Insights
- `/tools/grounding` — Grounding exercises
- `/support/find-help` — Provider directory
- `/settings/profile`, `/settings/privacy`, `/settings/security`,
  `/settings/notifications`, `/settings/export`, `/settings/trusted-contacts` — Settings

**Layout:** `AppShell` (desktop sidebar + mobile bottom nav)

### Crisis Routes (no layout group)
- `/crisis` — Full-screen crisis support

**Layout:** None (standalone, minimal)

---

## 4. Application Shells

| Shell | Components | Purpose |
|-------|-----------|---------|
| `PublicShell` | PublicNavbar, PublicFooter, crisis-action FAB | Public-facing pages |
| `AuthShell` | Minimal header, no footer | Login/signup/reset pages |
| `OnboardingShell` | Step progress indicator, back navigation | Signup flow |
| `AppShell` | Desktop sidebar, mobile bottom nav, user menu, theme control, sync status, crisis shortcut | Authenticated application |
| `SettingsShell` | Settings sidebar, settings header with theme selector | Settings pages |
| `CrisisShell` | Minimal, no chrome, no animation | Crisis support |

---

## 5. Design System Architecture

### Token Categories

| Category | Prefix | Example |
|----------|--------|---------|
| Background | `--bg-*` | `--bg-primary`, `--bg-surface` |
| Foreground | `--fg-*` | `--fg-primary`, `--fg-muted` |
| Primary | `--primary`, `--primary-foreground` | Brand color + contrast |
| Semantic | `--success`, `--warning`, `--danger`, `--crisis` | State colors |
| Mood | `--mood-calm`, `--mood-joy`, `--mood-sadness`, `--mood-anxiety` | Emotion colors |
| Risk | `--risk-low`, `--risk-moderate`, `--risk-elevated` | Risk band colors |
| Border | `--border`, `--border-subtle` | Border colors |
| Focus | `--focus-ring` | Focus indicator |
| Typography | `--font-sans`, `--font-serif` | Font families |
| Spacing | `--space-*` | Spacing scale |
| Radius | `--radius-*` | Border radius scale |
| Shadow | `--shadow-*` | Box shadow scale |
| Motion | `--motion-*` | Duration and easing |
| Z-index | `--z-*` | Layer stacking |

### Theme Variants

| Variant | Base Mode | Character |
|---------|-----------|-----------|
| `echo-calm` | Light | Warm cream, sage green, muted teal |
| `echo-night` | Dark | Deep forest, charcoal, soft cream text |
| `echo-soft` | Light | Pastel wellness palette |
| `echo-focus` | Light/dark | Cleaner productivity contrast |

All variants support 3 modes: `light`, `dark`, `system`.

---

## 6. Component Architecture

### Shared UI Components (Target)

```
shared/components/
├── ui/
│   ├── EchoButton.tsx          # Primary, secondary, ghost, danger variants
│   ├── EchoInput.tsx           # Text input with label, error, icon
│   ├── EchoTextarea.tsx        # Textarea with char count
│   ├── EchoSelect.tsx          # Select dropdown
│   ├── EchoCheckbox.tsx        # Checkbox with label
│   ├── EchoRadioGroup.tsx      # Radio button group
│   └── EchoSwitch.tsx          # Toggle switch
├── layout/
│   ├── EchoCard.tsx            # Card container
│   ├── PageHeader.tsx          # Page title + description + action
│   ├── EchoSection.tsx         # Section wrapper
│   └── EchoDivider.tsx         # Visual divider
├── navigation/
│   ├── AppSidebar.tsx          # Desktop sidebar navigation
│   ├── MobileBottomNav.tsx     # Mobile bottom navigation
│   ├── PublicNavbar.tsx        # Public site navbar
│   ├── PublicFooter.tsx        # Public site footer
│   └── Breadcrumbs.tsx         # Breadcrumb navigation
├── feedback/
│   ├── LoadingState.tsx        # Skeleton loading
│   ├── ErrorState.tsx          # Error with retry
│   ├── EmptyState.tsx          # Empty with icon + action
│   ├── EchoToast.tsx           # Toast notification
│   ├── EchoDialog.tsx          # Modal dialog
│   ├── EchoSheet.tsx           # Slide-out panel
│   ├── EchoBanner.tsx          # Inline banner
│   └── EchoProgress.tsx        # Progress indicator
├── forms/
│   ├── EchoFormField.tsx       # Label + input + error wrapper
│   └── EchoFormSection.tsx     # Form section with title
└── data-display/
    ├── EchoBadge.tsx           # Mood/risk badge
    ├── EchoAvatar.tsx          # User avatar
    └── EchoChart.tsx           # Accessible chart wrapper
```

---

## 7. Error Handling Strategy

### AppError Type

```typescript
export interface AppError {
  code: ErrorCode;
  message: string;        // User-safe message
  detail?: string;        // Debug detail (not rendered to users)
  statusCode?: number;    // HTTP status when applicable
  field?: string;         // Form field this error relates to
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";
```

### Error Flow

```
Service layer
    │
    ▼
Normalized to AppError
    │
    ▼
ViewModel receives AppError, maps to user-safe message
    │
    ▼
View renders error state with retry option
```

### Logging Rules

- Never log journal body content to console
- Never log buddy message content to console
- Never log service-role keys or auth tokens
- Log only: error codes, field names, HTTP status codes, request IDs

---

## 8. Service Adapter Pattern

```
┌──────────────┐
│   ViewModel  │  ← calls service interface
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  JournalService  │  ← typed interface
└──────┬───────┘
       │
       ├──▶ JournalMockAdapter  (development)
       │
       └──▶ JournalHttpAdapter  (production)
```

### Selection Mechanism

```typescript
// config/environment.ts
export const USE_MOCK_ADAPTER = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// features/journal/services/journal.service.ts
import { USE_MOCK_ADAPTER } from "@/config/environment";
import { journalMockAdapter } from "./journal.mock-adapter";
import { journalHttpAdapter } from "./journal.http-adapter";

export const journalService: JournalService = USE_MOCK_ADAPTER
  ? journalMockAdapter
  : journalHttpAdapter;
```

---

## 9. Performance Strategy

- **Server Components** — Use by default; add `"use client"` only where interactivity is needed
- **Lazy loading** — Dynamic imports for charts, animation, and heavy components
- **Memoization** — `useMemo` for expensive derived values, `useCallback` for stable handlers
- **Bundle size** — Avoid loading all icons or all animation components globally
- **CLS prevention** — Fixed aspect ratios for images and skeletons
- **Reduced motion** — Respect `prefers-reduced-motion` everywhere
- **Hydration** — Avoid `suppressHydrationWarning` except in the theme init script

---

## 10. Phase 2 Implementation Status

The following shared foundation has been implemented:

### Configuration (`src/config/`)
- `environment.ts` — Typed `EnvironmentConfig` with validated `NEXT_PUBLIC_*` variables, boolean parsing, and adapter validation
- `routes.config.ts` — All 30+ route constants with a `detail(id)` helper for journal entries
- `navigation.config.ts` — Typed `NavigationEntry` arrays for public, app, settings, mobile, and crisis-action navigation; `findActiveNavigation` helper
- `motion.config.ts` — Centralized duration, easing, stagger, and reveal-distance tokens for future animation
- `feature-flags.config.ts` — Typed `FeatureFlags` object derived from environment, with `isFeatureEnabled` helper

### Shared Error Model (`src/shared/errors/`)
- `error-codes.ts` — 10 error codes as const array and type
- `app-error.ts` — `AppError` class with `code`, `userMessage`, `developerMessage`, `statusCode`, `fieldErrors`, `retryable`, `cause`, `requestId`, `metadata`
- `error-messages.ts` — User-safe default messages for every error code
- `normalize-error.ts` — Normalizer handling AppError, AbortError, TimeoutError, NetworkError, HTTP errors, validation errors, unknown errors, strings, and non-Error thrown values

### Shared Types (`src/shared/types/`)
- `async-state.ts` — Discriminated union `AsyncState<T>` covering idle, loading, loading-more, success, empty, error
- `pagination.ts` — `PaginationState` with `calculatePagination` and `calculateOffset` helpers
- `identifiers.ts` — `EntityId`, `Slug`, and `isEntityId` guard

### Shared Services (`src/shared/services/`)
- `service-result.ts` — Discriminated union `ServiceResult<T>` with `successResult` and `failureResult` helpers
- `auth-token-provider.ts` — `AuthTokenProvider` interface with `getAccessToken`, `refreshAccessToken`, `clearSession`; `nullTokenProvider` for public/mock requests
- `api-client.ts` — Framework-independent typed API client with GET, POST, PATCH, PUT, DELETE; configurable base URL, token injection, AbortSignal, timeout, error normalization, query-parameter support, request IDs
- `service-adapter.ts` — `ServiceAdapter` interface with `isMockAdapter` and `isHttpAdapter` helpers

### Shared Utilities (`src/shared/utils/`)
- `abort-signal.ts` — `composeSignal` combining external AbortSignal with timeout, with proper cleanup
- `boolean.ts` — `parseBooleanStrict` and `isTruthy` helpers

### Not Yet Implemented (deferred to later phases)
- Shared UI components — Phase 3
- React Bits wrappers — Phase 4
- Domain-specific services (Journal, Buddy, etc.) — Phase 3+
- Route groups — Phase 2+
- Application shells — Phase 3
- Form validation library — Phase 3+

## 11. Accessibility Requirements

- WCAG-compliant focus states with custom focus-ring tokens
- Skip-to-content link at top of every shell
- Semantic heading hierarchy (h1 → h2 → h3)
- ARIA labels on all icon-only buttons
- Form validation with accessible error messages
- Keyboard-navigable dialogs with focus trapping
- Accessible charts (data tables alongside visualizations)
- Sufficient color contrast in all theme variants
- No information conveyed through color alone
- Touch targets ≥ 44×44px on mobile
- Reduced-motion support for all animations
- Crisis resources accessible without animation
