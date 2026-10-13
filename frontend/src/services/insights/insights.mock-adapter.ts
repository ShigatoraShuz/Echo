import type { InsightsService, InsightsServiceResult } from "@/services/insights/insights.service";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeError(code: string, message: string): InsightsServiceResult<never> {
  return { success: false, error: { code, message } };
}

export function createInsightsMockAdapter(): InsightsService {
  const service: InsightsService = {
    async getAnalysisOverview(timeRange, customRange, signal) {
      await delay(180);
      if (signal?.aborted) return makeError("NETWORK", "Request cancelled");
      const today = new Date().toISOString().slice(0, 10);
      return {
        success: true,
        data: {
          latestResultId: "00000000-0000-4000-8000-000000000010",
          latest: {
            schemaVersion: "echo-journal-analysis-v1",
            thresholdVersion: "echo-thresholds-v1",
            providerName: "echo-development-stub",
            modelVersion: "deterministic-fixtures-v1",
            isSimulated: true,
            emotionDistribution: [
              { emotion: "joy", value: 0.14 },
              { emotion: "calm", value: 0.38 },
              { emotion: "sadness", value: 0.08 },
              { emotion: "anxiety", value: 0.16 },
              { emotion: "anger", value: 0.05 },
              { emotion: "hope", value: 0.19 },
            ],
            dominantEmotion: "calm",
            emotionConfidence: 0.86,
            distressBand: "low",
            distressConfidence: 0.88,
            depressiveSymptomRange: { lower: 0, upper: 4 },
            recommendationFeatures: ["paced_breathing", "grounding"],
            facialExpressionAnalysis: null,
          },
          recommendation: {
            id: "00000000-0000-4000-8000-000000000011",
            title: "A slower breath",
            description: "Let the exhale last a little longer than the inhale.",
            activity: "paced_breathing",
          },
          emotionTrend: [
            { date: "2026-10-07", values: { joy: 0.12, calm: 0.28, sadness: 0.1, anxiety: 0.22, anger: 0.08, hope: 0.2 }, isSimulated: true },
            { date: "2026-10-08", values: { joy: 0.14, calm: 0.34, sadness: 0.08, anxiety: 0.18, anger: 0.06, hope: 0.2 }, isSimulated: true },
            { date: "2026-10-09", values: { joy: 0.16, calm: 0.31, sadness: 0.08, anxiety: 0.17, anger: 0.08, hope: 0.2 }, isSimulated: true },
            { date: "2026-10-10", values: { joy: 0.12, calm: 0.42, sadness: 0.07, anxiety: 0.12, anger: 0.06, hope: 0.21 }, isSimulated: true },
          ],
          distressTrend: [
            { date: "2026-10-07", band: "mild", value: 0.25, isSimulated: true },
            { date: "2026-10-08", band: "mild", value: 0.25, isSimulated: true },
            { date: "2026-10-09", band: "low", value: 0, isSimulated: true },
            { date: "2026-10-10", band: "low", value: 0, isSimulated: true },
          ],
          period: {
            range: timeRange,
            from: timeRange === "custom" && customRange ? customRange.from : "2026-09-12",
            to: timeRange === "custom" && customRange ? customRange.to : today,
            analyzedReflectionCount: 4,
          },
          facialStatus: "captured_pending_provider",
        },
      };
    },

    async getEmotionSummary(_timeRange, signal) {
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
    async getMoodTrend(_timeRange, signal) {
      await delay(150);
      if (signal?.aborted) return makeError("NETWORK", "Request cancelled");
      return { success: true, data: { points: [] } };
    },
    async getJournalBreakdown() {
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
    async getRiskSignal() {
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
    async getFacialTrend(signal) {
      await delay(150);
      if (signal?.aborted) return makeError("NETWORK", "Request cancelled");
      return {
        success: true,
        data: {
          points: [
            { label: "Mon", value: 35 },
            { label: "Tue", value: 48 },
            { label: "Wed", value: 42 },
            { label: "Thu", value: 60 },
            { label: "Fri", value: 55 },
            { label: "Sat", value: 72 },
            { label: "Sun", value: 68 },
          ],
        },
      };
    },
    async getCameraSettings() {
      return { success: true, data: { isAvailable: true, hasPermission: false } };
    },
  };
  return service;
}
