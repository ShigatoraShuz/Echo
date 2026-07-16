# ECHO Frontend

ECHO uses Next.js App Router with a feature-based MVVM architecture.

## Source structure

```text
src/
├── app/          Thin route files and framework boundaries
├── features/     Feature-owned Model, ViewModel, View, components, and services
├── shared/       Cross-feature UI, layout, theme, hooks, types, and services
├── config/       Environment, navigation, motion, and feature configuration
├── styles/       Global design tokens, accessibility, and motion styles
└── docs/         Architecture and migration documentation
```

Static features such as the marketing landing page use Model + View without an
empty service or ViewModel layer. Interactive features use the complete flow:

```text
View → ViewModel → Service → Model
```

Routes must remain thin and must not import mock data, service adapters, or raw
API responses. Feature-specific UI belongs under `src/features/{feature}`;
cross-feature UI belongs under `src/shared`.

## Canonical guides

- [`src/docs/MVVM_GUIDE.md`](src/docs/MVVM_GUIDE.md) — architecture rules
- [`src/docs/MVVM_MIGRATION_STATUS.md`](src/docs/MVVM_MIGRATION_STATUS.md) — current migration state
- [`src/docs/FRONTEND_ARCHITECTURE.md`](src/docs/FRONTEND_ARCHITECTURE.md) — target structure
- [`src/docs/ROUTES.md`](src/docs/ROUTES.md) — route inventory

Documents explicitly labeled as audits or baselines are historical snapshots,
not the current source of truth.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
```
