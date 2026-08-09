import type { EmotionInsightSummary, JournalSourceBreakdown, RiskSignal, InsightTimeRange, FacialTrendPoint } from "../model/insights.model";

export type InsightsServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface InsightsService {
  getEmotionSummary(timeRange: InsightTimeRange, signal?: AbortSignal): Promise<InsightsServiceResult<EmotionInsightSummary>>;
  getMoodTrend(timeRange: InsightTimeRange, signal?: AbortSignal): Promise<InsightsServiceResult<{ points: EmotionInsightSummary["moodTrend"] }>>;
  getJournalBreakdown(timeRange: InsightTimeRange, signal?: AbortSignal): Promise<InsightsServiceResult<JournalSourceBreakdown[]>>;
  getRiskSignal(signal?: AbortSignal): Promise<InsightsServiceResult<RiskSignal>>;
  getFacialTrend(signal?: AbortSignal): Promise<InsightsServiceResult<{ points: FacialTrendPoint[] }>>;
  getCameraSettings(): Promise<InsightsServiceResult<{ isAvailable: boolean; hasPermission: boolean }>>;
}
