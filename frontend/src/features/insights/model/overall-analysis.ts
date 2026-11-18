import type { DashboardInsights } from "@echo/contracts";
export type AverageSignal = { label: string; value: number; observations: number };
function averages(rows: Array<Record<string, number>>): AverageSignal[] {
  const values = new Map<string, { sum: number; count: number }>();
  for (const row of rows)
    for (const [label, value] of Object.entries(row)) {
      if (!Number.isFinite(value)) continue;
      const item = values.get(label) ?? { sum: 0, count: 0 };
      item.sum += value;
      item.count++;
      values.set(label, item);
    }
  return [...values]
    .map(([label, item]) => ({ label, value: item.sum / item.count, observations: item.count }))
    .sort((a, b) => b.value - a.value);
}
export function overallAnalysis(insights: DashboardInsights, allowSimulated = false) {
  const within = (date: string) =>
    !insights.period || (date.slice(0, 10) >= insights.period.from && date.slice(0, 10) <= insights.period.to);
  const sources = new Map<string, DashboardInsights["emotionTrend"]>();
  for (const point of insights.emotionTrend) {
    if ((point.isSimulated && !allowSimulated) || !within(point.date) || !Object.keys(point.values).length) continue;
    const key = point.modelIdentity ?? point.schemaVersion ?? "Saved text analysis";
    const rows = sources.get(key) ?? [];
    rows.push(point);
    sources.set(key, rows);
  }
  const emotionSources = [...sources].map(([identity, points]) => ({
    identity,
    points: points.sort((a, b) => a.date.localeCompare(b.date)),
    scores: averages(points.map((point) => point.values)),
  }));
  const estimates = (insights.journalScreeningTrend ?? []).filter((point) => within(point.date));
  const complete = estimates.filter(
    (point) => point.status === "available" && point.coverage === 8 && point.total !== null,
  );
  const partial = estimates.filter((point) => point.status === "available" && point.coverage < 8);
  const faces = new Map<string, NonNullable<DashboardInsights["facialResults"]>[number]>();
  for (const item of [...(insights.facialResults ?? [])].sort(
    (a, b) => Date.parse(b.result.generatedAt ?? "") - Date.parse(a.result.generatedAt ?? ""),
  )) {
    if (!item.result.generatedAt || !within(item.result.generatedAt) || faces.has(item.journalId)) continue;
    faces.set(item.journalId, item);
  }
  const faceRows = [...faces.values()].flatMap((item) => (item.result.status === "available" ? [item.result] : []));
  const categories = new Map<string, Map<string, number>>();
  for (const point of insights.categoryTrend ?? []) {
    if (!within(point.date)) continue;
    const group = categories.get(point.modelIdentity) ?? new Map<string, number>();
    group.set(point.label, (group.get(point.label) ?? 0) + 1);
    categories.set(point.modelIdentity, group);
  }
  return {
    emotionSources,
    analyzedDays: new Set(emotionSources.flatMap((source) => source.points.map((point) => point.date))).size,
    estimates,
    complete,
    partial,
    unavailable: estimates.filter((point) => point.status !== "available").length,
    meanPhq: complete.length ? complete.reduce((sum, point) => sum + point.total!, 0) / complete.length : null,
    faceCount: faceRows.length,
    faceScores: averages(faceRows.map((result) => result.classProbabilities)),
    categorySources: [...categories].map(([identity, counts]) => ({
      identity,
      counts: [...counts].sort((a, b) => b[1] - a[1]),
    })),
    reports: insights.period?.analyzedReflectionCount ?? null,
  };
}
