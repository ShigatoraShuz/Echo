import type {
  JournalEntry,
  JournalDraft,
  JournalAnalysis,
  JournalMood,
  JournalPrivacyStatus,
  JournalRiskBand,
} from "./journal.model";
import type { CreateJournalInput } from "./journal.model";
import type {
  JournalEntryResponseDTO,
  JournalDraftResponseDTO,
  JournalAnalysisResponseDTO,
  CreateJournalRequestDTO,
} from "./journal.dto";

function mapMood(mood: string): JournalMood {
  const valid: JournalMood[] = ["calm", "happy", "neutral", "sad", "anxious", "angry"];
  return valid.includes(mood as JournalMood) ? (mood as JournalMood) : "neutral";
}

function mapPrivacyStatus(status: string): JournalPrivacyStatus {
  return status === "shared" ? "shared" : "private";
}

function mapRiskBand(band: string): JournalRiskBand {
  const valid: JournalRiskBand[] = ["low", "mild", "moderate", "high", "severe"];
  return valid.includes(band as JournalRiskBand) ? (band as JournalRiskBand) : "low";
}

export function mapEntryResponseToDomain(dto: JournalEntryResponseDTO): JournalEntry {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    excerpt: dto.excerpt,
    mood: mapMood(dto.mood),
    emotions: dto.emotions,
    tags: dto.tags,
    privacyStatus: mapPrivacyStatus(dto.privacy_status),
    analysisConsent: dto.analysis_consent,
    riskScore: dto.risk_score,
    riskBand: mapRiskBand(dto.risk_band),
    summary: dto.summary,
    perspective: dto.perspective,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapDraftResponseToDomain(dto: JournalDraftResponseDTO): JournalDraft {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    mood: mapMood(dto.mood),
    emotions: dto.emotions,
    tags: dto.tags,
    privacyStatus: mapPrivacyStatus(dto.privacy_status),
    analysisConsent: dto.analysis_consent,
    updatedAt: dto.updated_at,
  };
}

export function mapAnalysisResponseToDomain(dto: JournalAnalysisResponseDTO): JournalAnalysis {
  return {
    id: dto.id,
    entryId: dto.entry_id,
    summary: dto.summary,
    perspective: dto.perspective,
    moodInsight: dto.mood_insight,
    riskIndication: dto.risk_indication,
    isDemoData: dto.is_demo_data,
    createdAt: dto.created_at,
  };
}

export function mapCreateInputToRequest(input: CreateJournalInput): CreateJournalRequestDTO {
  return {
    title: input.title,
    body: input.body,
    mood: input.mood,
    emotions: input.emotions,
    tags: input.tags,
    privacy_status: input.privacyStatus,
    analysis_consent: input.analysisConsent,
  };
}
