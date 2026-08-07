import { z } from "zod";

export const aiSeveritySchema = z.enum([
  "minimal",
  "mild",
  "moderate",
  "moderately_severe",
  "severe",
]);

export const aiAnalysisResponseSchema = z.object({
  request_id: z.string().uuid(),
  phq8_score: z.number().int().min(0).max(24),
  severity: aiSeveritySchema,
  urgent_language_detected: z.boolean(),
  model_version: z.string().trim().min(1).max(128),
  processing_time_ms: z.number().int().nonnegative(),
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;
