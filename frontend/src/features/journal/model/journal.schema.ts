import { z } from "zod";
import type { JournalMood, JournalPrivacyStatus, JournalSortOption } from "./journal.model";
import { JOURNAL_MAX_TITLE_LENGTH, JOURNAL_MAX_BODY_LENGTH, JOURNAL_MAX_TAGS } from "./journal.constants";

export const journalMoodSchema = z.enum(["calm", "happy", "neutral", "sad", "anxious", "angry"]);

export const journalPrivacyStatusSchema = z.enum(["private", "shared"]);

export const journalSortOptionSchema = z.enum(["newest", "oldest", "highest-risk", "lowest-risk"]);

export const createJournalSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(JOURNAL_MAX_TITLE_LENGTH, `Title must be ${JOURNAL_MAX_TITLE_LENGTH} characters or less`),
  body: z
    .string()
    .min(1, "Body is required")
    .max(JOURNAL_MAX_BODY_LENGTH, `Body must be ${JOURNAL_MAX_BODY_LENGTH} characters or less`),
  mood: journalMoodSchema,
  emotions: z.array(z.string()).default([]),
  tags: z.array(z.string()).max(JOURNAL_MAX_TAGS, `Maximum ${JOURNAL_MAX_TAGS} tags allowed`).default([]),
  privacyStatus: journalPrivacyStatusSchema,
  analysisConsent: z.boolean().default(false),
});

export const updateJournalSchema = createJournalSchema.partial();

const MOODS: JournalMood[] = ["calm", "happy", "neutral", "sad", "anxious", "angry"];
const PRIVACY_STATUSES: JournalPrivacyStatus[] = ["private", "shared"];
const SORT_OPTIONS: JournalSortOption[] = ["newest", "oldest", "highest-risk", "lowest-risk"];

export function isValidMood(value: string): value is JournalMood {
  return MOODS.includes(value as JournalMood);
}

export function isValidPrivacyStatus(value: string): value is JournalPrivacyStatus {
  return PRIVACY_STATUSES.includes(value as JournalPrivacyStatus);
}

export function isValidSortOption(value: string): value is JournalSortOption {
  return SORT_OPTIONS.includes(value as JournalSortOption);
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

export function validateCreateJournalInput(input: Record<string, unknown>): ValidationResult {
  const result = createJournalSchema.safeParse(input);
  if (result.success) {
    return { valid: true, errors: {} };
  }
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }
  return { valid: false, errors };
}

export const MOOD_LABELS: Record<JournalMood, string> = {
  calm: "Calm",
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  anxious: "Anxious",
  angry: "Angry",
};

export const SORT_LABELS: Record<JournalSortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "highest-risk": "Highest distress signal",
  "lowest-risk": "Lowest distress signal",
};
