import type { AnalysisProvider, AnalysisProviderHealth, AnalysisProviderInput, AnalysisProviderResult } from "./analysis-provider.types.js";
import { createAiClient } from "../ai/ai.client.js";

export function createAiServiceAnalysisProvider(options: {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}): AnalysisProvider {
  const client = createAiClient(options);

  return {
    async analyze(input: AnalysisProviderInput): Promise<AnalysisProviderResult> {
      const result = await client.analyzeJournal({
        requestId: input.requestId,
        journalText: input.journalText,
        language: input.language,
      });

      return {
        requestId: result.request_id,
        phq8Score: result.phq8_score,
        severity: result.severity,
        urgentLanguageDetected: result.urgent_language_detected,
        provider: "ai-service",
        modelVersion: result.model_version,
        processingTimeMs: result.processing_time_ms,
      };
    },

    async healthCheck(): Promise<AnalysisProviderHealth> {
      return {
        status: "ok",
        provider: "ai-service",
      };
    },

    getProviderInfo() {
      return {
        provider: "ai-service" as const,
        version: "phi4-mini-echo-v1",
        developmentOnly: false,
      };
    },
  };
}
