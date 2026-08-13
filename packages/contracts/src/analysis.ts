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

/** Internal provider contract. In this phase the only provider is development-only `mock`. */
export const analysisProviderRequestSchema = z.object({
  request_id: z.string().uuid(),
  journal_text: z.string().trim().min(1).max(20_000),
  language: z.string().trim().min(2).max(16).default("en"),
});

export const mockAnalysisResponseSchema = z.object({
  request_id: z.string().uuid(),
  phq8_score: z.number().int().min(0).max(24),
  severity: severitySchema,
  urgent_language_detected: z.boolean(),
  provider: z.literal("mock"),
  provider_version: z.literal("mock-analysis-v1"),
  processing_time_ms: z.number().int().nonnegative(),
});

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type AnalysisProviderRequest = z.infer<typeof analysisProviderRequestSchema>;
export type MockAnalysisResponse = z.infer<typeof mockAnalysisResponseSchema>;
