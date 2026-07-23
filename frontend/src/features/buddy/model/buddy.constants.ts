export const BUDDY_NAME = "Buddy";
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_CONVERSATION_TITLE_LENGTH = 100;
export const TYPING_DURATION_MS = 1500;
export const DEFAULT_PAGE_SIZE = 20;

export const PROMPT_CHIPS = [
  "Help me untangle a thought",
  "Guide a two-minute grounding",
  "Reflect on today",
  "Plan a gentle next step",
] as const;

export const MOOD_LABELS: Record<string, string> = {
  calm: "Calm",
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  anxious: "Anxious",
  angry: "Angry",
};

export const MOOD_COLORS: Record<string, string> = {
  calm: "hsl(150, 30%, 65%)",
  happy: "hsl(45, 60%, 65%)",
  neutral: "hsl(210, 10%, 65%)",
  sad: "hsl(220, 25%, 55%)",
  anxious: "hsl(280, 20%, 60%)",
  angry: "hsl(0, 50%, 60%)",
};
