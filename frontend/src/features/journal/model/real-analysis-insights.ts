import type { DashboardInsights } from "@echo/contracts";

/** Normal account views never present development predictions as saved AI results. */
export function realAnalysisInsights(value?: DashboardInsights | null): DashboardInsights | undefined {
  if (!value) return undefined;
  const simulated = value.latest?.isSimulated === true;
  return {
    ...value,
    latest: simulated ? null : value.latest,
    latestResultId: simulated ? null : value.latestResultId,
    latestAnalyzedAt: simulated ? null : value.latestAnalyzedAt,
    recommendation: simulated ? null : value.recommendation,
    emotionTrend: value.emotionTrend.filter(point => !point.isSimulated),
    distressTrend: value.distressTrend.filter(point => !point.isSimulated),
    categoryTrend: simulated ? [] : value.categoryTrend,
    journalScreeningTrend: simulated ? [] : value.journalScreeningTrend,
    period: simulated ? undefined : value.period,
  };
}
