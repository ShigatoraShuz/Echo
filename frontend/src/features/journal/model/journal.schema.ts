import type { JournalMood, JournalPrivacyStatus, JournalSortOption } from "./journal.model";

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
  const errors: Record<string, string[]> = {};

  if (!input.title || typeof input.title !== "string" || input.title.trim().length === 0) {
    errors.title = ["Title is required"];
  } else if (input.title.length > 200) {
    errors.title = ["Title must be 200 characters or less"];
  }

  if (!input.body || typeof input.body !== "string" || input.body.trim().length === 0) {
    errors.body = ["Body is required"];
  }

  if (!input.mood || !isValidMood(String(input.mood))) {
    errors.mood = ["Invalid mood value"];
  }

  if (input.privacyStatus && !isValidPrivacyStatus(String(input.privacyStatus))) {
    errors.privacyStatus = ["Invalid privacy status"];
  }

  if (input.title && typeof input.title === "string" && input.title.trim().length > 0 && !errors.title) {
    // valid title
  }

  return { valid: Object.keys(errors).length === 0, errors };
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
