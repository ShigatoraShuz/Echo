import type { InsightsService } from "./insights.service";
import { createInsightsMockAdapter } from "./insights.mock-adapter";

let instance: InsightsService | null = null;

export function getInsightsService(): InsightsService {
  if (instance) return instance;
  instance = createInsightsMockAdapter();
  return instance;
}

export function resetInsightsService(): void {
  instance = null;
}
