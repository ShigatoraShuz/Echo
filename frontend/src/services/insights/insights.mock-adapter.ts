import type { InsightsService, InsightsServiceResult } from "@/services/insights/insights.service";

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
          summary: `Across the selected ${timeRange} range, your emotional landscape shows a predominance of calm and neutral states. Anxious and sad feelings have been present but less frequent.`,
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
  };
  return service;
}
