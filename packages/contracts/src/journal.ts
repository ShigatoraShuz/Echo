import { z } from "zod";

export const journalIdSchema = z.string().uuid();

export const createJournalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  entry_date: z.string().date(),
});

export const updateJournalSchema = createJournalSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one journal field must be supplied."
);

export type CreateJournalRequest = z.infer<typeof createJournalSchema>;
export type UpdateJournalRequest = z.infer<typeof updateJournalSchema>;
