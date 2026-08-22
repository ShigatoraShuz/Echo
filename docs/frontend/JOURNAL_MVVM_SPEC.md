# Journal Feature — MVVM Specification

> This document defines the **target architecture** for the Journal feature.
> It serves as the first MVVM reference implementation for the ECHO frontend.
> No code has been migrated yet. This is a specification.

---

## 1. Target Structure

```
features/journal/
├── model/
│   ├── journal.model.ts          # Domain interfaces and enums
│   ├── journal.schema.ts         # Zod validation schemas
│   ├── journal.dto.ts            # API response/request DTOs
│   ├── journal.mapper.ts         # DTO-to-domain mapping
│   └── journal.constants.ts      # Domain constants
├── services/
│   ├── journal.service.ts        # Typed service interface + injection
│   ├── journal.mock-adapter.ts   # Mock implementation
│   └── journal.http-adapter.ts   # HTTP implementation (future)
├── view-model/
│   ├── use-journal-list-view-model.ts
│   ├── use-journal-editor-view-model.ts
│   └── use-journal-detail-view-model.ts
├── view/
│   ├── journal-list-view.tsx
│   ├── journal-editor-view.tsx
│   └── journal-detail-view.tsx
├── components/
│   ├── journal-card.tsx
│   ├── journal-filters.tsx
│   ├── journal-empty-state.tsx
│   ├── journal-delete-dialog.tsx
│   ├── journal-autosave-status.tsx
│   ├── journal-mood-selector.tsx
│   └── journal-analysis-panel.tsx
└── index.ts                     # Public exports
```

---

## 2. Domain Model

### `journal.model.ts`

```typescript
// ─── Enums ───────────────────────────────────────────

export type JournalMood = "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";

export type JournalPrivacyStatus = "private" | "shared";

export type JournalRiskBand = "low" | "mild" | "moderate" | "high" | "severe";

export type JournalSortOption = "newest" | "oldest" | "highest-risk" | "lowest-risk";

// ─── Domain Interfaces ───────────────────────────────

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  mood: JournalMood;
  emotions: string[];
  tags: string[];
  privacyStatus: JournalPrivacyStatus;
  analysisConsent: boolean;
  riskScore: number;
  riskBand: JournalRiskBand;
  summary: string;
  perspective: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDraft {
  id: string;
  title: string;
  body: string;
  mood: JournalMood | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalAnalysis {
  id: string;
  entryId: string;
  emotionScores: Record<string, number>;
  riskAssessment: {
    score: number;
    band: JournalRiskBand;
    contributingFactors: string[];
  };
  perspective: string;
  summary: string;
  analyzedAt: string;
}

// ─── Input Types ─────────────────────────────────────

export interface CreateJournalInput {
  title: string;
  body: string;
  mood: JournalMood;
  tags: string[];
  analysisConsent: boolean;
}

export interface UpdateJournalInput {
  title?: string;
  body?: string;
  mood?: JournalMood;
  tags?: string[];
  analysisConsent?: boolean;
}

// ─── Filter and Sort Types ──────────────────────────

export interface JournalSearchFilters {
  search?: string;
  mood?: JournalMood;
  dateFrom?: string;
  dateTo?: string;
  riskBand?: JournalRiskBand;
}

export interface JournalPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ─── State Types ─────────────────────────────────────

export interface JournalListState {
  entries: JournalEntry[];
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  filters: JournalSearchFilters;
  sort: JournalSortOption;
  searchQuery: string;
  pagination: JournalPagination;
  deleteTarget: JournalEntry | null;
  isDeleting: boolean;
}

export interface JournalEditorState {
  title: string;
  body: string;
  mood: JournalMood;
  tags: string[];
  analysisConsent: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isAutosaving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  validationErrors: Record<string, string>;
}

export interface JournalDetailState {
  entry: JournalEntry | null;
  analysis: JournalAnalysis | null;
  isLoading: boolean;
  error: string | null;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
}

// ─── Service Error ──────────────────────────────────

export interface JournalServiceError {
  code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "NETWORK" | "UNAUTHORIZED" | "UNKNOWN";
  message: string;
  field?: string;
}
```

### `journal.schema.ts`

```typescript
import { z } from "zod";

export const journalMoodSchema = z.enum([
  "calm", "happy", "neutral", "sad", "anxious", "angry",
]);

export const createJournalSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  body: z
    .string()
    .min(1, "Reflection is required")
    .max(10000, "Reflection must be 10,000 characters or fewer"),
  mood: journalMoodSchema,
  tags: z
    .array(z.string().max(50))
    .max(10, "Maximum 10 tags allowed")
    .default([]),
  analysisConsent: z.boolean().default(false),
});

export const updateJournalSchema = createJournalSchema.partial();

export const journalSearchSchema = z.object({
  search: z.string().max(200).optional(),
  mood: journalMoodSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  riskBand: z.enum(["low", "mild", "moderate", "high", "severe"]).optional(),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
```

### `journal.dto.ts`

```typescript
// ─── API Response DTOs ───────────────────────────────

export interface JournalEntryDTO {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
  risk_score: number;
  risk_band: string;
  summary: string;
  perspective: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryListDTO {
  entries: JournalEntryDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface JournalAnalysisDTO {
  id: string;
  journal_entry_id: string;
  emotion_scores: Record<string, number>;
  risk_assessment: {
    score: number;
    band: string;
    contributing_factors: string[];
  };
  perspective: string;
  summary: string;
  analyzed_at: string;
}

// ─── API Request DTOs ────────────────────────────────

export interface CreateJournalEntryDTO {
  title: string;
  body: string;
  mood: string;
  tags: string[];
  analysis_consent: boolean;
}

export interface UpdateJournalEntryDTO {
  title?: string;
  body?: string;
  mood?: string;
  tags?: string[];
  analysis_consent?: boolean;
}

export interface JournalListQueryDTO {
  search?: string;
  mood?: string;
  sort?: string;
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}
```

### `journal.mapper.ts`

```typescript
import type {
  JournalEntry,
  JournalMood,
  JournalPrivacyStatus,
  JournalRiskBand,
  JournalAnalysis,
} from "./journal.model";
import type {
  JournalEntryDTO,
  JournalAnalysisDTO,
} from "./journal.dto";

export function mapJournalEntryDTO(dto: JournalEntryDTO): JournalEntry {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    excerpt: dto.excerpt,
    mood: dto.mood as JournalMood,
    emotions: dto.emotions,
    tags: dto.tags,
    privacyStatus: dto.privacy_status as JournalPrivacyStatus,
    analysisConsent: dto.analysis_consent,
    riskScore: dto.risk_score,
    riskBand: dto.risk_band as JournalRiskBand,
    summary: dto.summary,
    perspective: dto.perspective,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapJournalAnalysisDTO(dto: JournalAnalysisDTO): JournalAnalysis {
  return {
    id: dto.id,
    entryId: dto.journal_entry_id,
    emotionScores: dto.emotion_scores,
    riskAssessment: {
      score: dto.risk_assessment.score,
      band: dto.risk_assessment.band as JournalRiskBand,
      contributingFactors: dto.risk_assessment.contributing_factors,
    },
    perspective: dto.perspective,
    summary: dto.summary,
    analyzedAt: dto.analyzed_at,
  };
}

export function mapEntryToExcerpt(body: string, maxLength = 150): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trimEnd() + "...";
}
```

### `journal.constants.ts`

```typescript
import type { JournalMood, JournalSortOption } from "./journal.model";

export const JOURNAL_MOODS: JournalMood[] = [
  "calm", "happy", "neutral", "sad", "anxious", "angry",
];

export const JOURNAL_MOOD_LABELS: Record<JournalMood, string> = {
  calm: "Calm",
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  anxious: "Anxious",
  angry: "Angry",
};

export const JOURNAL_SORT_OPTIONS: { value: JournalSortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest-risk", label: "Highest distress" },
  { value: "lowest-risk", label: "Lowest distress" },
];

export const JOURNAL_PAGE_SIZE = 12;

export const JOURNAL_STORAGE_KEYS = {
  DRAFT_PREFIX: "echo:journal:draft:",
} as const;

export const JOURNAL_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION: "Please check your entry and try again.",
  NOT_FOUND: "This journal entry was not found.",
  CONFLICT: "This entry was updated by another session. Please refresh.",
  NETWORK: "Unable to save. Check your connection and try again.",
  UNAUTHORIZED: "Your session has expired. Please log in again.",
  UNKNOWN: "Something went wrong. Please try again.",
};
```

---

## 3. Service Contract

### `journal.service.ts`

```typescript
import type {
  JournalEntry,
  JournalAnalysis,
  JournalDraft,
  JournalSearchFilters,
  JournalSortOption,
  JournalPagination,
  CreateJournalInput,
  UpdateJournalInput,
} from "../model/journal.model";

export interface JournalService {
  listEntries(params?: {
    search?: string;
    mood?: string;
    sort?: JournalSortOption;
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<{
    entries: JournalEntry[];
    pagination: JournalPagination;
  }>;

  getEntry(id: string, signal?: AbortSignal): Promise<JournalEntry>;

  createEntry(input: CreateJournalInput): Promise<JournalEntry>;

  updateEntry(id: string, input: UpdateJournalInput): Promise<JournalEntry>;

  deleteEntry(id: string): Promise<{ success: boolean }>;

  saveDraft(input: Partial<CreateJournalInput> & { id?: string }): Promise<JournalDraft>;

  getDraft(id: string): Promise<JournalDraft | null>;

  deleteDraft(id: string): Promise<{ success: boolean }>;

  requestAnalysis(id: string): Promise<{ status: "pending" | "processing" | "completed" }>;

  getAnalysis(id: string, signal?: AbortSignal): Promise<JournalAnalysis>;

  exportEntry(id: string, format: "txt" | "pdf"): Promise<Blob>;
}
```

### Error Behavior

| Scenario | Error Type | Message |
|----------|-----------|---------|
| Invalid input | `VALIDATION` | "Please check your entry and try again." |
| Entry not found | `NOT_FOUND` | "This journal entry was not found." |
| Concurrent edit | `CONFLICT` | "This entry was updated by another session." |
| Network offline | `NETWORK` | "Unable to save. Check your connection." |
| Token expired | `UNAUTHORIZED` | "Your session has expired. Please log in." |
| Rate limited | `RATE_LIMITED` | "Too many requests. Please wait a moment." |
| Unknown | `UNKNOWN` | "Something went wrong. Please try again." |

### Cancellation

- `listEntries` and `getEntry` accept `AbortSignal` for search-as-you-type cancellation
- `getAnalysis` accepts `AbortSignal` for navigation-cancellation

---

## 4. Mock Adapter Specification

### `journal.mock-adapter.ts`

```typescript
// Mock adapter responsibilities:
// 1. Implement JournalService interface
// 2. Store data in memory (not localStorage by default)
// 3. Simulate network delay (200-800ms)
// 4. Support simulated errors (configurable failure rate)
// 5. Support search, filter, and sort operations
// 6. Support pagination
// 7. No fake AI claims — analysis returns pre-defined mock responses
// 8. No journal body logged to console

export interface MockAdapterConfig {
  simulateDelay?: boolean;
  delayMs?: [number, number]; // min, max
  failureRate?: number; // 0-1, default 0
  failureModes?: Array<"network" | "not-found" | "unauthorized">;
}
```

### Mock Adapter Rules

- Never import `mockAdapter` directly in Views or ViewModels
- ViewModels import only the `JournalService` interface and the injected instance
- Selection between mock and HTTP adapter happens in `journal.service.ts` via environment config
- Mock data is the existing `lib/mock-data.ts` content, wrapped in adapter methods
- When the HTTP adapter is connected, the mock adapter is still available for testing

---

## 5. ViewModel Specifications

### `useJournalListViewModel`

**State:**
- `entries: JournalEntry[]`
- `isLoading: boolean`
- `error: string | null`
- `isEmpty: boolean`
- `filters: JournalSearchFilters`
- `sort: JournalSortOption`
- `searchQuery: string`
- `pagination: JournalPagination`
- `deleteTarget: JournalEntry | null`
- `isDeleting: boolean`

**Handlers:**
- `setSearchQuery(query: string)` — Update search, debounce, refetch
- `setFilters(filters: JournalSearchFilters)` — Update filters, refetch
- `setSort(sort: JournalSortOption)` — Update sort, refetch
- `loadMore()` — Append next page
- `refresh()` — Reset and reload
- `confirmDelete(entry: JournalEntry)` — Set deleteTarget
- `cancelDelete()` — Clear deleteTarget
- `executeDelete()` — Delete entry, remove from list, or revert on failure
- `retry()` — Retry last failed operation

**Behavior:**
- Loads first page on mount
- Debounces search by 300ms
- Cancels previous search request on new search (AbortSignal)
- Optimistic deletion with rollback on failure
- Empty state when no entries match filters
- Error state with retry on failure

### `useJournalEditorViewModel`

**State:**
- `title: string`
- `body: string`
- `mood: JournalMood`
- `tags: string[]`
- `analysisConsent: boolean`
- `isDirty: boolean`
- `isSaving: boolean`
- `isAutosaving: boolean`
- `lastSavedAt: string | null`
- `error: string | null`
- `validationErrors: Record<string, string>`
- `isNewEntry: boolean`
- `entryId: string | null`

**Handlers:**
- `setTitle(title: string)` — Update, mark dirty, trigger autosave
- `setBody(body: string)` — Update, mark dirty, trigger autosave
- `setMood(mood: JournalMood)` — Update, mark dirty
- `setTags(tags: string[])` — Update, mark dirty
- `setAnalysisConsent(consent: boolean)` — Update, mark dirty
- `save()` — Validate, call service, handle errors
- `saveDraft()` — Save current state as draft
- `discardDraft()` — Delete draft, reset form
- `reset()` — Reset to initial state

**Behavior:**
- Validates with Zod schema before save
- Autosaves draft after 3 seconds of inactivity (when dirty)
- Prevents double submission
- Shows word/character count
- Shows unsaved-changes warning on navigation attempt
- Returns to list on successful save
- Restores draft on mount if available

### `useJournalDetailViewModel`

**State:**
- `entry: JournalEntry | null`
- `analysis: JournalAnalysis | null`
- `isLoading: boolean`
- `error: string | null`
- `isDeleting: boolean`
- `showDeleteConfirm: boolean`

**Handlers:**
- `load(id: string)` — Fetch entry and analysis
- `showDeleteConfirmation()` — Show delete dialog
- `hideDeleteConfirmation()` — Hide delete dialog
- `deleteEntry()` — Delete, navigate to list
- `retry()` — Retry loading
- `exportEntry(format: "txt" | "pdf")` — Trigger export download

**Behavior:**
- Loads entry and analysis on mount (parallel requests)
- Shows loading skeleton during fetch
- Shows error state with retry on failure
- Shows delete confirmation dialog
- Navigates to `/journal` on successful delete
- Exports entry as downloadable file
- Not found state triggers `notFound()` from next/navigation

---

## 6. View Specifications

### `JournalListView`

- Renders `PageHeader` with title, description, "New entry" action link
- Renders `JournalFilters` with search input, mood filter, sort dropdown
- Renders grid of `JournalCard` components
- Renders `JournalEmptyState` when no entries match filters
- Renders `LoadingState` skeleton during initial load
- Renders `ErrorState` with retry on error
- Renders `JournalDeleteDialog` when `deleteTarget` is set
- Renders "Load more" button when pagination.hasMore is true
- Shows loading indicator during pagination

### `JournalEditorView`

- Renders `PageHeader` with "New reflection" or "Edit entry" title
- Renders form with title input, body textarea, mood selector, tags input
- Renders `JournalAutosaveStatus` with last-saved time
- Renders word and character count
- Renders analysis consent checkbox
- Renders "Save" and "Cancel" buttons
- Prevents navigation with unsaved-changes dialog
- Renders validation errors inline
- Shows loading state during save

### `JournalDetailView`

- Renders `PageHeader` with entry title and date
- Renders entry body content
- Renders mood badge and emotion tags
- Renders `JournalAnalysisPanel` with perspective and risk score
- Renders edit and delete action buttons
- Renders `JournalDeleteDialog`
- Renders `LoadingState` skeleton during fetch
- Renders `ErrorState` with retry on error
- Renders export button

---

## 7. Component Specifications

### `JournalCard`

- Displays date, title, excerpt, mood badge, risk band, emotion tags
- Links to `/journal/[id]` entry detail
- Supports delete button with confirmation
- Accessible: article element, heading hierarchy, ARIA labels

### `JournalFilters`

- Search input with debounce and clear button
- Mood filter dropdown
- Date range picker (start/end)
- Sort dropdown
- Active filter count badge
- Accessible: labeled inputs, clear filter action

### `JournalEmptyState`

- Icon (HeartHandshake or BookOpen)
- Title: "No entries yet" or "No entries match your filters"
- Description with guidance
- CTA: "Write your first entry" link
- Accessible: heading, descriptive text

### `JournalDeleteDialog`

- Accessible dialog with focus trap
- Title: "Delete this entry?"
- Description: "This action cannot be undone."
- Cancel and Confirm buttons
- Loading state during deletion
- Accessible: `role="dialog"`, `aria-modal`, focus management

### `JournalAutosaveStatus`

- Shows "Saving..." during autosave
- Shows "Saved just now" after save
- Shows "Draft saved" with timestamp
- Shows error if autosave fails
- Accessible: `aria-live="polite"`

### `JournalMoodSelector`

- Button grid with 6 mood options
- Visual feedback for selected mood
- Accessible: radio group pattern, `aria-pressed`
- (Reuses existing `MoodSelector` component)

### `JournalAnalysisPanel`

- Displays ECHO perspective (non-diagnostic)
- Risk score ring with band
- Emotion score breakdown
- Summary text
- Privacy notice
- Disclaimer: "ECHO is not a diagnostic tool"

---

## 8. Route Page Integration

### `app/journal/page.tsx`

```typescript
import { JournalListView } from "@/features/journal/view/journal-list-view";

export const metadata = { title: "Journal — ECHO" };

export default function JournalPage() {
  // Thin: delegates to JournalListView
  // ViewModel handles all state and data fetching client-side
  return <JournalListView />;
}
```

### `app/journal/new/page.tsx`

```typescript
import { JournalEditorView } from "@/features/journal/view/journal-editor-view";

export const metadata = { title: "New entry — ECHO" };

export default function NewJournalEntryPage() {
  return <JournalEditorView />;
}
```

### `app/journal/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import { JournalDetailView } from "@/features/journal/view/journal-detail-view";

export const metadata = { title: "Journal entry — ECHO" };

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate id format; delegate to view for data fetching
  if (!id || typeof id !== "string") {
    notFound();
  }

  return <JournalDetailView entryId={id} />;
}
```

---

## 9. Future Backend Endpoint Mapping

| Service Method | HTTP Method | Path | Notes |
|---------------|-------------|------|-------|
| `listEntries` | GET | `/api/v1/journals?search=&mood=&sort=&page=&limit=` | Paginated, filterable |
| `getEntry` | GET | `/api/v1/journals/{id}` | Single entry |
| `createEntry` | POST | `/api/v1/journals` | Create with analysis consent |
| `updateEntry` | PATCH | `/api/v1/journals/{id}` | Partial update |
| `deleteEntry` | DELETE | `/api/v1/journals/{id}` | Soft delete |
| `saveDraft` | POST | `/api/v1/journals/drafts` | Create or update draft |
| `getDraft` | GET | `/api/v1/journals/drafts/{id}` | Get single draft |
| `deleteDraft` | DELETE | `/api/v1/journals/drafts/{id}` | Delete draft |
| `requestAnalysis` | POST | `/api/v1/journals/{id}/analysis` | Trigger async analysis |
| `getAnalysis` | GET | `/api/v1/journals/{id}/analysis` | Get analysis results |
| `exportEntry` | GET | `/api/v1/journals/{id}/export?format=` | Download as file |

---

## 10. Testing Requirements

### Model Tests
- `createJournalSchema` validates valid input
- `createJournalSchema` rejects missing title
- `createJournalSchema` rejects empty body
- `createJournalSchema` rejects invalid mood
- `createJournalSchema` accepts valid tags
- `createJournalSchema` rejects >10 tags
- `createJournalSchema` rejects title >200 characters
- `updateJournalSchema` accepts partial updates
- `mapJournalEntryDTO` maps all fields correctly
- `mapJournalEntryDTO` handles null perspective
- `mapEntryToExcerpt` truncates long text
- `mapEntryToExcerpt` preserves short text

### Service Tests (Mock Adapter)
- `listEntries` returns paginated results
- `listEntries` filters by mood
- `listEntries` searches by keyword
- `listEntries` sorts by newest
- `listEntries` handles empty results
- `getEntry` returns entry by ID
- `getEntry` throws NOT_FOUND for invalid ID
- `createEntry` creates and returns entry
- `updateEntry` updates entry fields
- `deleteEntry` marks entry as deleted
- `saveDraft` creates or updates draft

### ViewModel Tests
- `useJournalListViewModel` loads entries on mount
- `useJournalListViewModel` shows loading state initially
- `useJournalListViewModel` handles empty state
- `useJournalListViewModel` handles error state
- `useJournalListViewModel` filters entries
- `useJournalListViewModel` searches with debounce
- `useJournalListViewModel` paginates
- `useJournalListViewModel` confirms and executes delete
- `useJournalEditorViewModel` initializes with empty form
- `useJournalEditorViewModel` validates before save
- `useJournalEditorViewModel` shows validation errors
- `useJournalEditorViewModel` autosaves draft
- `useJournalEditorViewModel` prevents double submit
- `useJournalDetailViewModel` loads entry and analysis
- `useJournalDetailViewModel` shows delete confirmation
- `useJournalDetailViewModel` navigates on delete

### View / Component Tests
- `JournalCard` renders entry data
- `JournalFilters` calls onSearchChange
- `JournalFilters` calls onFiltersChange
- `JournalEmptyState` shows correct message
- `JournalDeleteDialog` calls onConfirm and onCancel
- `JournalAutosaveStatus` shows saving indicator
- `JournalMoodSelector` selects mood
- `JournalAnalysisPanel` shows disclaimer

### Accessibility Tests
- All form inputs have associated labels
- All icon buttons have aria-labels
- Delete dialog traps focus
- Search has clear button accessible label
- Filters have accessible names
- Error messages are announced by screen readers
- Keyboard navigation works for all interactive elements
- Focus management works after delete confirmation

### Route Smoke Tests
- `/journal` renders without error
- `/journal/new` renders without error
- `/journal/[id]` renders for valid ID
- `/journal/[id]` calls notFound for invalid ID
