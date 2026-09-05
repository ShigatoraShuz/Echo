// ─── API Response DTOs ────────────────────────────────

export interface JournalEntryResponseDTO {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
  risk_score: number | null;
  risk_band: string | null;
  summary: string;
  perspective: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryListResponseDTO {
  entries: JournalEntryResponseDTO[];
  total: number;
  page: number;
  page_size: number;
}

export interface JournalDraftResponseDTO {
  id: string;
  title: string;
  body: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
  updated_at: string;
}

export interface JournalAnalysisResponseDTO {
  status: "pending" | "processing" | "completed" | "failed";
  id: string;
  entry_id: string;
  summary: string;
  perspective: string;
  mood_insight: string;
  risk_indication: string;
  is_demo_data: boolean;
  created_at: string;
}

// ─── API Request DTOs ─────────────────────────────────

export interface CreateJournalRequestDTO {
  title: string;
  body: string;
  mood: string;
  emotions: string[];
  tags: string[];
  privacy_status: string;
  analysis_consent: boolean;
}

export interface UpdateJournalRequestDTO {
  title?: string;
  body?: string;
  mood?: string;
  emotions?: string[];
  tags?: string[];
  privacy_status?: string;
  analysis_consent?: boolean;
}
