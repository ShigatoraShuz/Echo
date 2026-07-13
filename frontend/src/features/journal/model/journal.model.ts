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
  mood: JournalMood;
  emotions: string[];
  tags: string[];
  privacyStatus: JournalPrivacyStatus;
  analysisConsent: boolean;
  updatedAt: string;
}

export interface JournalAnalysis {
  id: string;
  entryId: string;
  summary: string;
  perspective: string;
  moodInsight: string;
  riskIndication: string;
  isDemoData: boolean;
  createdAt: string;
}

// ─── Input Types ─────────────────────────────────────

export interface CreateJournalInput {
  title: string;
  body: string;
  mood: JournalMood;
  emotions: string[];
  tags: string[];
  privacyStatus: JournalPrivacyStatus;
  analysisConsent: boolean;
}

export interface UpdateJournalInput {
  title?: string;
  body?: string;
  mood?: JournalMood;
  emotions?: string[];
  tags?: string[];
  privacyStatus?: JournalPrivacyStatus;
  analysisConsent?: boolean;
}

// ─── Filter / Sort / Pagination ──────────────────────

export interface JournalSearchFilters {
  query: string;
  mood: JournalMood | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: JournalSortOption;
}

export const DefaultJournalFilters: JournalSearchFilters = {
  query: "",
  mood: null,
  dateFrom: null,
  dateTo: null,
  sort: "newest",
};

export interface JournalPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ─── Service Error ────────────────────────────────────

export type JournalServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NETWORK"
  | "UNKNOWN";

export interface JournalServiceError {
  code: JournalServiceErrorCode;
  message: string;
  details?: Record<string, string[]>;
}
