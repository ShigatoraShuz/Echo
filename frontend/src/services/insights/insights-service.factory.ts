import type { InsightsService } from "@/services/insights/insights.service";
import { createInsightsHttpAdapter } from "@/services/insights/insights.http-adapter";

let instance: InsightsService | null = null;

export function getInsightsService(): InsightsService {
  if (instance) return instance;
  instance = createInsightsHttpAdapter();
  return instance;
}

export function resetInsightsService(): void {
  instance = null;
}