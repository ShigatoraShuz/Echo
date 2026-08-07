import { ExternalServiceError } from "../../shared/errors/app-error.js";
import type { AnalysisProvider, AnalysisProviderInput, AnalysisProviderResult, AnalysisSeverity } from "./analysis-provider.types.js";

function severityForScore(score: number): AnalysisSeverity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  if (score <= 19) return "moderately_severe";
  return "severe";
}

function markerScore(text: string): number {
  const match = /\[MOCK:SCORE=(\d{1,2})\]/.exec(text);
  if (!match) return 0;
  const score = Number(match[1]);
  if (!Number.isInteger(score) || score < 0 || score > 24) {
    throw new ExternalServiceError("MOCK_ANALYSIS_INVALID_MARKER", "The development analysis fixture is invalid.");
  }
  return score;
}

/** Development/test-only provider. It evaluates only explicit fixture markers, never journal semantics. */
export function createMockAnalysisProvider(): AnalysisProvider {
  return {
    async analyze(input: AnalysisProviderInput): Promise<AnalysisProviderResult> {
      if (input.journalText.includes("[MOCK:FAIL]")) {
        throw new ExternalServiceError("MOCK_ANALYSIS_FAILED", "The development analysis fixture requested a failure.");
      }
      const score = markerScore(input.journalText);
      return {
        requestId: input.requestId,
        phq8Score: score,
        severity: severityForScore(score),
        urgentLanguageDetected: input.journalText.includes("[MOCK:URGENT=true]"),
        provider: "mock",
        modelVersion: "mock-analysis-v1",
        processingTimeMs: 1,
      };
    },
    async healthCheck() {
      return { status: "ok", provider: "mock" };
    },
    getProviderInfo() {
      return { provider: "mock", version: "mock-analysis-v1", developmentOnly: true };
    },
  };
}
