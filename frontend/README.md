# ECHO Frontend

ECHO uses Next.js App Router and is migrating its interactive features to MVVM. Some existing views and pages still perform service calls directly; the structure below is the target dependency flow, not a claim that every feature has finished migrating.

## Source structure

```text
src/
├── app/          Thin route files and framework boundaries
├── features/     Feature-owned Model, ViewModel, View, and components
├── services/     Feature service contracts and HTTP/mock adapters
├── infrastructure/ Shared API, identity, and security integrations
├── shared/       Cross-feature UI, layout, theme, hooks, types, and services
├── config/       Environment, navigation, motion, and feature configuration
├── styles/       Global design tokens, accessibility, and motion styles
└── docs/         Architecture and migration documentation
```

Static features such as the marketing landing page use Model + View without an
empty service or ViewModel layer. Interactive features use the complete flow:

```text
View → ViewModel → Service/HTTP adapter → Backend API
```

Models provide types and validation across these layers. Routes should remain thin and must not import mock data, service adapters, or raw
API responses. Feature-specific UI belongs under `src/features/{feature}`;
cross-feature UI belongs under `src/shared`.

## Canonical guides

- [`MVVM_GUIDE.md`](../docs/frontend/MVVM_GUIDE.md) — MVVM patterns
- [`FRONTEND_ARCHITECTURE.md`](../docs/architecture/FRONTEND_ARCHITECTURE.md) — target structure
- [`MVVM_MIGRATION_STATUS.md`](../docs/frontend/MVVM_MIGRATION_STATUS.md) — historical migration snapshot

Documents explicitly labeled as audits or baselines are historical snapshots,
not the current source of truth.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
```
