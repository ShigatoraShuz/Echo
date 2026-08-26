import type { BackendEnvironment } from "../../config/environment.js";
import { createAiServiceAnalysisProvider } from "./ai-service-analysis.provider.js";
import { createMockAnalysisProvider } from "./mock-analysis.provider.js";
import type { AnalysisProvider } from "./analysis-provider.types.js";

export function createAnalysisProvider(environment: BackendEnvironment): AnalysisProvider {
  if (environment.ANALYSIS_PROVIDER === "ai-service") {
    if (!environment.AI_SERVICE_TOKEN) {
      throw new Error("AI_SERVICE_TOKEN is required when ANALYSIS_PROVIDER=ai-service.");
    }

    return createAiServiceAnalysisProvider({
      baseUrl: environment.AI_SERVICE_URL,
      token: environment.AI_SERVICE_TOKEN,
      timeoutMs: environment.REQUEST_TIMEOUT_MS,
    });
  }

  if (environment.NODE_ENV === "production" || !environment.ALLOW_MOCK_ANALYSIS) {
    throw new Error("The mock analysis provider is unavailable outside explicitly enabled non-production environments.");
  }

  return createMockAnalysisProvider();
}