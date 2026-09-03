import type { AnalysisFixture, JournalAnalysisResult } from "@echo/contracts";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import type { AiAnalysisProvider, AnalysisProgressUpdate } from "./analysis-provider.types.js";

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });

function fixtureResult(fixture: AnalysisFixture): JournalAnalysisResult {
  const moderate = fixture === "standard_moderate_distress";
  return {
    schemaVersion: "echo-journal-analysis-v1",
    thresholdVersion: "echo-thresholds-v1",
    providerName: "echo-development-stub",
    modelVersion: "deterministic-fixtures-v1",
    isSimulated: true,
    emotionDistribution: moderate
      ? [
          { emotion: "joy", value: 0.08 },
          { emotion: "calm", value: 0.12 },
          { emotion: "sadness", value: 0.26 },
          { emotion: "anxiety", value: 0.31 },
          { emotion: "anger", value: 0.09 },
          { emotion: "hope", value: 0.14 },
        ]
      : [
          { emotion: "joy", value: 0.18 },
          { emotion: "calm", value: 0.35 },
          { emotion: "sadness", value: 0.08 },
          { emotion: "anxiety", value: 0.11 },
          { emotion: "anger", value: 0.05 },
          { emotion: "hope", value: 0.23 },
        ],
    dominantEmotion: moderate ? "anxiety" : "calm",
    emotionConfidence: moderate ? 0.82 : 0.86,
    distressBand: moderate ? "moderate" : "low",
    distressConfidence: moderate ? 0.84 : 0.88,
    depressiveSymptomRange: moderate ? { lower: 10, upper: 14 } : { lower: 0, upper: 4 },
    recommendationFeatures: moderate ? ["grounding", "behavioral_activation"] : ["paced_breathing"],
    facialExpressionAnalysis: null,
  };
}

export function createDevelopmentStubProvider(): AiAnalysisProvider {
  return {
    async healthCheck() {
      return { available: true, mode: "development_stub", detail: "development fixture runner ready" };
    },
    async analyze(input, options) {
      const emit = async (status: AnalysisProgressUpdate["status"]) => {
        options.signal?.throwIfAborted();
        await options.onProgress?.({ status });
        await wait(input.fixture === "slow_processing" ? 250 : 1, options.signal);
      };
      if (!input.reviewedResume) {
        await emit("safety_checking");
        if (input.fixture === "safety_support_required") {
          await emit("safety_action_required");
          return { safetyActionRequired: true };
        }
      }
      await emit("analyzing_emotions");
      await emit("classifying_distress");
      await emit("estimating_screening");
      await emit("generating_recommendation");
      if (input.fixture === "processing_failure")
        throw new ExternalServiceError("DEVELOPMENT_FIXTURE_FAILURE", "The simulated analysis could not be completed.");
      if (input.fixture === "invalid_output")
        return { safetyActionRequired: false, result: { invalid: true } as never };
      return { safetyActionRequired: false, result: fixtureResult(input.fixture) };
    },
  };
}
export function createDisabledAnalysisProvider(): AiAnalysisProvider {
  return {
    async healthCheck() {
      return { available: false, mode: "disabled", detail: "disabled" };
    },
    async analyze() {
      throw new ExternalServiceError("ANALYSIS_DISABLED", "AI insights are not available yet.");
    },
  };
}
export const createMockAnalysisProvider = createDevelopmentStubProvider;
