import type { JournalMood } from "../model/journal.model";

export interface MoodVisualConfig {
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  bgGradient: string;
  emoji: string;
}

export const MOOD_VISUAL_MAP: Record<JournalMood, MoodVisualConfig> = {
  calm: {
    label: "Calm",
    dotColor: "#536733",
    badgeBg: "rgba(83, 103, 51, 0.12)",
    badgeText: "#536733",
    borderColor: "rgba(83, 103, 51, 0.25)",
    bgGradient: "linear-gradient(135deg, rgba(251, 247, 238, 0.95), rgba(220, 232, 214, 0.4))",
    emoji: "🌿",
  },
  happy: {
    label: "Happy",
    dotColor: "#6fa87d",
    badgeBg: "rgba(111, 168, 125, 0.16)",
    badgeText: "#2f5c38",
    borderColor: "rgba(111, 168, 125, 0.3)",
    bgGradient: "linear-gradient(135deg, rgba(251, 247, 238, 0.95), rgba(240, 245, 230, 0.5))",
    emoji: "☀️",
  },
  neutral: {
    label: "Neutral",
    dotColor: "#7e8875",
    badgeBg: "rgba(126, 136, 117, 0.14)",
    badgeText: "#454d3d",
    borderColor: "rgba(126, 136, 117, 0.22)",
    bgGradient: "linear-gradient(135deg, rgba(255, 253, 247, 0.95), rgba(235, 238, 232, 0.4))",
    emoji: "🍃",
  },
  anxious: {
    label: "Anxious",
    dotColor: "#c98483",
    badgeBg: "rgba(201, 132, 131, 0.16)",
    badgeText: "#964544",
    borderColor: "rgba(201, 132, 131, 0.3)",
    bgGradient: "linear-gradient(135deg, rgba(255, 253, 247, 0.95), rgba(248, 235, 235, 0.5))",
    emoji: "🌧️",
  },
  sad: {
    label: "Sad",
    dotColor: "#8b7065",
    badgeBg: "rgba(139, 112, 101, 0.14)",
    badgeText: "#634c43",
    borderColor: "rgba(139, 112, 101, 0.25)",
    bgGradient: "linear-gradient(135deg, rgba(255, 253, 247, 0.95), rgba(240, 233, 229, 0.45))",
    emoji: "💧",
  },
  angry: {
    label: "Angry",
    dotColor: "#d9534f",
    badgeBg: "rgba(217, 83, 79, 0.14)",
    badgeText: "#9c2a26",
    borderColor: "rgba(217, 83, 79, 0.28)",
    bgGradient: "linear-gradient(135deg, rgba(255, 253, 247, 0.95), rgba(250, 232, 231, 0.5))",
    emoji: "🔥",
  },
};

export function getMoodVisual(mood: JournalMood): MoodVisualConfig {
  return MOOD_VISUAL_MAP[mood] ?? MOOD_VISUAL_MAP.neutral;
}

export function formatJournalDate(rawDate: string): {
  fullDate: string;
  timeString: string;
  relativeTime: string;
  monthYearKey: string;
  monthName: string;
  dayNumber: string;
  weekday: string;
} {
  const date = new Date(rawDate);
  const isValid = !isNaN(date.getTime());
  const d = isValid ? date : new Date();

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const fullWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
  const fullMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
  const dayNumber = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(d);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(d);
  const timeString = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

  const fullDate = `${fullWeekday}, ${monthName} ${dayNumber}, ${year}`;
  const monthYearKey = `${fullMonth} ${year}`;

  // Relative time calculation
  const now = new Date().getTime();
  const diffMs = now - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relativeTime = "";
  if (diffHours < 1) {
    relativeTime = "Just now";
  } else if (diffHours < 24) {
    relativeTime = `${diffHours}h ago`;
  } else if (diffDays === 1) {
    relativeTime = "Yesterday";
  } else if (diffDays < 7) {
    relativeTime = `${diffDays} days ago`;
  } else {
    relativeTime = `${monthName} ${dayNumber}`;
  }

  return {
    fullDate,
    timeString,
    relativeTime,
    monthYearKey,
    monthName,
    dayNumber,
    weekday,
  };
}

export function calculateReadingTime(text: string): { words: number; readingTime: string } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, readingTime: "1 min read" };
  const words = trimmed.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return {
    words,
    readingTime: `${minutes} min read`,
  };
}
