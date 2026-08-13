import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "INVALID_ACCESS_TOKEN",
  "RESOURCE_FORBIDDEN",
  "JOURNAL_NOT_FOUND",
  "ANALYSIS_ALREADY_RUNNING",
  "CONSENT_REQUIRED",
  "AI_SERVICE_UNAVAILABLE",
  "AI_RESPONSE_INVALID",
  "RATE_LIMIT_EXCEEDED",
  "INTERNAL_SERVER_ERROR",
  "NOT_FOUND",
]);

export const apiErrorPayloadSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;
