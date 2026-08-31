import type { EmotionInsightSummary, InsightTimeRange } from "@/features/insights/model/insights.model";

export type InsightsServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface InsightsService {
  getEmotionSummary(timeRange: InsightTimeRange, signal?: AbortSignal): Promise<InsightsServiceResult<EmotionInsightSummary>>;
}
