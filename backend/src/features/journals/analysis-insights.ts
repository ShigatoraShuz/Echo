import type { DashboardInsights, JournalAnalysisResult } from "@echo/contracts";

export interface DatedAnalysis {
  id: string;
  createdAt: string;
  result: JournalAnalysisResult;
}

/** Inputs have already passed account/deletion/completion checks and authenticated decryption. */
export function analysisTrends(records: DatedAnalysis[]): Pick<DashboardInsights,
  "emotionTrend" | "distressTrend" | "categoryTrend" | "journalScreeningTrend"> {
  const daily = new Map<string, DatedAnalysis>();
  for (const record of [...records].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    if (record.result.isSimulated) continue;
    // Keep each model family separate; a newer, unrelated model must not erase the day's history.
    const r = record.result;
    const identity = r.schemaVersion === "echo-model-pipeline-v2"
      ? Object.values(r.stages).map(s => `${s.modelId}@${s.modelVersion}`).join("|")
      : r.schemaVersion === "echo-journal-analysis-v1" ? `legacy:${r.providerName}@${r.modelVersion}`
      : `native:${r.models.e4.modelVersion}:${r.models.e4.inferenceVersion}|${r.models.xlmr.modelVersion}:${r.models.xlmr.inferenceVersion}`;
    daily.set(`${utcDay(record.createdAt)}:${identity}`, record);
  }
  const rows = [...daily.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return {
    emotionTrend: perModelDay(rows.flatMap(({ createdAt, result: r }) => {
      const values = r.schemaVersion === "echo-model-pipeline-v2" ? r.stages.peak.result?.scores.map(s => [s.label, s.probability])
        : r.emotionDistribution.map(s => [s.emotion, s.value]);
      if (!values) return [];
      const modelIdentity = r.schemaVersion === "echo-model-pipeline-v2" ? `${r.stages.peak.modelId}@${r.stages.peak.modelVersion}`
        : r.schemaVersion === "echo-journal-analysis-v1" ? `legacy:${r.providerName}@${r.modelVersion}`
        : `native:${r.models.e4.providerName}@${r.models.e4.modelVersion}:${r.models.e4.inferenceVersion}`;
      return [{ date: utcDay(createdAt), values: Object.fromEntries(values), isSimulated: false,
        schemaVersion: r.schemaVersion, modelIdentity }];
    })),
    distressTrend: rows.flatMap(({ createdAt, result: r }) => r.schemaVersion === "echo-journal-analysis-v1" ? [{
      date: utcDay(createdAt), band: r.distressBand,
      // Historical wire compatibility only: ordinal band position, never a measured risk score.
      value: ["low", "mild", "moderate", "high", "severe"].indexOf(r.distressBand) / 4, isSimulated: false,
    }] : []),
    categoryTrend: perModelDay(rows.flatMap(({ createdAt, result: r }) => {
      if (r.schemaVersion === "echo-journal-analysis-v1") return [];
      const label = r.schemaVersion === "echo-model-pipeline-v2" ? r.stages.distress.result?.topFive[0]?.label : r.distressCategory;
      const modelIdentity = r.schemaVersion === "echo-model-pipeline-v2" ? `${r.stages.distress.modelId}@${r.stages.distress.modelVersion}`
        : `${r.models.xlmr.providerName}@${r.models.xlmr.modelVersion}:${r.models.xlmr.inferenceVersion}`;
      return label ? [{ date: utcDay(createdAt), label, modelIdentity }] : [];
    })),
    journalScreeningTrend: rows.flatMap(({ createdAt, result: r }) => {
      const date = utcDay(createdAt);
      if (r.schemaVersion === "echo-journal-analysis-v3") {
        const { status, coverage, subtotal, total } = r.journalScreening;
        return [{ date, status, coverage, subtotal, total }];
      }
      if (r.schemaVersion !== "echo-model-pipeline-v2") return [];
      const s = r.stages.phq8;
      return [{ date, status: s.result ? "available" as const : s.status === "failed" ? "failed" as const : "unavailable" as const,
        coverage: s.result?.scored_symptom_count ?? 0, subtotal: s.result?.scored_symptom_count ? s.result.subtotal : null,
        total: s.result?.total ?? null }];
    }),
  };
}

// A different recommendation/other stage must not duplicate the same classifier's daily point.
function perModelDay<T extends { date: string; modelIdentity?: string }>(points: T[]): T[] {
  return [...new Map(points.map(point => [`${point.date}:${point.modelIdentity ?? ""}`, point])).values()];
}

function utcDay(timestamp: string): string { return new Date(timestamp).toISOString().slice(0, 10); }
