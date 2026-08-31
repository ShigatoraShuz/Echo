import type {
  JournalEntry,
  JournalDraft,
  JournalAnalysis,
  CreateJournalInput,
  UpdateJournalInput,
  JournalSearchFilters,
  JournalPagination,
  JournalServiceError,
  JournalCreationOutcome,
} from "@/features/journal/model/journal.model";
import type { AnalysisFixture, AnalysisProgress } from "@echo/contracts";

export type JournalServiceResult<T> = { success: true; data: T } | { success: false; error: JournalServiceError };

export interface JournalService {
  listEntries(
    filters: JournalSearchFilters,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<JournalServiceResult<{ entries: JournalEntry[]; pagination: JournalPagination }>>;
  getEntry(id: string, signal?: AbortSignal): Promise<JournalServiceResult<JournalEntry>>;
  createEntry(
    input: CreateJournalInput,
    options?: { idempotencyKey?: string; fixture?: AnalysisFixture },
  ): Promise<JournalServiceResult<JournalCreationOutcome>>;
  updateEntry(id: string, input: UpdateJournalInput): Promise<JournalServiceResult<JournalEntry>>;
  deleteEntry(id: string): Promise<JournalServiceResult<void>>;
  saveDraft(draft: JournalDraft): Promise<JournalServiceResult<JournalDraft>>;
  getDraft(id: string): Promise<JournalServiceResult<JournalDraft | null>>;
  deleteDraft(id: string): Promise<JournalServiceResult<void>>;
  requestAnalysis(entryId: string): Promise<JournalServiceResult<JournalAnalysis>>;
  getAnalysis(entryId: string): Promise<JournalServiceResult<JournalAnalysis | null>>;
  getAnalysisStatus?(jobId: string): Promise<JournalServiceResult<AnalysisProgress>>;
  resolveSupportResources?(
    countryCode: string,
    regionCode?: string,
  ): Promise<
    JournalServiceResult<
      Array<{
        id: string;
        resource_name: string;
        organization_name: string;
        phone_number?: string;
        sms_number?: string;
        website_url?: string;
        availability_text?: string;
      }>
    >
  >;
  exportEntry(id: string): Promise<JournalServiceResult<{ markdown: string }>>;
}
