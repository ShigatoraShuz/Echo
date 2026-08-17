import type { InsightsService } from "@/services/insights/insights.service";
import { createInsightsMockAdapter } from "@/services/insights/insights.mock-adapter";
import { createInsightsHttpAdapter } from "@/services/insights/insights.http-adapter";
import { isMockAdapter } from "@/infrastructure/api/service-adapter";

let instance: InsightsService | null = null;

export function getInsightsService(): InsightsService {
  if (instance) return instance;
  instance = isMockAdapter() ? createInsightsMockAdapter() : createInsightsHttpAdapter();
  return instance;
}

export function resetInsightsService(): void {
  instance = null;
}