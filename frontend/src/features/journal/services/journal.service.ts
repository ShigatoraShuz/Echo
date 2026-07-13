import type {
  JournalEntry,
  JournalDraft,
  JournalAnalysis,
  CreateJournalInput,
  UpdateJournalInput,
  JournalSearchFilters,
  JournalPagination,
  JournalServiceError,
} from "../model/journal.model";

export type JournalServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: JournalServiceError };

export interface JournalService {
  listEntries(filters: JournalSearchFilters, page: number, pageSize: number, signal?: AbortSignal): Promise<JournalServiceResult<{ entries: JournalEntry[]; pagination: JournalPagination }>>;
  getEntry(id: string, signal?: AbortSignal): Promise<JournalServiceResult<JournalEntry>>;
  createEntry(input: CreateJournalInput): Promise<JournalServiceResult<JournalEntry>>;
  updateEntry(id: string, input: UpdateJournalInput): Promise<JournalServiceResult<JournalEntry>>;
  deleteEntry(id: string): Promise<JournalServiceResult<void>>;
  saveDraft(draft: JournalDraft): Promise<JournalServiceResult<JournalDraft>>;
  getDraft(id: string): Promise<JournalServiceResult<JournalDraft | null>>;
  deleteDraft(id: string): Promise<JournalServiceResult<void>>;
  requestAnalysis(entryId: string): Promise<JournalServiceResult<JournalAnalysis>>;
  getAnalysis(entryId: string): Promise<JournalServiceResult<JournalAnalysis | null>>;
  exportEntry(id: string): Promise<JournalServiceResult<{ markdown: string }>>;
}
