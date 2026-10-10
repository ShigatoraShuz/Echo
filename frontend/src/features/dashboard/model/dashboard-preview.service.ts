import type { DashboardInsights } from "@echo/contracts";
import type { DashboardService } from "@/services/dashboard/dashboard.service";
import { createDashboardMockAdapter } from "@/services/dashboard/dashboard.mock-adapter";

const mockDashboard = createDashboardMockAdapter();

function recentDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export const dashboardPreviewService: DashboardService = {
  async getDashboardData(timeRange) {
    const result = await mockDashboard.getDashboardData(timeRange);
    if (!result.success) return result;

    const journalEntries = result.data.journalEntries.map((entry, index) => ({
      ...entry,
      createdAt: recentDate(index),
      updatedAt: recentDate(index),
    }));

    const analysisInsights: DashboardInsights = {
      latestResultId: null,
      latest: {
        schemaVersion: "echo-journal-analysis-v1",
        thresholdVersion: "v1",
        providerName: "preview",
        modelVersion: "preview-v1",
        isSimulated: true,
        emotionDistribution: [
          { emotion: "joy", value: 0.1 },
          { emotion: "calm", value: 0.4 },
          { emotion: "sadness", value: 0.1 },
          { emotion: "anxiety", value: 0.1 },
          { emotion: "anger", value: 0.1 },
          { emotion: "hope", value: 0.2 },
        ],
        dominantEmotion: "calm",
        emotionConfidence: 0.9,
        distressBand: "low",
        distressConfidence: 0.85,
        depressiveSymptomRange: { lower: 0, upper: 4 },
        recommendationFeatures: ["paced_breathing"],
        facialExpressionAnalysis: null,
      },
      recommendation: null,
      emotionTrend: [
        { date: recentDate(2), values: { calm: 0.3 }, isSimulated: true },
        { date: recentDate(1), values: { calm: 0.5 }, isSimulated: true },
        { date: recentDate(0), values: { calm: 0.4 }, isSimulated: true },
      ],
      distressTrend: [],
    };

    return {
      ...result,
      data: {
        ...result.data,
        latestEntry: journalEntries[0] ?? null,
        journalEntries,
        analysisInsights,
      },
    };
  },
};
