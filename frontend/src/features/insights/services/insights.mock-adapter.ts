import type { InsightsService, InsightsServiceResult } from "./insights.service";
import type { EmotionInsightSummary, JournalSourceBreakdown, RiskSignal, InsightTimeRange } from "../model/insights.model";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeError(code: string, message: string): InsightsServiceResult<never> {
  return { success: false, error: { code, message } };
}

export function createInsightsMockAdapter(): InsightsService {
  const service: InsightsService = {
    async getEmotionSummary(timeRange, signal) {
      await delay(200 + Math.random() * 200);
      if (signal?.aborted) return makeError("NETWORK", "Request cancelled");
      return {
        success: true,
        data: {
          emotionWheel: [
            { label: "Calm", mood: "good", value: 30, color: "hsl(150, 30%, 65%)" },
            { label: "Happy", mood: "great", value: 20, color: "hsl(45, 60%, 65%)" },
            { label: "Neutral", mood: "okay", value: 25, color: "hsl(210, 10%, 65%)" },
            { label: "Anxious", mood: "bad", value: 15, color: "hsl(280, 20%, 60%)" },
            { label: "Sad", mood: "awful", value: 10, color: "hsl(220, 25%, 55%)" },
          ],
          moodTrend: [
            { label: "Mon", value: 60, date: "2026-07-21" },
            { label: "Tue", value: 75, date: "2026-07-22" },
            { label: "Wed", value: 45, date: "2026-07-23" },
            { label: "Thu", value: 80, date: "2026-07-24" },
          ],
          summary: "Your emotional landscape shows a predominance of calm and neutral states. Anxious and sad feelings have been present but less frequent.",
          mostFrequentEmotions: [
            { emotion: "Calm", count: 12 },
            { emotion: "Grateful", count: 8 },
            { emotion: "Tired", count: 7 },
            { emotion: "Hopeful", count: 6 },
          ],
          positiveVsDifficult: { positive: 18, difficult: 7 },
        },
      };
    },
    async getMoodTrend(timeRange, signal) {
      await delay(150);
      if (signal?.aborted) return makeError("NETWORK", "Request cancelled");
      return { success: true, data: { points: [] } };
    },
    async getJournalBreakdown(timeRange, signal) {
      await delay(100);
      return {
        success: true,
        data: [
          { source: "Journal entries", count: 15, percentage: 60 },
          { source: "Mood check-ins", count: 8, percentage: 32 },
          { source: "Buddy conversations", count: 2, percentage: 8 },
        ],
      };
    },
    async getRiskSignal(signal) {
      await delay(150);
      return {
        success: true,
        data: {
          score: 22,
          band: "low",
          label: "Low risk",
          history: [
            { date: "Jul 21", score: 30, band: "low" },
            { date: "Jul 22", score: 25, band: "low" },
            { date: "Jul 23", score: 22, band: "low" },
          ],
          supportingFactors: ["Consistent journaling practice", "Regular mood tracking", "Positive emotion identification", "Engagement with grounding tools"],
        },
      };
    },
    async getCameraSettings() {
      return { success: true, data: { isAvailable: true, hasPermission: false } };
    },
  };
  return service;
}
