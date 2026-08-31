import type { BackendEnvironment } from "../../config/environment.js";
import { createDevelopmentStubProvider, createDisabledAnalysisProvider } from "./mock-analysis.provider.js";
import type { AiAnalysisProvider } from "./analysis-provider.types.js";

export function createAnalysisProvider(environment: BackendEnvironment): AiAnalysisProvider {
  if (environment.AI_ANALYSIS_MODE === "disabled") return createDisabledAnalysisProvider();
  if (environment.AI_ANALYSIS_MODE === "development_stub") {
    if (environment.NODE_ENV === "production")
      throw new Error("The development analysis stub is unavailable in production.");
    return createDevelopmentStubProvider();
  }
  return createDisabledAnalysisProvider();
}
