import type { DashboardInsights, JournalAnalysisResult } from "@echo/contracts";

export function analysisSummary(result?: JournalAnalysisResult | null) {
  if (!result) return { status: "unavailable", emotion: null, distress: null, distressKind: "category" } as const;
  if (result.schemaVersion === "echo-model-pipeline-v2") return {
    status: result.overallStatus === "completed" ? "complete" : result.overallStatus,
    emotion: result.stages.peak.result?.topFive[0]?.label ?? null,
    distress: result.stages.distress.result?.topFive[0]?.label ?? null,
    distressKind: "category" as const,
  };
  return {
    status: result.schemaVersion === "echo-journal-analysis-v3" &&
      (result.journalScreening.status !== "available" || result.journalScreening.coverage !== 8) ? "partial" : "complete",
    emotion: result.dominantEmotion,
    distress: result.schemaVersion === "echo-journal-analysis-v1" ? result.distressBand : result.distressCategory,
    distressKind: result.schemaVersion === "echo-journal-analysis-v1" ? "band" : "category",
  };
}

export function analysisRequestMessage(insights?: DashboardInsights | null): string | null {
  const job = insights?.latestRequest;
  if (!job || job.status === "completed") return insights?.processorAvailable === false
    ? "New analysis is unavailable in this configuration. Saved results remain readable." : null;
  if (job.status === "failed") return "The latest analysis failed. Earlier saved results remain available.";
  if (job.status === "safety_action_required") return "The latest analysis needs your attention. Open the reflection for support options.";
  if (job.status === "waiting_for_provider" || insights?.processorAvailable === false)
    return "The latest analysis is unavailable while its provider is disconnected. Earlier saved results remain available.";
  return "A newer analysis is pending. Only successfully saved results are shown below.";
}
