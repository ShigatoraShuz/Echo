import { z } from "zod";
import { faceMeshCaptureSchema } from "./analysis.js";

export const journalIdSchema = z.string().uuid();

export const journalSubmissionObjectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]),
  emotions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  privacyStatus: z.enum(["private", "shared"]).default("private"),
  analysisConsent: z.boolean().default(false),
  facialAnalysisRequested: z.boolean().default(false),
  facialCapture: faceMeshCaptureSchema.optional(),
});

export const journalSubmissionInputSchema = journalSubmissionObjectSchema.superRefine((value, context) => {
  if (value.facialAnalysisRequested && !value.analysisConsent) {
    context.addIssue({
      code: "custom",
      path: ["facialAnalysisRequested"],
      message: "Facial capture requires journal analysis consent.",
    });
  }
  if (value.facialCapture && !value.facialAnalysisRequested) {
    context.addIssue({
      code: "custom",
      path: ["facialCapture"],
      message: "A facial capture must be explicitly requested.",
    });
  }
});
export type JournalSubmissionInput = z.infer<typeof journalSubmissionInputSchema>;

export const createJournalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  entry_date: z.string().date(),
});

export const updateJournalSchema = createJournalSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one journal field must be supplied.");

export type CreateJournalRequest = z.infer<typeof createJournalSchema>;
export type UpdateJournalRequest = z.infer<typeof updateJournalSchema>;
