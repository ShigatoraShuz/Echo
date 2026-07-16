# ECHO MVVM Skill

> Version 2.0 — Comprehensive MVVM skill for the ECHO frontend (Next.js 15 App Router + React 19 + TypeScript 5.7 strict).
> Load this skill when creating new features, migrating legacy code, or generating MVVM-compliant files.

---

## 1. Architecture Overview

ECHO uses a **feature-based MVVM** (Model-View-ViewModel) architecture with four layers:

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

## 2. Feature Directory Structure

Every feature lives under `features/{feature}/` and follows this exact structure:

```
features/{feature}/
├── model/
│   ├── {feature}.model.ts           # Domain interfaces and enums
│   ├── {feature}.schema.ts          # Zod validation schemas
│   ├── {feature}.dto.ts             # API DTO types
│   ├── {feature}.mapper.ts          # DTO-to-domain mapping functions
│   ├── {feature}.constants.ts       # Domain constants
│   └── index.ts                     # Public exports
├── services/
│   ├── {feature}.service.ts         # Typed service interface
│   ├── {feature}.mock-adapter.ts    # Mock implementation
│   ├── {feature}.http-adapter.ts    # HTTP implementation (future)
│   ├── {feature}-service.factory.ts # Env-driven adapter selection
│   └── index.ts                     # Public exports
├── view-model/
│   ├── use-{feature}-list-view-model.ts
│   ├── use-{feature}-editor-view-model.ts
│   ├── use-{feature}-detail-view-model.ts
│   ├── index.ts                     # Public exports
│   └── ...test.ts                   # Co-located tests
├── view/
│   ├── {feature}-list-view.tsx
│   ├── {feature}-editor-view.tsx
│   ├── {feature}-detail-view.tsx
│   └── index.ts                     # Public exports
├── components/
│   ├── {feature}-card.tsx
│   ├── {feature}-filters.tsx
│   ├── {feature}-empty-state.tsx
│   ├── {feature}-delete-dialog.tsx
│   └── index.ts                     # Public exports
└── index.ts                         # Barrel exports for the feature
```

### File Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Model types | `{feature}.model.ts` | `auth.model.ts` |
| Zod schemas | `{feature}.schema.ts` | `auth.schema.ts` |
| DTO types | `{feature}.dto.ts` | `auth.dto.ts` |
| Mappers | `{feature}.mapper.ts` | `auth.mapper.ts` |
| Constants | `{feature}.constants.ts` | `auth.constants.ts` |
| ViewModel | `use-{feature}-view-model.ts` | `use-login-view-model.ts` |
| View | `{feature}-view.tsx` | `login-view.tsx` |
| Service interface | `{feature}.service.ts` | `auth.service.ts` |
| Mock adapter | `{feature}.mock-adapter.ts` | `auth.mock-adapter.ts` |
| HTTP adapter | `{feature}.http-adapter.ts` | `auth.http-adapter.ts` |
| Service factory | `{feature}-service.factory.ts` | `auth-service.factory.ts` |
| Feature component | `{feature}-{name}.tsx` | `journal-card.tsx` |

---

## 3. Model Layer

### Rules
1. **No JSX** — Never import React or return JSX.
2. **No hooks** — Never call `useState`, `useEffect`, or any React hook.
3. **No API calls** — Never call `fetch` or import service adapters.
4. **Pure TypeScript** — Pure type definitions, validation, and transformation functions.
5. **Zod required** — Every form input must have a corresponding Zod schema.
6. **Mapper functions** — DTO-to-domain mapping must live in mapper files.

### Template: `{feature}.model.ts`

```typescript
// ─── Enums / Union Types ──────────────────────────────

export type FeatureStatus = "active" | "inactive" | "pending";

// ─── Domain Interfaces ────────────────────────────────

export interface FeatureEntity {
  id: string;
  name: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Input Types ───────────────────────────────────────

export interface CreateFeatureInput {
  name: string;
  status: FeatureStatus;
}

export interface UpdateFeatureInput {
  name?: string;
  status?: FeatureStatus;
}

// ─── Filter and Sort Types ────────────────────────────

export interface FeatureFilters {
  search?: string;
  status?: FeatureStatus;
  sort?: "newest" | "oldest" | "name";
}

// ─── State Types ───────────────────────────────────────

export interface FeatureListState {
  items: FeatureEntity[];
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  filters: FeatureFilters;
}

// ─── Service Error ────────────────────────────────────

export type FeatureServiceErrorCode = "NOT_FOUND" | "VALIDATION" | "NETWORK" | "CONFLICT" | "UNKNOWN";

export interface FeatureServiceError {
  code: FeatureServiceErrorCode;
  message: string;
  field?: string;
}
```

### Template: `{feature}.schema.ts`

```typescript
import { z } from "zod";

export const featureStatusSchema = z.enum(["active", "inactive", "pending"]);

export const createFeatureSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  status: featureStatusSchema,
});

export const updateFeatureSchema = createFeatureSchema.partial();

export const featureFilterSchema = z.object({
  search: z.string().max(200).optional(),
  status: featureStatusSchema.optional(),
  sort: z.enum(["newest", "oldest", "name"]).optional(),
});

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
```

### Template: `{feature}.dto.ts`

```typescript
// ─── API Response DTOs ────────────────────────────────

export interface FeatureEntityDTO {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureListResponseDTO {
  items: FeatureEntityDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─── API Request DTOs ────────────────────────────────

export interface CreateFeatureRequestDTO {
  name: string;
  status: string;
}

export interface UpdateFeatureRequestDTO {
  name?: string;
  status?: string;
}
```

### Template: `{feature}.mapper.ts`

```typescript
import type { FeatureEntity, FeatureStatus } from "./{feature}.model";
import type { FeatureEntityDTO } from "./{feature}.dto";

export function mapFeatureDTO(dto: FeatureEntityDTO): FeatureEntity {
  return {
    id: dto.id,
    name: dto.name,
    status: dto.status as FeatureStatus,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
```

### Template: `{feature}.constants.ts`

```typescript
export const FEATURE_PAGE_SIZE = 12;

export const FEATURE_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Item not found.",
  VALIDATION: "Please check your input and try again.",
  NETWORK: "Unable to connect. Check your connection and try again.",
  CONFLICT: "This item was updated by another session. Please refresh.",
  UNKNOWN: "Something went wrong. Please try again.",
};
```

---

## 4. Service Layer

### Rules
1. **Typed interfaces** — Define a TypeScript interface for the service contract.
2. **ServiceResult<T> discriminated union** — All methods return `{ success: true; data: T } | { success: false; error: FeatureServiceError }`.
3. **Adapter pattern** — Mock and HTTP adapters implement the same interface.
4. **No React code** — Never import React or use hooks.
5. **Error normalization** — Normalize errors to typed error objects.
6. **Cancellation support** — Accept `AbortSignal` where appropriate.
7. **Isolation** — Mock adapters must never be imported by Views or ViewModels directly.

### Template: `{feature}.service.ts`

```typescript
import type {
  FeatureEntity,
  CreateFeatureInput,
  UpdateFeatureInput,
  FeatureFilters,
  FeaturePagination,
  FeatureServiceError,
} from "../model/{feature}.model";

export type FeatureServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: FeatureServiceError };

export interface FeatureService {
  list(
    filters: FeatureFilters,
    page: number,
    pageSize: number,
    signal?: AbortSignal
  ): Promise<FeatureServiceResult<{ items: FeatureEntity[]; pagination: FeaturePagination }>>;

  getById(id: string, signal?: AbortSignal): Promise<FeatureServiceResult<FeatureEntity>>;

  create(input: CreateFeatureInput): Promise<FeatureServiceResult<FeatureEntity>>;

  update(id: string, input: UpdateFeatureInput): Promise<FeatureServiceResult<FeatureEntity>>;

  delete(id: string): Promise<FeatureServiceResult<void>>;
}
```

### Template: `{feature}-service.factory.ts`

```typescript
import type { FeatureService } from "./{feature}.service";
import { createFeatureMockAdapter } from "./{feature}.mock-adapter";
import { createFeatureHttpAdapter } from "./{feature}.http-adapter";
import { env } from "@/config/environment";

let instance: FeatureService | null = null;

export function getFeatureService(): FeatureService {
  if (instance) return instance;

  instance = env.dataAdapter === "mock"
    ? createFeatureMockAdapter()
    : createFeatureHttpAdapter();

  return instance;
}

export function resetFeatureService(): void {
  instance = null;
}
```

### Template: `{feature}.mock-adapter.ts`

Key patterns observed in the codebase:
- Use a `createStore()` function for encapsulated in-memory data.
- Simulate network delay with a `delay(ms)` helper (200–800ms range).
- Return `FeatureServiceResult<T>` discriminated union.
- Support search, filter, sort, and pagination in list methods.
- Check `signal?.aborted` before processing results.
- No console.log of sensitive data (journal body, messages, etc.).

```typescript
import type { FeatureEntity, CreateFeatureInput, UpdateFeatureInput, FeatureFilters, FeaturePagination } from "../model/{feature}.model";
import type { FeatureService, FeatureServiceResult } from "./{feature}.service";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function createStore() {
  let nextId = 1;
  const items: FeatureEntity[] = [
    // Seed data here
  ];
  return { items, nextId: () => `feat-${nextId++}` };
}

const store = createStore();
const items = store.items;
const getNextId = store.nextId;

export function createFeatureMockAdapter(): FeatureService {
  const service: FeatureService = {
    async list(filters, page, pageSize, signal) {
      await delay(150 + Math.random() * 200);
      if (signal?.aborted) return { success: false, error: { code: "NETWORK", message: "Request was cancelled" } };

      let filtered = [...items];
      // Apply search, filter, sort logic here...

      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);

      return {
        success: true,
        data: {
          items: paged,
          pagination: { page: safePage, pageSize, totalItems, totalPages },
        },
      };
    },

    async getById(id) {
      await delay(100 + Math.random() * 100);
      const item = items.find((i) => i.id === id);
      if (!item) return { success: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      return { success: true, data: item };
    },

    async create(input) {
      await delay(200 + Math.random() * 200);
      const now = new Date().toISOString().split("T")[0];
      const item: FeatureEntity = {
        id: getNextId(),
        name: input.name,
        status: input.status,
        createdAt: now,
        updatedAt: now,
      };
      items.unshift(item);
      return { success: true, data: item };
    },

    async update(id, input) {
      await delay(150 + Math.random() * 100);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      items[idx] = { ...items[idx], ...input, updatedAt: new Date().toISOString().split("T")[0] };
      return { success: true, data: items[idx] };
    },

    async delete(id) {
      await delay(100);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return { success: false, error: { code: "NOT_FOUND", message: "Item not found" } };
      items.splice(idx, 1);
      return { success: true, data: undefined };
    },
  };

  return service;
}
```

### Template: `{feature}.http-adapter.ts`

```typescript
import type { FeatureService, FeatureServiceResult } from "./{feature}.service";
import type { CreateFeatureInput, UpdateFeatureInput, FeatureFilters, FeatureEntity } from "../model/{feature}.model";
import { env } from "@/config/environment";

export function createFeatureHttpAdapter(): FeatureService {
  const baseUrl = `${env.apiBaseUrl}/api/v1/{feature}`;

  async function request<T>(path: string, options?: RequestInit): Promise<FeatureServiceResult<T>> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!response.ok) {
        return { success: false, error: { code: "NETWORK", message: `HTTP ${response.status}` } };
      }
      return { success: true, data: await response.json() };
    } catch {
      return { success: false, error: { code: "NETWORK", message: "Unable to connect" } };
    }
  }

  return {
    async list(filters, page, pageSize, signal) {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      return request(`?${params}`, { signal });
    },
    async getById(id, signal) {
      return request(`/${id}`, { signal });
    },
    async create(input) {
      return request("", { method: "POST", body: JSON.stringify(input) });
    },
    async update(id, input) {
      return request(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    async delete(id) {
      return request(`/${id}`, { method: "DELETE" });
    },
  };
}
```

---

## 5. ViewModel Layer

### Rules
1. **Custom hooks** — ViewModels are custom React hooks (`"use client"`).
2. **`useReducer` over `useState`** — Use `useReducer` for complex state (lists, forms, detail views).
3. **No rendered JSX** — Never return JSX elements.
4. **State management** — Use `useState`/`useReducer` only (no Redux/Zustand).
5. **Service calls** — Call service methods through the typed service interface via the factory.
6. **Loading states** — Every async operation must track loading/error/data.
7. **Empty states** — Every list/search must handle the empty result case.
8. **Error normalization** — Map service errors to user-safe messages.
9. **Data transformation** — Transform raw service responses for presentation in the ViewModel.
10. **AbortController** — Use `AbortController` + `useRef` for request cancellation.
11. **No model imports** — ViewModels import models; Views import only the ViewModel.

### Pattern: `useReducer` + AbortController

Every list ViewModel should follow this exact pattern:

```typescript
"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { FeatureEntity, FeatureFilters } from "../model/{feature}.model";
import { getFeatureService } from "../services/{feature}-service.factory";

interface ListState {
  items: FeatureEntity[];
  isLoading: boolean;
  error: string | null;
  filters: FeatureFilters;
}

type ListAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; items: FeatureEntity[]; pagination: FeaturePagination }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_FILTERS"; filters: Partial<FeatureFilters> }
  | { type: "DELETE_ITEM"; id: string };

function reducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, items: action.items };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "SET_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "DELETE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    default:
      return state;
  }
}

const initialState: ListState = {
  items: [],
  isLoading: true,
  error: null,
  filters: {},
};

export function useFeatureListViewModel() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const service = getFeatureService();
  const abortRef = useRef<AbortController | null>(null);

  const loadItems = useCallback(async (filters: FeatureFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "LOAD_START" });
    const result = await service.list(filters, 1, 20, controller.signal);
    if (controller.signal.aborted) return;

    if (result.success) {
      dispatch({ type: "LOAD_SUCCESS", items: result.data.items, pagination: result.data.pagination });
    } else {
      dispatch({ type: "LOAD_ERROR", error: result.error.message });
    }
  }, [service]);

  useEffect(() => {
    loadItems(state.filters);
  }, [state.filters, loadItems]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const setFilters = useCallback((partial: Partial<FeatureFilters>) => {
    dispatch({ type: "SET_FILTERS", filters: partial });
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const result = await service.delete(id);
    if (result.success) {
      dispatch({ type: "DELETE_ITEM", id });
    }
  }, [service]);

  const retry = useCallback(() => {
    loadItems(state.filters);
  }, [loadItems, state.filters]);

  return {
    items: state.items,
    isLoading: state.isLoading,
    error: state.error,
    isEmpty: !state.isLoading && !state.error && state.items.length === 0,
    filters: state.filters,
    setFilters,
    deleteItem,
    retry,
  };
}
```

### Form ViewModel Pattern (with Zod validation)

```typescript
"use client";

import { useCallback, useReducer } from "react";
import { getFeatureService } from "../services/{feature}-service.factory";
import { createFeatureSchema } from "../model/{feature}.schema";
import type { CreateFeatureInput } from "../model/{feature}.model";

export type FormStatus = "idle" | "submitting" | "success" | "error";

interface FormState {
  name: string;
  status: FeatureStatus;
  status: FormStatus;
  error: string | null;
  fieldErrors: Record<string, string[]>;
}

type FormAction =
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "SET_FIELD_ERRORS"; fieldErrors: Record<string, string[]> }
  | { type: "RESET" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, error: null, fieldErrors: {} };
    case "SUBMIT_START":
      return { ...state, status: "submitting", error: null, fieldErrors: {} };
    case "SUBMIT_SUCCESS":
      return { ...state, status: "success" };
    case "SUBMIT_ERROR":
      return { ...state, status: "error", error: action.error };
    case "SET_FIELD_ERRORS":
      return { ...state, status: "idle", fieldErrors: action.fieldErrors };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

const initialState: FormState = {
  name: "",
  status: "active",
  status: "idle",
  error: null,
  fieldErrors: {},
};

export function useFeatureFormViewModel() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const service = getFeatureService();

  const setField = useCallback((field: string, value: string) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const submit = useCallback(async () => {
    const validation = createFeatureSchema.safeParse({
      name: state.name,
      status: state.status,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      }
      dispatch({ type: "SET_FIELD_ERRORS", fieldErrors });
      return null;
    }

    dispatch({ type: "SUBMIT_START" });
    const result = await service.create(validation.data as CreateFeatureInput);
    if (result.success) {
      dispatch({ type: "SUBMIT_SUCCESS" });
      return result.data;
    }
    dispatch({ type: "SUBMIT_ERROR", error: result.error.message });
    return null;
  }, [state.name, state.status, service]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    ...state,
    setField,
    submit,
    reset,
  };
}
```

---

## 6. View Layer

### Rules
1. **Presentation only** — Render JSX, receive state/handlers from ViewModels.
2. **No direct service calls** — Never call `fetch` or import services.
3. **No direct mock-data imports** — Never import from `mock-data.ts`.
4. **No environment access** — Never read `process.env`.
5. **No raw data transformation** — Transform in ViewModel or mapper, not in View.
6. **Accessibility** — ARIA labels, semantic HTML, keyboard navigation, focus management.
7. **State coverage** — Every View must handle loading, error, empty, and success states.
8. **Composition** — Compose reusable UI components from `shared/components/`.

### Template: `{feature}-list-view.tsx`

```typescript
"use client";

import { useFeatureListViewModel } from "../view-model/use-feature-list-view-model";
import { FeatureCard } from "../components/feature-card";
import { FeatureEmptyState } from "../components/feature-empty-state";
import { EchoLoadingState } from "@/shared/components/feedback/echo-loading-state";
import { EchoErrorState } from "@/shared/components/feedback/echo-error-state";
import { EchoPageHeading } from "@/shared/components/data-display/echo-page-heading";

export function FeatureListView() {
  const {
    items,
    isLoading,
    error,
    isEmpty,
    deleteItem,
    retry,
  } = useFeatureListViewModel();

  if (error && items.length === 0) {
    return (
      <EchoErrorState
        title="Could not load items"
        message={error}
        onRetry={retry}
      />
    );
  }

  return (
    <div>
      <EchoPageHeading
        title="Feature title"
        description="Feature description text."
      />

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <EchoLoadingState variant="skeleton" count={6} />
        ) : isEmpty ? (
          <FeatureEmptyState />
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {items.map((item) => (
              <FeatureCard key={item.id} item={item} onDelete={deleteItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### State Coverage Checklist for Every View

For every view, implement these branches in order:

```
1. ERROR (no data)   → <EchoErrorState title="..." message={error} onRetry={retry} />
2. LOADING           → <EchoLoadingState variant="skeleton" count={N} />
3. EMPTY             → <FeatureEmptyState />
4. SUCCESS with data → Render items
5. ERROR (has data)  → Show inline error banner + data
```

Always check error before loading, so stale error states are not masked by a loading indicator.

---

## 7. Component Layer

Feature-specific components live in `features/{feature}/components/`. They are presentational — they receive data and callbacks via props, and never import ViewModels or services.

### Template: `{feature}-card.tsx`

```typescript
import type { FeatureEntity } from "../model/{feature}.model";
import { EchoCard } from "@/shared/components/layout/echo-card";

interface FeatureCardProps {
  item: FeatureEntity;
  onDelete: (id: string) => void;
}

export function FeatureCard({ item, onDelete }: FeatureCardProps) {
  return (
    <EchoCard>
      <h3 className="text-lg font-semibold">{item.name}</h3>
      <p className="text-muted-foreground">{item.status}</p>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={`Delete ${item.name}`}
      >
        Delete
      </button>
    </EchoCard>
  );
}
```

### Template: `{feature}-empty-state.tsx`

```typescript
import { Inbox } from "lucide-react";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";

interface FeatureEmptyStateProps {
  isFiltered?: boolean;
}

export function FeatureEmptyState({ isFiltered }: FeatureEmptyStateProps) {
  if (isFiltered) {
    return (
      <EchoEmptyState
        icon={<Inbox className="h-12 w-12" />}
        title="No items match your filters"
        description="Try adjusting your search or filter criteria."
      />
    );
  }

  return (
    <EchoEmptyState
      icon={<Inbox className="h-12 w-12" />}
      title="No items yet"
      description="Get started by creating your first item."
    />
  );
}
```

---

## 8. Next.js Page Integration

Pages must be thin — 3–15 lines, importing the feature View and forwarding no props (the View calls its own ViewModel).

### Public / Auth Pages

```typescript
// app/login/page.tsx
import { LoginView } from "@/features/authentication/view/login-view";

export const metadata = { title: "Login — ECHO" };

export default function LoginPage() {
  return <LoginView />;
}
```

### Protected Pages (Journal, Dashboard, etc.)

```typescript
// app/journal/page.tsx — Server Component (default)
import { JournalListView } from "@/features/journal/view/journal-list-view";

export const metadata = { title: "Journal — ECHO" };

export default function JournalPage() {
  return <JournalListView />;
}
```

### Detail Pages (with params)

```typescript
// app/journal/[id]/page.tsx
import { notFound } from "next/navigation";
import { JournalDetailView } from "@/features/journal/view/journal-detail-view";

export const metadata = { title: "Journal entry — ECHO" };

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id || typeof id !== "string") notFound();
  return <JournalDetailView entryId={id} />;
}
```

### Where `"use client"` Is Allowed

- ViewModel hooks
- View components that use ViewModel hooks
- Shared interactive components (buttons, inputs, dialogs, toasts)
- Theme provider context
- Error boundary

Page files are **always** Server Components by default.

---

## 9. Error Handling Flow

```
Service layer (mock/http adapter)
    │
    ▼
Normalizes to FeatureServiceResult (discriminated union)
    │
    ▼
ViewModel receives result, extracts user-safe message
    │
    ▼
View renders:
  - <EchoErrorState> when no data and error
  - Inline error banner when has data and error
  - Error message per field for forms
```

### Service Result Pattern

```typescript
// Always return this discriminated union from service methods:
type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

### ViewModel Error Handling

```typescript
const result = await service.list(filters, page, pageSize, signal);
if (controller.signal.aborted) return;  // Check cancellation first

if (result.success) {
  dispatch({ type: "LOAD_SUCCESS", items: result.data.items });
} else {
  dispatch({ type: "LOAD_ERROR", error: result.error.message });
}
```

### View Error Rendering

```typescript
// When there's no data at all — full error state
if (error && items.length === 0) {
  return <EchoErrorState title="..." message={error} onRetry={retry} />;
}

// When there's data but a background error — inline banner
if (error && items.length > 0) {
  return (
    <>
      <EchoStatusBanner variant="warning" message={error} onDismiss={clearError} />
      {/* render items */}
    </>
  );
}
```

---

## 10. Feature Barrel Exports

### Template: `features/{feature}/model/index.ts`

```typescript
export type { FeatureEntity, FeatureFilters } from "./{feature}.model";
export { createFeatureSchema, updateFeatureSchema } from "./{feature}.schema";
export type { CreateFeatureInput, UpdateFeatureInput } from "./{feature}.schema";
export { mapFeatureDTO } from "./{feature}.mapper";
export { FEATURE_ERROR_MESSAGES, FEATURE_PAGE_SIZE } from "./{feature}.constants";
```

### Template: `features/{feature}/services/index.ts`

```typescript
export type { FeatureService, FeatureServiceResult } from "./{feature}.service";
export { getFeatureService, resetFeatureService } from "./{feature}-service.factory";
```

### Template: `features/{feature}/view-model/index.ts`

```typescript
export { useFeatureListViewModel } from "./use-feature-list-view-model";
export { useFeatureFormViewModel } from "./use-feature-form-view-model";
```

### Template: `features/{feature}/view/index.ts`

```typescript
export { FeatureListView } from "./feature-list-view";
export { FeatureFormView } from "./feature-form-view";
```

### Template: `features/{feature}/components/index.ts`

```typescript
export { FeatureCard } from "./feature-card";
export { FeatureEmptyState } from "./feature-empty-state";
```

### Template: `features/{feature}/index.ts`

```typescript
export { FeatureListView, FeatureFormView } from "./view";
export { useFeatureListViewModel, useFeatureFormViewModel } from "./view-model";
export type { FeatureService, FeatureServiceResult } from "./services";
export { getFeatureService } from "./services";
export type { FeatureEntity, FeatureFilters, CreateFeatureInput, UpdateFeatureInput } from "./model";
export { createFeatureSchema, updateFeatureSchema, mapFeatureDTO } from "./model";
```

---

## 11. Testing Requirements

### Model Tests
- Schema validates valid input
- Schema rejects invalid input for each field
- Schema boundary tests (max length, min values, etc.)
- Mapper maps all fields correctly
- Mapper handles null/undefined optional fields

### Service Tests (Mock Adapter)
- `list` returns paginated results
- `list` filters by criteria
- `list` searches by keyword
- `list` handles empty results
- `getById` returns item by ID
- `getById` returns error for invalid ID
- `create` creates and returns item
- `update` updates item fields
- `delete` removes item

### ViewModel Tests
- ViewModel loads data on mount (verify service is called)
- ViewModel shows loading state initially
- ViewModel handles empty state
- ViewModel handles error state
- ViewModel handles user actions (search, filter, delete)
- ViewModel uses AbortController for cancellation
- Form ViewModel validates before submit
- Form ViewModel shows validation errors

### View / Component Tests
- Component renders with data
- Component handles all state branches (loading, error, empty, data)
- Component fires callbacks on user interaction
- Accessibility: form inputs have associated labels
- Accessibility: icon buttons have aria-labels

### Route Smoke Tests
- Route renders without error
- Route renders for valid params
- Route calls notFound for invalid params

---

## 12. Anti-Patterns (DO NOT DO)

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|-----------------|
| Importing `mock-data.ts` in a View | Breaks MVVM isolation, impossible to swap to real backend | Import only through service → adapter |
| Calling `fetch()` in a page file | Ties page to HTTP, breaks SSR/testing | Call through service layer |
| Placing business logic in JSX | Untestable, hard to refactor | Move to ViewModel |
| Transforming API responses in a View | View becomes coupled to API shape | Transform in mapper or ViewModel |
| Using `any` | Loses type safety | Use proper types or `unknown` with guards |
| Converting all pages to Client Components | Increases bundle size, breaks SSR | Keep pages as Server Components |
| Calling service methods directly in Views | Bypasses ViewModel state management | Always go through ViewModel |
| Using `useState` for complex state (lists, forms) | Scattered state, hard to maintain | Use `useReducer` with typed actions |
| Importing service instance directly from factory | Creates tight coupling | Use service through factory in ViewModel only |
| Storing raw sensitive text in localStorage | Privacy risk | Store only non-sensitive metadata locally |
| Skipping error state coverage | Poor UX, no recovery path | Handle loading/error/empty/success in every View |

---

## 13. Creating a New Feature — Step-by-Step

1. **Create directory structure:**
   ```
   features/{feature}/
   ├── model/
   ├── services/
   ├── view-model/
   ├── view/
   └── components/
   ```

2. **Model layer** (no React):
   - Define domain interfaces and enums in `{feature}.model.ts`
   - Define Zod schemas in `{feature}.schema.ts`
   - Define DTO types in `{feature}.dto.ts`
   - Define mapper functions in `{feature}.mapper.ts`
   - Define constants in `{feature}.constants.ts`

3. **Service layer** (no React):
   - Define `FeatureService` interface with `FeatureServiceResult<T>` in `{feature}.service.ts`
   - Implement mock adapter in `{feature}.mock-adapter.ts`
   - Implement placeholder HTTP adapter in `{feature}.http-adapter.ts`
   - Create factory in `{feature}-service.factory.ts`

4. **ViewModel layer** (`"use client"`):
   - Create `useFeatureListViewModel` with `useReducer`
   - Create `useFeatureFormViewModel` or `useFeatureDetailViewModel` as needed
   - Use `AbortController` + `useRef` for cancellation
   - Return handlers + state from the hook

5. **View layer** (`"use client"`):
   - Create View components that call ViewModels
   - Cover loading, error, empty, and success states
   - Compose feature components and shared components

6. **Components layer** (presentational):
   - Create feature-specific components (card, empty state, filters, dialogs)

7. **Page integration** (Server Component):
   - Create thin page file in `app/` that imports the View
   - Add metadata export

8. **Barrel exports:**
   - `index.ts` in every subdirectory
   - `features/{feature}/index.ts` for the public API

9. **Tests:**
   - Schema tests in model layer
   - Mock adapter tests in services layer
   - ViewModel tests (verify state transitions)
   - Component tests (render + interaction + accessibility)

10. **Verify:**
    - Run `npm run lint`
    - Run `npm run typecheck`
    - Run existing tests

---

## 14. Migrating a Legacy Feature — Step-by-Step

1. Create the feature directory structure.
2. Extract domain types from the legacy code into `model/`.
3. Create Zod schemas from any existing validation logic.
4. Create DTO types matching the current API contract.
5. Create mapper functions for DTO ↔ domain conversion.
6. Create the service interface and mock adapter (wrap existing mock-data or inline data).
7. Create the service factory.
8. Create ViewModels (wrap existing logic, add loading/error/empty states).
9. Create View components (extract JSX from legacy pages, add state coverage).
10. Create feature-specific components (extract from legacy shared components).
11. Update page files to import the new View (thin page pattern).
12. Update legacy barrel exports to re-export from the new feature.
13. Remove legacy mock-data imports from the migrated pages.
14. Write tests for the new layer files.
15. Verify: lint, typecheck, test, manual smoke test.

---

## 15. Shared Layer Reference

### Feedback Components (for View state coverage)

| Component | Import | Props |
|-----------|--------|-------|
| `<EchoLoadingState>` | `@/shared/components/feedback/echo-loading-state` | `variant: "skeleton" \| "spinner"`, `count?: number` |
| `<EchoErrorState>` | `@/shared/components/feedback/echo-error-state` | `title: string`, `message: string`, `onRetry?: () => void` |
| `<EchoEmptyState>` | `@/shared/components/feedback/echo-empty-state` | `icon?: ReactNode`, `title: string`, `description?: string`, `action?: ReactNode` |
| `<EchoInlineMessage>` | `@/shared/components/feedback/echo-inline-message` | `variant: "info" \| "warning" \| "error"`, `message: string`, `onDismiss?: () => void` |

### Data Display Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `<EchoPageHeading>` | `@/shared/components/data-display/echo-page-heading` | Page title + description + optional action |

### Environment Config

```typescript
import { env } from "@/config/environment";
// env.dataAdapter → "mock" | "http"
// env.apiBaseUrl → string
// env.enableBuddy → boolean
// etc.
```

### Shared Types

```typescript
import type { AsyncState<T> } from "@/shared/types/async-state";
// AsyncState<T> = idle | loading | loading-more | success | empty | error
```
