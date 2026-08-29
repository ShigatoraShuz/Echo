import { z } from "zod";

export const analysisStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const severitySchema = z.enum([
  "minimal",
  "mild",
  "moderate",
  "moderately_severe",
  "severe",
]);

/** Internal Analysis Service -> ML Service request. */
export const mlInferenceRequestSchema = z.object({
  request_id: z.string().uuid(),
  journal_text: z.string().trim().min(1).max(20_000),
  language: z.string().trim().min(2).max(16).default("en"),
});

/** Internal ML Service response. The runtime may return HTTP 503 until validated artifacts exist. */
export const mlInferenceResponseSchema = z.object({
  request_id: z.string().uuid(),
  phq8_score: z.number().int().min(0).max(24),
  severity: severitySchema,
  urgent_language_detected: z.boolean(),
  model_version: z.string().trim().min(1),
  processing_time_ms: z.number().int().nonnegative(),
});

export const journalAnalysisResponseSchema = z.object({
  id: z.string().uuid(),
  entry_id: z.string().uuid(),
  summary: z.string(),
  perspective: z.string(),
  mood_insight: z.string(),
  risk_indication: z.string().nullable(),
  is_demo_data: z.literal(false),
  created_at: z.string().datetime(),
  status: analysisStatusSchema,
  phq8_score: z.number().int().min(0).max(24).nullable().optional(),
  severity: severitySchema.nullable().optional(),
  urgent_language_detected: z.boolean(),
  provider: z.literal("ml-service"),
});

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type MlInferenceRequest = z.infer<typeof mlInferenceRequestSchema>;
export type MlInferenceResponse = z.infer<typeof mlInferenceResponseSchema>;
export type JournalAnalysisResponse = z.infer<typeof journalAnalysisResponseSchema>;
