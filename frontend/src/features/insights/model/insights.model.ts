import type { EchoRiskBand } from "@/shared/theme";

export type InsightTimeRange = "7d" | "30d" | "90d" | "custom";
export type RiskBand = EchoRiskBand;
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

export interface JournalSourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

export interface RiskSignal {
  score: number;
  band: RiskBand;
  label: string;
  history: Array<{ date: string; score: number; band: RiskBand }>;
  supportingFactors: string[];
}

export interface FacialTrendPoint {
  label: string;
  value: number;
}

export interface CameraSettings {
  isAvailable: boolean;
  hasPermission: boolean;
  isActive: boolean;
}
