import { z } from "zod";

export const journalIdSchema = z.string().uuid();

export const createJournalSchema = z.object({
  title: z.string().trim().max(200).default(""),
  content: z.string().trim().min(1).max(20_000),
  entry_date: z.string().date(),
});

export const journalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).default(""),
  mood: z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export const updateJournalSchema = createJournalSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one journal field must be supplied."
);

export type CreateJournalRequest = z.infer<typeof createJournalSchema>;
export type UpdateJournalRequest = z.infer<typeof updateJournalSchema>;
