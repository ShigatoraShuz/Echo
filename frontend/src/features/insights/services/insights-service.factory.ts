import type { InsightsService } from "./insights.service";
import { createInsightsMockAdapter } from "./insights.mock-adapter";
import { createInsightsHttpAdapter } from "./insights.http-adapter";
import { isMockAdapter } from "@/shared/services/service-adapter";

let instance: InsightsService | null = null;

export function getInsightsService(): InsightsService {
  if (instance) return instance;
  instance = isMockAdapter() ? createInsightsMockAdapter() : createInsightsHttpAdapter();
  return instance;
}

export function resetInsightsService(): void {
  instance = null;
}