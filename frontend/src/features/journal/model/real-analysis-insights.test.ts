import { expect, it } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import { realAnalysisInsights } from "./real-analysis-insights";
it("removes sample predictions and histories without inventing replacement values", () => {
 const input = { latest: { isSimulated: true }, latestResultId: "sample", recommendation: { title: "Sample" },
 emotionTrend: [{ date: "2026-11-01", values: { calm: 1 }, isSimulated: true }], distressTrend: [], categoryTrend: [{ label: "Low" }], journalScreeningTrend: [{ total: 0 }] } as unknown as DashboardInsights;
 expect(realAnalysisInsights(input)).toMatchObject({ latest: null, latestResultId: null, recommendation: null, emotionTrend: [], categoryTrend: [], journalScreeningTrend: [] });
 expect(input.latest).not.toBeNull();
});
it("preserves real outputs and unavailable screening without substituting a score", () => {
 const input = { latest: { isSimulated: false, journalScreening: { status: "unavailable", total: null } }, emotionTrend: [{ date: "2026-11-01", values: { joy: .8 }, isSimulated: false }], distressTrend: [] } as unknown as DashboardInsights;
 expect(realAnalysisInsights(input)?.latest).toBe(input.latest);
 expect(realAnalysisInsights(input)?.emotionTrend).toEqual(input.emotionTrend);
 expect(realAnalysisInsights(null)).toBeUndefined();
});
