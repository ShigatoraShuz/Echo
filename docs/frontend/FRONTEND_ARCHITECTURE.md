# ECHO Frontend Architecture

> HISTORICAL / SUPERSEDED / PRE-MICROSERVICES. Retained as thesis provenance, not current implementation or deployment guidance. See [microservices architecture](../architecture/microservices.md) and [testing](../testing.md) for the active system.

> **Version**: Consolidated Monorepo (MVVM with CRUD Bypass)  
> **Last Updated**: 2026-08-23

---

## Overview

ECHO's frontend follows a strict **MVVM (Model-View-ViewModel)** architecture, organized by feature domain. The dependency hierarchy is:

```
VIEW (React Components / UI Screens)
  ↓
VIEW-MODEL (Custom React Hooks)
  ↓
SERVICES (Domain Workflows, Crypto, Transformers)  [Optional for Fast-Path CRUD]
  ↓
INFRASTRUCTURE (HTTP API Client, Supabase SDK)
  ↓
BACKEND API / AI SERVICE
```

`MODEL` may be used across `VIEW`, `VIEW-MODEL`, and `SERVICES`.  
`SHARED` is strictly domain-agnostic and reusable across all features.

---

## Consolidated Directory Structure

```
frontend/src/
├── app/                   Next.js App Router (routes only — thin presentation wrappers)
├── features/              Feature domains (Model + ViewModel + View + Components)
│   ├── authentication/
│   ├── buddy/
│   ├── dashboard/
│   ├── grounding/
│   ├── insights/
│   ├── journal/
│   ├── landing/
│   ├── onboarding/
│   ├── settings/
│   └── verification/
├── services/              Application & domain service layer (complex orchestration)
├── infrastructure/        External technology (ApiClient, Supabase Client, Auth Providers)
├── config/                App-level configuration & environment variables
├── i18n/                  Internationalization (locales & translation bundles)
├── routes/                Route constant definitions
└── shared/                Consolidated cross-feature reusable code
    ├── components/        Design system atoms, layouts, feedback, a11y primitives
    ├── errors/            AppError, error codes, error normalizers
    ├── hooks/             Cross-cutting hooks (usePrefersReducedMotion, useFocusTrap)
    ├── lib/               Shared utility functions (safe-redirect, formatting)
    ├── styles/            CSS design tokens, motion presets, accessibility rules
    ├── test-utils/        Vitest render utilities, test setups, and axe matchers
    ├── theme/             ThemeProvider, color tokens, contrast checkers
    └── types/             AsyncState, Pagination, Identifier utility types
```

---

## Layer Responsibilities

### 1. `app/` — Next.js App Router
- Contains **only** Next.js file-based routing.
- Pages are thin wrappers that instantiate and render feature Views.
- **Zero business logic** or data-fetching logic permitted.

### 2. `features/` — Feature Domains
Each feature maintains strict internal separation:
```
features/<feature-name>/
├── model/          Domain types, DTOs, Zod schemas, mappers, constants
├── view-model/     Custom React hooks (use[Feature]ViewModel.ts): state, actions, lifecycle
├── view/           Page-level composite screens (e.g., JournalListView, SettingsView)
├── components/     Domain-specific UI components (e.g., JournalCard, MoodSelector)
└── index.ts        Public barrel export
```

### 3. `services/` — Application Service Layer
- Encapsulates multi-entity workflows, domain invariants, client-side encryption/decryption, and data aggregation across services.

### 4. `infrastructure/` — External Technology Boundary
- Low-level network and storage boundaries: typed HTTP client, Supabase client singletons, and authentication token providers.

### 5. `shared/` — Consolidated Reusable Primitives
- Houses all domain-agnostic UI components, design tokens, shared hooks, test utilities, and global error handling.

---

## The "Bypass Rule" (Fast-Path CRUD Operations)

### Motivation
In standard enterprise architectures, strictly mandating an intermediate Service class for simple CRUD operations (e.g., standard item fetching, updating a string field, or deleting a record by ID) creates boilerplate pass-through classes that add indirection without adding business value.

### Formal Rule Definition
For **pure CRUD operations** that do not enforce client-side domain invariants, perform multi-service orchestration, or require client-side encryption/decryption, **the ViewModel is permitted to directly invoke Infrastructure clients (e.g., `apiClient` or Supabase SDK)**.

```
Standard Complex Flow:
View ──> ViewModel ──> Domain Service ──> Infrastructure Client ──> API

Fast-Path CRUD Flow (Bypass Rule):
View ──> ViewModel ─────────────────────> Infrastructure Client ──> API
```

### Decision Matrix

| Scenario / Use Case | Path | Architectural Rationale |
| :--- | :--- | :--- |
| **Simple CRUD** (e.g., Fetch settings, update profile name, delete item) | **ViewModel $\to$ Infrastructure** *(Bypass)* | No client-side domain rules; validation is handled by backend or form schema. |
| **End-to-End Encrypted Journals** | **ViewModel $\to$ Service $\to$ Infrastructure** | Requires key derivation, AES-GCM encryption/decryption, and IV management. |
| **Multi-Resource Workflows** (e.g., Submit onboarding + log analytics + trigger verification) | **ViewModel $\to$ Service $\to$ Infrastructure** | Orchestrates multiple endpoints and handles rollbacks/partial failures. |
| **Complex Aggregations & Transformers** | **ViewModel $\to$ Service $\to$ Infrastructure** | Business logic transforms domain representations before ViewModel consumption. |

### Architectural Guardrails
1. **Business Logic Stays Outside UI Components**: The bypass rule **never** allows the `View` (React component) to call `Infrastructure` or API clients directly. All I/O must remain inside the `ViewModel` (custom hook).
2. **Promotion on Invariant Addition**: If a simple CRUD operation evolves to require client-side transformations, multi-step orchestration, or domain validation, it **must** be promoted to a dedicated Service layer immediately.
3. **Mockability**: Infrastructure clients must implement interface contracts (`ApiClient`, `SupabaseClient`) so ViewModels utilizing the bypass rule remain 100% unit-testable.

---

## Dependency Rules Matrix

| From | May Depend On | Forbidden Dependencies |
| :--- | :--- | :--- |
| `app/` | `features/*/view` | `services/`, `infrastructure/`, `features/*/model` |
| `features/*/view` | `features/*/view-model`, `features/*/components`, `shared/components` | `services/`, `infrastructure/`, direct API calls |
| `features/*/view-model` | `features/*/model`, `services/`, `infrastructure/` *(Bypass)*, `shared/` | `features/*/view`, UI components |
| `features/*/model` | Pure TypeScript types, Zod schemas | React components, hooks, external APIs |
| `services/` | `infrastructure/`, `features/*/model`, `shared/errors` | `features/*/view`, React hooks |
| `infrastructure/` | External libraries (Supabase, Fetch, Axios) | `features/`, `services/` |
| `shared/` | Pure utilities & domain-agnostic components | Any `features/*` or domain-specific code |
