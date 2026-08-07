import type { BackendEnvironment } from "../../config/environment.js";
import { createMockAnalysisProvider } from "./mock-analysis.provider.js";
import type { AnalysisProvider } from "./analysis-provider.types.js";

export function createAnalysisProvider(environment: BackendEnvironment): AnalysisProvider {
  if (environment.NODE_ENV === "production" || !environment.ALLOW_MOCK_ANALYSIS) {
    throw new Error("The mock analysis provider is unavailable outside explicitly enabled non-production environments.");
  }
  return createMockAnalysisProvider();
}
