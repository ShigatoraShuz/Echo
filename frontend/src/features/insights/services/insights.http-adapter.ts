import type { InsightsService, InsightsServiceResult } from "./insights.service";
import type {
  EmotionInsightSummary,
  EmotionDistribution,
  MoodLevel,
  InsightTimeRange,
} from "../model/insights.model";
import { env } from "@/config/environment";
import { createApiClient } from "@/shared/services/api-client";
import { supabaseAuthTokenProvider } from "@/shared/services/supabase-auth-token-provider";

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface EmotionInsightsResponse {
  emotionWheel: Array<{ label: string; mood: string; value: number }>;
  moodTrend: Array<{ label: string; value: number }>;
  summary: string;
}

const MOOD_LEVELS: Record<string, MoodLevel> = {
  calm: "good",
  happy: "great",
  neutral: "okay",
  anxious: "bad",
  sad: "awful",
  angry: "bad",
};

const MOOD_COLORS: Record<string, string> = {
  calm: "hsl(150, 30%, 65%)",
  happy: "hsl(45, 60%, 65%)",
  neutral: "hsl(210, 10%, 65%)",
  anxious: "hsl(280, 20%, 60%)",
  sad: "hsl(220, 25%, 55%)",
  angry: "hsl(0, 45%, 60%)",
};

const NOT_SUPPORTED_MESSAGE = "This insight is not available in the current build of the backend.";

function mapEmotionWheel(wheel: EmotionInsightsResponse["emotionWheel"]): EmotionDistribution[] {
  return wheel.map((entry) => ({
    label: entry.label,
    mood: MOOD_LEVELS[entry.mood] ?? "unknown",
    value: entry.value,
    color: MOOD_COLORS[entry.mood] ?? "hsl(210, 10%, 65%)",
  }));
}

function mapSummary(response: EmotionInsightsResponse): EmotionInsightSummary {
  const emotionWheel = mapEmotionWheel(response.emotionWheel);
  const positive = emotionWheel
    .filter((entry) => entry.mood === "good" || entry.mood === "great" || entry.mood === "okay")
    .reduce((sum, entry) => sum + entry.value, 0);
  const difficult = emotionWheel
    .filter((entry) => entry.mood === "bad" || entry.mood === "awful")
    .reduce((sum, entry) => sum + entry.value, 0);
  const mostFrequent = [...emotionWheel]
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((entry) => ({ emotion: entry.label, count: entry.value }));
  return {
    emotionWheel,
    moodTrend: response.moodTrend.map((point) => ({ label: point.label, value: point.value, date: point.label })),
    summary: response.summary,
    mostFrequentEmotions: mostFrequent,
    positiveVsDifficult: { positive, difficult },
  };
}

export function createInsightsHttpAdapter(): InsightsService {
  const client = createApiClient({
    baseUrl: env.apiBaseUrl,
    tokenProvider: supabaseAuthTokenProvider,
  });

  return {
    async getEmotionSummary(_timeRange: InsightTimeRange, signal) {
      try {
        const response = await client.get<ApiEnvelope<EmotionInsightsResponse>>("/insights/emotions", { signal });
        return { success: true, data: mapSummary(response.data) };
      } catch (error) {
        return { success: false, error: { code: "UNKNOWN", message: "Failed to load emotion insights." } };
      }
    },

    async getMoodTrend(_timeRange: InsightTimeRange, signal) {
      try {
        const response = await client.get<ApiEnvelope<EmotionInsightsResponse>>("/insights/emotions", { signal });
        return {
          success: true,
          data: { points: response.data.moodTrend.map((point) => ({ label: point.label, value: point.value, date: point.label })) },
        };
      } catch (error) {
        return { success: false, error: { code: "UNKNOWN", message: "Failed to load the mood trend." } };
      }
    },

    async getJournalBreakdown() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async getRiskSignal() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async getFacialTrend() {
      return { success: false, error: { code: "UNKNOWN", message: NOT_SUPPORTED_MESSAGE } };
    },

    async getCameraSettings() {
      // Camera-based mood tracking is not part of the current product surface.
      return { success: true, data: { isAvailable: false, hasPermission: false } };
    },
  };
}