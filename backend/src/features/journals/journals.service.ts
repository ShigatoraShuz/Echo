import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthorizationError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { EncryptionService, EncryptedPayload } from "../../infrastructure/encryption/encryption.service.js";
import type {
  AnalysisProvider,
  AnalysisProviderResult,
} from "../../infrastructure/analysis/analysis-provider.types.js";
import { logSupabaseError, type SupabaseOperation } from "../../infrastructure/supabase/supabase-diagnostics.js";

export interface JournalInput {
  title: string;
  body: string;
  mood: "calm" | "happy" | "neutral" | "sad" | "anxious" | "angry";
  emotions: string[];
  tags: string[];
  privacyStatus: "private" | "shared";
  analysisConsent: boolean;
}

export interface JournalResponse {
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
  risk_band: "low" | "mild" | "moderate" | "high" | "severe";
  summary: string;
  perspective: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResponse {
  id: string;
  entry_id: string;
  summary: string;
  perspective: string;
  mood_insight: string;
  risk_indication: string;
  is_demo_data: boolean;
  created_at: string;
  status: string;
  phq8_score: number | null;
  severity: string | null;
  urgent_language_detected: boolean;
  provider: "mock";
}

export interface JournalDraftInput {
  title: string;
  body: string;
  mood: JournalInput["mood"];
  emotions: string[];
  tags: string[];
  privacyStatus: JournalInput["privacyStatus"];
  analysisConsent: boolean;
}

export interface JournalDraftResponse {
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

type JournalRow = Record<string, unknown>;
type AnalysisRow = Record<string, unknown>;

function bytea(value: string): string {
  return `\\x${Buffer.from(value, "base64").toString("hex")}`;
}

function base64FromBytea(value: unknown): string {
  if (typeof value !== "string") throw new Error("Encrypted journal data is invalid.");
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function riskBand(severity: unknown): JournalResponse["risk_band"] {
  if (severity === "mild") return "mild";
  if (severity === "moderate") return "moderate";
  if (severity === "moderately_severe") return "high";
  if (severity === "severe") return "severe";
  return "low";
}

function errorCode(error: unknown): string {
  return error instanceof ExternalServiceError ? error.code : "ANALYSIS_UNAVAILABLE";
}

function databaseError(error: unknown, operation: SupabaseOperation, message: string): ExternalServiceError {
  if (error) logSupabaseError(operation, error as Parameters<typeof logSupabaseError>[1]);
  return new ExternalServiceError("DATABASE_UNAVAILABLE", message);
}

export class JournalService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly analysisProvider: AnalysisProvider,
  ) {}

  private encryptJournal(input: JournalInput): EncryptedPayload {
    return this.encryption.encrypt(JSON.stringify({ title: input.title, body: input.body }));
  }

  private decryptJournal(row: JournalRow): { title: string; body: string } {
    if (!row.content_ciphertext || !row.encryption_iv || !row.encryption_auth_tag || !row.encryption_key_version) {
      throw new Error("This legacy journal cannot be read by the encrypted journal workflow.");
    }
    const plaintext = this.encryption.decrypt({
      ciphertext: base64FromBytea(row.content_ciphertext),
      iv: base64FromBytea(row.encryption_iv),
      authenticationTag: base64FromBytea(row.encryption_auth_tag),
      keyVersion: Number(row.encryption_key_version),
    });
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== "object") throw new Error("Encrypted journal data is invalid.");
    const record = parsed as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.body !== "string") {
      throw new Error("Encrypted journal data is invalid.");
    }
    return { title: record.title, body: record.body };
  }

  private async latestAnalysis(journalId: string, userId: string): Promise<AnalysisRow | null> {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_analyses")
      .select("*")
      .eq("journal_id", journalId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    return (data as AnalysisRow | null) ?? null;
  }

  private toJournalResponse(row: JournalRow, analysis: AnalysisRow | null): JournalResponse {
    const journal = this.decryptJournal(row);
    const score = typeof analysis?.phq8_score === "number" ? analysis.phq8_score : 0;
    const severity = analysis?.severity;
    return {
      id: asString(row.id),
      title: journal.title,
      body: journal.body,
      excerpt: journal.body.slice(0, 180),
      mood: asString(row.mood, "neutral"),
      emotions: asStringArray(row.emotions),
      tags: asStringArray(row.tags),
      privacy_status: asString(row.privacy_status, "private"),
      analysis_consent: row.analysis_consent === true,
      risk_score: Math.round((score / 24) * 100),
      risk_band: riskBand(severity),
      summary: analysis
        ? "Development mock analysis is available. It is not a clinical assessment."
        : "No analysis result is available.",
      perspective: analysis ? "Development mock result. This output was not generated by a trained Echo model." : null,
      created_at: asString(row.created_at),
      updated_at: asString(row.updated_at),
    };
  }

  async list(userId: string): Promise<JournalResponse[]> {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journals")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error)
      throw databaseError(
        error,
        { module: "journals", schema: "journal_service", table: "journals", operation: "list journals" },
        "The journal service is temporarily unavailable.",
      );
    return Promise.all(
      ((data ?? []) as JournalRow[]).map(async (row) =>
        this.toJournalResponse(row, await this.latestAnalysis(asString(row.id), userId)),
      ),
    );
  }

  async get(userId: string, journalId: string): Promise<JournalResponse> {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journals")
      .select("*")
      .eq("id", journalId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal service is temporarily unavailable.");
    if (!data) throw new NotFoundError("The journal entry was not found.");
    const row = data as JournalRow;
    return this.toJournalResponse(row, await this.latestAnalysis(journalId, userId));
  }

  async create(userId: string, input: JournalInput): Promise<JournalResponse> {
    const encrypted = this.encryptJournal(input);
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journals")
      .insert({
        user_id: userId,
        title: input.title,
        content_ciphertext: bytea(encrypted.ciphertext),
        encryption_iv: bytea(encrypted.iv),
        encryption_auth_tag: bytea(encrypted.authenticationTag),
        encryption_key_version: encrypted.keyVersion,
        word_count: input.body.trim() ? input.body.trim().split(/\s+/).length : 0,
        mood: input.mood,
        emotions: input.emotions,
        tags: input.tags,
        privacy_status: input.privacyStatus,
        analysis_consent: input.analysisConsent,
      })
      .select("*")
      .single();
    if (error || !data) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal could not be saved.");
    return this.toJournalResponse(data as JournalRow, null);
  }

  async update(userId: string, journalId: string, input: Partial<JournalInput>): Promise<JournalResponse> {
    const current = await this.get(userId, journalId);
    const next: JournalInput = {
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      mood: input.mood ?? (current.mood as JournalInput["mood"]),
      emotions: input.emotions ?? current.emotions,
      tags: input.tags ?? current.tags,
      privacyStatus: input.privacyStatus ?? (current.privacy_status as JournalInput["privacyStatus"]),
      analysisConsent: input.analysisConsent ?? current.analysis_consent,
    };
    const encrypted = this.encryptJournal(next);
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journals")
      .update({
        title: next.title,
        content_ciphertext: bytea(encrypted.ciphertext),
        encryption_iv: bytea(encrypted.iv),
        encryption_auth_tag: bytea(encrypted.authenticationTag),
        encryption_key_version: encrypted.keyVersion,
        word_count: next.body.trim() ? next.body.trim().split(/\s+/).length : 0,
        mood: next.mood,
        emotions: next.emotions,
        tags: next.tags,
        privacy_status: next.privacyStatus,
        analysis_consent: next.analysisConsent,
      })
      .eq("id", journalId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal could not be updated.");
    if (!data) throw new NotFoundError("The journal entry was not found.");
    return this.toJournalResponse(data as JournalRow, await this.latestAnalysis(journalId, userId));
  }

  async remove(userId: string, journalId: string): Promise<void> {
    const { error, count } = await this.database
      .schema("journal_service")
      .from("journals")
      .delete({ count: "exact" })
      .eq("id", journalId)
      .eq("user_id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The journal could not be deleted.");
    if (!count) throw new NotFoundError("The journal entry was not found.");
  }

  private toDraftResponse(row: JournalRow): JournalDraftResponse {
    const draft = this.decryptJournal(row);
    return {
      id: asString(row.id, asString(row.user_id)),
      title: draft.title,
      body: draft.body,
      mood: asString(row.mood, "calm"),
      emotions: asStringArray(row.emotions),
      tags: asStringArray(row.tags),
      privacy_status: asString(row.privacy_status, "private"),
      analysis_consent: row.analysis_consent === true,
      updated_at: asString(row.updated_at),
    };
  }

  async saveDraft(userId: string, input: JournalDraftInput): Promise<JournalDraftResponse> {
    const encrypted = this.encryptJournal(input);
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_drafts")
      .upsert(
        {
          user_id: userId,
          title: input.title,
          content_ciphertext: bytea(encrypted.ciphertext),
          encryption_iv: bytea(encrypted.iv),
          encryption_auth_tag: bytea(encrypted.authenticationTag),
          encryption_key_version: encrypted.keyVersion,
          mood: input.mood,
          emotions: input.emotions,
          tags: input.tags,
          privacy_status: input.privacyStatus,
          analysis_consent: input.analysisConsent,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error || !data) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your draft could not be saved.");
    return this.toDraftResponse(data as JournalRow);
  }

  async getDraft(userId: string): Promise<JournalDraftResponse | null> {
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_drafts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your draft could not be loaded.");
    return data ? this.toDraftResponse(data as JournalRow) : null;
  }

  async deleteDraft(userId: string): Promise<void> {
    const { error } = await this.database
      .schema("journal_service")
      .from("journal_drafts")
      .delete()
      .eq("user_id", userId);
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your draft could not be removed.");
  }

  async analyze(userId: string, journalId: string): Promise<AnalysisResponse> {
    const journal = await this.get(userId, journalId);
    if (!journal.analysis_consent) {
      throw new AuthorizationError("Journal analysis requires your explicit consent.");
    }
    const { data: consent, error: consentError } = await this.database
      .schema("user_service")
      .from("privacy_preferences")
      .select("user_id")
      .eq("user_id", userId)
      .eq("journal_ai_analysis_enabled", true)
      .maybeSingle();
    if (consentError)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The consent check is temporarily unavailable.");
    if (!consent) throw new ValidationError({ analysisConsent: ["An active analysis consent is required."] });

    const requestId = randomUUID();
    const { data: pending, error: pendingError } = await this.database
      .schema("journal_service")
      .from("journal_analyses")
      .insert({
        journal_id: journalId,
        user_id: userId,
        request_id: requestId,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (pendingError || !pending)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The analysis request could not be created.");

    try {
      const result = await this.analysisProvider.analyze({ requestId, journalText: journal.body, language: "en" });
      return this.completeAnalysis(pending as AnalysisRow, result);
    } catch (error) {
      await this.database
        .schema("journal_service")
        .from("journal_analyses")
        .update({ status: "failed", failure_code: errorCode(error), completed_at: new Date().toISOString() })
        .eq("id", (pending as AnalysisRow).id)
        .eq("user_id", userId);
      throw error;
    }
  }

  private async completeAnalysis(pending: AnalysisRow, result: AnalysisProviderResult): Promise<AnalysisResponse> {
    const completedAt = new Date().toISOString();
    const { data, error } = await this.database
      .schema("journal_service")
      .from("journal_analyses")
      .update({
        status: "completed",
        phq8_score: result.phq8Score,
        severity: result.severity,
        urgent_language_detected: result.urgentLanguageDetected,
        processing_time_ms: result.processingTimeMs,
        completed_at: completedAt,
        analyzed_at: completedAt,
        failure_code: null,
      })
      .eq("id", pending.id as string)
      .eq("user_id", pending.user_id as string)
      .select("*")
      .single();
    if (error || !data)
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The analysis result could not be saved.");
    await this.database
      .schema("notification_service")
      .from("notifications")
      .insert({
        user_id: pending.user_id as string,
        notification_type: "analysis_ready",
        title: "Your reflection is ready",
        message: "A development analysis result is available.",
        resource_type: "journal_analysis",
        resource_id: pending.id as string,
      });
    await this.database
      .schema("user_service")
      .from("audit_events")
      .insert({
        actor_user_id: pending.user_id as string,
        user_id: pending.user_id as string,
        event_type: "analysis.completed",
        resource_type: "journal_analysis",
        resource_id: pending.id as string,
        request_id: pending.request_id as string,
        metadata: { provider: "mock", urgent_language_detected: result.urgentLanguageDetected },
      });
    return this.toAnalysisResponse(data as AnalysisRow);
  }

  async getLatestAnalysis(userId: string, journalId: string): Promise<AnalysisResponse | null> {
    await this.get(userId, journalId);
    const analysis = await this.latestAnalysis(journalId, userId);
    return analysis ? this.toAnalysisResponse(analysis) : null;
  }

  private toAnalysisResponse(row: AnalysisRow): AnalysisResponse {
    return {
      id: asString(row.id),
      entry_id: asString(row.journal_id),
      summary: "Development mock result. It is not a clinical assessment.",
      perspective: "This deterministic result exists only for local development and automated testing.",
      mood_insight: "No trained-model mood insight is available in this phase.",
      risk_indication:
        row.urgent_language_detected === true
          ? "Development urgent-language fixture flag"
          : "Development fixture result",
      is_demo_data: true,
      created_at: asString(row.created_at),
      status: asString(row.status),
      phq8_score: typeof row.phq8_score === "number" ? row.phq8_score : null,
      severity: typeof row.severity === "string" ? row.severity : null,
      urgent_language_detected: row.urgent_language_detected === true,
      provider: "mock",
    };
  }
}
