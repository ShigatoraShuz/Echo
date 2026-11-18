import { describe, expect, it } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import { overallAnalysis } from "./overall-analysis";
const base: DashboardInsights = {
  latest: null,
  recommendation: null,
  emotionTrend: [],
  distressTrend: [],
  period: { range: "30d", from: "2026-11-01", to: "2026-11-30", analyzedReflectionCount: 12 },
};
describe("overall saved analysis", () => {
  it("averages period-wide daily outputs without using the latest reflection or mixing model sources", () => {
    const result = overallAnalysis({
      ...base,
      emotionTrend: [
        { date: "2026-11-01", values: { joy: 0.8, fear: 0.2 }, isSimulated: false, modelIdentity: "a" },
        { date: "2026-11-02", values: { joy: 0.2, fear: 0.8 }, isSimulated: false, modelIdentity: "a" },
        { date: "2026-11-03", values: { sadness: 1 }, isSimulated: false, modelIdentity: "b" },
        { date: "2026-11-04", values: { anger: 1 }, isSimulated: true, modelIdentity: "a" },
        { date: "2026-10-01", values: { anger: 1 }, isSimulated: false, modelIdentity: "a" },
      ],
    });
    expect(result.reports).toBe(12);
    expect(result.analyzedDays).toBe(3);
    expect(result.emotionSources).toHaveLength(2);
    expect(result.emotionSources[0].scores.find((item) => item.label === "joy")?.value).toBe(0.5);
    expect(result.emotionSources[0].scores.some((item) => item.label === "sadness")).toBe(false);
  });
  it("includes real complete zero scores but excludes incomplete, failed, and unavailable estimates from the average", () => {
    const result = overallAnalysis({
      ...base,
      journalScreeningTrend: [
        { date: "2026-11-01", status: "available", coverage: 8, total: 0, subtotal: 0 },
        { date: "2026-11-02", status: "available", coverage: 8, total: 8, subtotal: 8 },
        { date: "2026-11-03", status: "available", coverage: 2, total: null, subtotal: 6 },
        { date: "2026-11-04", status: "failed", coverage: 0, total: null, subtotal: null },
      ],
    });
    expect(result.meanPhq).toBe(4);
    expect(result.complete).toHaveLength(2);
    expect(result.partial).toHaveLength(1);
    expect(result.unavailable).toBe(1);
  });
  it("does not invent zero emotion scores for absent labels", () => {
    const result = overallAnalysis({
      ...base,
      emotionTrend: [
        { date: "2026-11-01", values: { joy: 0.8 }, isSimulated: false },
        { date: "2026-11-02", values: { fear: 0.4 }, isSimulated: false },
      ],
    });
    expect(result.emotionSources[0].scores.find((item) => item.label === "joy")).toEqual({
      label: "joy",
      value: 0.8,
      observations: 1,
    });
  });
});
