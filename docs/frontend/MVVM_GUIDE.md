# ECHO MVVM Architecture Guide

> Version 1.0 — Architecture specification for the ECHO frontend.
> This document defines strict MVVM rules for the Next.js 15 App Router + React 19 implementation.

---

## 1. Architecture Overview

ECHO uses a **feature-based MVVM** (Model-View-ViewModel) architecture.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│    View      │────▶│   ViewModel      │────▶│    Model     │
│  (JSX only)  │     │  (hooks + state) │     │  (types +    │
│              │◀────│                  │◀────│   schemas)   │
└──────────────┘     └──────────────────┘     └──────────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │   Services   │
                     │  (adapters)  │
                     └──────────────┘
```

### Layer Responsibilities

| Layer | Contains | Must Not Contain |
|-------|----------|------------------|
| **Model** | Interfaces, enums, Zod schemas, DTOs, mappers, constants, domain types | JSX, React hooks, API calls, `use client` |
| **ViewModel** | UI state, loading/error/empty states, form state, service calls, data transformation, optimistic updates | Rendered JSX, direct `fetch` calls, direct mock-data imports |
| **View** | Presentational JSX, reusable UI composition, accessibility markup | API calls, environment access, raw backend response transformation, business logic |
| **Service** | Typed interfaces, mock adapter, HTTP adapter, error normalization | React-specific code, JSX, hooks |

---

## 2. Model Layer

### Location

```
features/{feature}/model/
├── {feature}.model.ts     # Domain interfaces and enums
├── {feature}.schema.ts    # Zod validation schemas
├── {feature}.dto.ts       # API DTO types
├── {feature}.mapper.ts    # DTO-to-domain mapping functions
└── {feature}.constants.ts # Domain constants
```

### Rules

1. **No JSX** — Models must never import React or return JSX.
2. **No hooks** — Models must never call `useState`, `useEffect`, or any React hook.
3. **No API calls** — Models must never call `fetch` or import service adapters.
4. **Pure TypeScript** — Models should be pure type definitions, validation, and transformation functions.
5. **Zod required** — Every form input must have a corresponding Zod schema for validation.
6. **Mapper functions** — DTO-to-domain mapping must live in mapper files, not in ViewModels or Views.

### Example

```typescript
// model/journal.model.ts
export type JournalMood = "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  mood: JournalMood;
  emotions: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  privacyStatus: "private" | "shared";
  analysisConsent: boolean;
}

// model/journal.schema.ts
import { z } from "zod";

export const createJournalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Reflection is required"),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  tags: z.array(z.string()).max(10).default([]),
  analysisConsent: z.boolean().default(false),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;

// model/journal.dto.ts
export interface JournalEntryDTO {
  id: string;
  title: string;
  body: string;
  mood: string;
  emotions: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  privacy_status: string;
  analysis_consent: boolean;
}

// model/journal.mapper.ts
import type { JournalEntry, JournalEntryDTO } from "./journal.model";

export function mapJournalEntryDTO(dto: JournalEntryDTO): JournalEntry {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    mood: dto.mood as JournalEntry["mood"],
    emotions: dto.emotions,
    tags: dto.tags,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    privacyStatus: dto.privacy_status as JournalEntry["privacyStatus"],
    analysisConsent: dto.analysis_consent,
  };
}
```

---

## 3. ViewModel Layer

### Location

```
features/{feature}/view-model/
├── use-{feature}-view-model.ts
└── use-{feature}-detail-view-model.ts
```

### Rules

1. **Custom hooks only** — ViewModels are custom React hooks. They return state and handlers.
2. **No rendered JSX** — ViewModel hooks must not return JSX elements.
3. **State management** — Use `useState`, `useReducer`, or lightweight state (not Redux or Zustand unless justified).
4. **Service calls** — ViewModels call service methods through the typed service interface.
5. **Loading states** — Every async operation must track `isLoading`, `error`, and `data` states.
6. **Empty states** — Every list or search must handle the empty result case.
7. **Error normalization** — Errors from services must be normalized to user-safe messages.
8. **Optimistic updates** — Where appropriate, update UI optimistically and roll back on failure.
9. **Data transformation** — Raw service responses must be transformed for presentation in the ViewModel, not in the View.
10. **No model imports** — ViewModels import models (types, schemas, mappers) but Views import only the ViewModel.

### Example

```typescript
// view-model/use-journal-list-view-model.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import type { JournalEntry, JournalSearchFilters, JournalSortOption } from "../model/journal.model";
import { journalService } from "../services/journal.service";

export interface JournalListState {
  entries: JournalEntry[];
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  filters: JournalSearchFilters;
  sort: JournalSortOption;
  searchQuery: string;
}

export function useJournalListViewModel() {
  const [state, setState] = useState<JournalListState>({
    entries: [],
    isLoading: true,
    error: null,
    isEmpty: false,
    filters: {},
    sort: "newest",
    searchQuery: "",
  });

  // ... handlers that call journalService and update state

  return {
    ...state,
    setSearchQuery,
    setFilters,
    setSort,
    refresh,
    loadMore,
    deleteEntry,
  };
}
```

---

## 4. View Layer

### Location

```
features/{feature}/view/
├── {feature}-list-view.tsx
├── {feature}-editor-view.tsx
└── {feature}-detail-view.tsx
```

### Rules

1. **Presentation only** — Views render JSX and receive state/handlers from ViewModels.
2. **No direct service calls** — Views must never call `fetch` or import services.
3. **No direct mock-data imports** — Views must never import from `mock-data.ts`.
4. **No environment access** — Views must never read `process.env` or environment variables.
5. **No raw data transformation** — Views must not transform API payloads.
6. **Accessibility** — Every View must include proper ARIA labels, semantic HTML, keyboard navigation, and focus management.
7. **State coverage** — Every View must handle loading, error, empty, and success states.
8. **Composition** — Views compose reusable UI components from `shared/components/`.

### Example

```typescript
// view/journal-list-view.tsx
import { JournalCard } from "../components/journal-card";
import { JournalFilters } from "../components/journal-filters";
import { JournalEmptyState } from "../components/journal-empty-state";
import { LoadingState, ErrorState } from "@/shared/components/feedback";
import type { useJournalListViewModel } from "../view-model/use-journal-list-view-model";

interface JournalListViewProps {
  viewModel: ReturnType<typeof useJournalListViewModel>;
}

export function JournalListView({ viewModel }: JournalListViewProps) {
  const { entries, isLoading, error, isEmpty, filters, sort, searchQuery,
    setSearchQuery, setFilters, setSort, deleteEntry } = viewModel;

  if (isLoading) return <LoadingState label="Loading journal entries..." />;
  if (error) return <ErrorState title="Unable to load entries" description={error} onRetry={viewModel.refresh} />;
  if (isEmpty) return <JournalEmptyState />;

  return (
    <div>
      <JournalFilters
        search={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {entries.map((entry) => (
          <JournalCard key={entry.id} entry={entry} onDelete={deleteEntry} />
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Service Layer

### Location

```
features/{feature}/services/
├── {feature}.service.ts       # Typed service interface + injection
├── {feature}.mock-adapter.ts  # Mock implementation for development
└── {feature}.http-adapter.ts  # HTTP implementation for production
```

### Rules

1. **Typed interfaces** — Every service must define a TypeScript interface for its contract.
2. **Adapter pattern** — Mock and HTTP adapters implement the same interface. The active adapter is selected via environment config.
3. **No React code** — Services must not import React or use hooks.
4. **Error normalization** — Services must normalize errors to `AppError` type before returning.
5. **Cancellation support** — Async operations should support `AbortSignal` where appropriate.
6. **Isolation** — Mock adapters must never be imported by Views or ViewModels directly.

### Example

```typescript
// services/journal.service.ts
import type { JournalEntry, CreateJournalInput, UpdateJournalInput } from "../model/journal.model";
import type { AppError } from "@/shared/types/error.types";

export interface JournalService {
  listEntries(params?: {
    search?: string;
    mood?: string;
    sort?: string;
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<{ entries: JournalEntry[]; total: number } | AppError>;

  getEntry(id: string, signal?: AbortSignal): Promise<JournalEntry | AppError>;
  createEntry(input: CreateJournalInput): Promise<JournalEntry | AppError>;
  updateEntry(id: string, input: UpdateJournalInput): Promise<JournalEntry | AppError>;
  deleteEntry(id: string): Promise<{ success: boolean } | AppError>;
  saveDraft(input: Partial<CreateJournalInput>): Promise<{ id: string } | AppError>;
  requestAnalysis(id: string): Promise<{ status: string } | AppError>;
  getAnalysis(id: string): Promise<JournalAnalysis | AppError>;
  exportEntry(id: string, format: "pdf" | "txt"): Promise<Blob | AppError>;
}
```

---

## 6. Next.js 15 App Router Integration

### Server Component Rules

| Use Case | Strategy |
|----------|----------|
| Static content pages | Server Component (default) — `(public)` route group |
| Data fetching for SEO | Server Component with async data fetch |
| Initial page load data | Server Component → pass serialized data to Client View via props |
| Route metadata | `generateMetadata` in Server page files |
| Static generation | `generateStaticParams` in Server page files |

### Client Component Rules

| Use Case | Strategy |
|----------|----------|
| Interactive features | Client Component — `"use client"` at the View or ViewModel level |
| Forms | Client Component — form state requires interactivity |
| Search/filter controls | Client Component |
| Real-time updates | Client Component |
| Theme controls | Client Component |

### Where `"use client"` Is Allowed

- ViewModel hooks (they use React hooks)
- View components that use ViewModel hooks
- Shared interactive components (buttons, inputs, dialogs, toasts)
- Theme provider context
- Error boundary

### How Pages Stay Thin

```typescript
// app/journal/page.tsx — Server Component
import { JournalListView } from "@/features/journal/view/journal-list-view";

export const metadata = { title: "Journal — ECHO" };

export default function JournalPage() {
  // Server can provide initial data here
  // ViewModel handles client-side interactivity
  return <JournalListView />;
}
```

```typescript
// features/journal/view/journal-list-view.tsx — Client Component
"use client";

import { useJournalListViewModel } from "../view-model/use-journal-list-view-model";

export function JournalListView() {
  const viewModel = useJournalListViewModel();
  // ... render viewModel state
}
```

### Integration with Shells

- `loading.tsx` — Shown during route transitions; can show feature-specific skeleton
- `error.tsx` — Global error boundary; feature-specific errors handled in View/ViewModel
- `not-found.tsx` — 404 handler; individual `notFound()` calls in page files for invalid IDs

---

## 7. Shared Layer

```
shared/
├── components/
│   ├── ui/           # EchoButton, EchoInput, EchoSelect, EchoTextarea
│   ├── layout/       # EchoCard, PageHeader, EchoSection
│   ├── navigation/   # Sidebar, BottomNav, Breadcrumbs
│   ├── feedback/     # LoadingState, ErrorState, EmptyState, EchoToast, EchoDialog
│   ├── forms/        # EchoFormField, EchoCheckbox, EchoRadioGroup
│   ├── data-display/ # EchoBadge, EchoAvatar, EchoProgress, EchoChart
│   └── react-bits/   # EchoReveal, EchoFade, EchoCountUp (Phase 4+)
├── hooks/            # useDebounce, useMediaQuery, useReducedMotion, useLocalStorage
├── services/         # Shared API client, auth context, error handler
├── validation/       # Shared Zod schemas, validation helpers
├── constants/        # Route paths, storage keys, breakpoints
├── types/            # Shared domain types, AppError, ApiResponse
├── utils/            # cn(), formatDate, truncateText, sanitizeHtml
└── accessibility/    # SkipLink, FocusTrap, useFocusTrap, screenReaderAnnouncements
```

---

## 8. File Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Model types | `{feature}.model.ts` | `journal.model.ts` |
| Zod schemas | `{feature}.schema.ts` | `journal.schema.ts` |
| DTO types | `{feature}.dto.ts` | `journal.dto.ts` |
| Mappers | `{feature}.mapper.ts` | `journal.mapper.ts` |
| Constants | `{feature}.constants.ts` | `journal.constants.ts` |
| ViewModel | `use-{feature}-view-model.ts` | `use-journal-list-view-model.ts` |
| View | `{feature}-view.tsx` | `journal-list-view.tsx` |
| Service | `{feature}.service.ts` | `journal.service.ts` |
| Mock adapter | `{feature}.mock-adapter.ts` | `journal.mock-adapter.ts` |
| HTTP adapter | `{feature}.http-adapter.ts` | `journal.http-adapter.ts` |
| Shared component | `Echo{Name}.tsx` | `EchoButton.tsx` |

---

## 9. Anti-Patterns

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Importing mock-data.ts in a View | Breaks MVVM isolation, impossible to swap to real backend | Import only through service → adapter |
| Calling fetch() in a page file | Ties page to HTTP, breaks SSR/testing | Call through service layer |
| Placing business logic in JSX | Untestable, hard to refactor | Move to ViewModel |
| Transforming API responses in a View | View becomes coupled to API shape | Transform in mapper or ViewModel |
| Using `any` | Loses type safety | Use proper types or `unknown` with guards |
| Converting all pages to Client Components | Increases bundle size, breaks SSR | Keep pages as Server Components, use Client only for interactive parts |
| Exposing service-role keys in browser | Security violation | All Supabase calls go through backend API |
| Storing raw journal text in localStorage | Privacy risk | Store only non-sensitive metadata locally |
