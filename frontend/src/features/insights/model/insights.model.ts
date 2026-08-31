export type InsightTimeRange = "7d" | "30d" | "90d";
export type MoodLevel = "awful" | "bad" | "okay" | "good" | "great" | "unknown";

export interface EmotionDistribution {
  label: string;
  mood: MoodLevel;
  value: number;
  color: string;
}
export interface MoodTrendPoint {
  label: string;
  value: number;
  date: string;
}

export interface EmotionInsightSummary {
  emotionWheel: EmotionDistribution[];
  moodTrend: MoodTrendPoint[];
  summary: string;
  mostFrequentEmotions: Array<{ emotion: string; count: number }>;
  positiveVsDifficult: { positive: number; difficult: number };
}
