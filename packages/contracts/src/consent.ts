import { z } from "zod";

export const consentTypeSchema = z.enum([
  "terms_of_use",
  "privacy_policy",
  "journal_analysis",
]);

export const createConsentSchema = z.object({
  consent_type: consentTypeSchema,
  consent_version: z.string().trim().min(1).max(64),
  accepted: z.literal(true),
});

export type ConsentType = z.infer<typeof consentTypeSchema>;
export type CreateConsentRequest = z.infer<typeof createConsentSchema>;
