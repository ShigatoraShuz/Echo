import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AnalysisInsightsDashboard } from "./analysis-insights-dashboard";
import native from "../../../../../packages/contracts/fixtures/core-v2.json";
import { journalAnalysisV2ResultSchema } from "@echo/contracts";
import type { DashboardInsights } from "@echo/contracts";

const result = {
  schemaVersion: "echo-journal-analysis-v1" as const,
  thresholdVersion: "v1",
  providerName: "stub",
  modelVersion: "fixture-v1",
  isSimulated: true,
  emotionDistribution: [
    { emotion: "joy" as const, value: 0.1 },
    { emotion: "calm" as const, value: 0.4 },
    { emotion: "sadness" as const, value: 0.1 },
    { emotion: "anxiety" as const, value: 0.1 },
    { emotion: "anger" as const, value: 0.1 },
    { emotion: "hope" as const, value: 0.2 },
  ],
  dominantEmotion: "calm" as const,
  emotionConfidence: 0.9,
  distressBand: "low" as const,
  distressConfidence: 0.85,
  depressiveSymptomRange: { lower: 0, upper: 4 },
  recommendationFeatures: ["paced_breathing" as const],
  facialExpressionAnalysis: null,
};

describe("analysis dashboard", () => {
  it("renders an honest empty state", () => {
    render(<AnalysisInsightsDashboard />);
    expect(screen.getByRole("heading", { name: "Journal analysis" })).toBeInTheDocument();
    expect(screen.getByText("No completed analysis yet")).toBeInTheDocument();
    expect(screen.getByText(/will not invent a trend/i)).toBeInTheDocument();
  });
  it("excludes simulated values from the account summary", () => {
    render(<AnalysisInsightsDashboard insights={{ latest: result, recommendation: null, emotionTrend: [], distressTrend: [] }} />);
    expect(screen.getByText("No completed analysis yet")).toBeInTheDocument();
    expect(screen.queryByText("Sample analysis preview")).not.toBeInTheDocument();
    expect(screen.queryByText("low")).not.toBeInTheDocument();
  });
  it("renders real dated mappings without a simulated-only notice", async () => {
    const real = { ...result, isSimulated: false };
    const insights: DashboardInsights = {
      latest: real,
      recommendation: {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Breathe",
        description: "Pause gently.",
        activity: "paced",
      },
      emotionTrend: [
        { date: "2026-08-29", values: { calm: 0.4 }, isSimulated: false },
        { date: "2026-08-30", values: { calm: 0.5 }, isSimulated: false },
      ],
      distressTrend: [
        { date: "2026-08-29", band: "low", value: 0.8, isSimulated: false },
        { date: "2026-08-30", band: "low", value: 0.9, isSimulated: false },
      ],
    };
    render(<AnalysisInsightsDashboard insights={insights} />);
    await userEvent.setup().click(screen.getByRole("button", {name:"Details"}));
    expect(screen.getByText("Start with ECHO Buddy")).toBeInTheDocument();
    expect(screen.queryByText(/Only simulated points/i)).not.toBeInTheDocument();
  });
  it("keeps pending status visible and opens the native report from Details", async () => {
    const insights: DashboardInsights = {
      latest: journalAnalysisV2ResultSchema.parse(native), recommendation: null, emotionTrend: [], distressTrend: [],
      latestRequest: { status: "queued", updatedAt: "2026-10-31T01:00:00Z" }, latestAnalyzedAt: "2000-01-01T00:00:00Z",
    };
    render(<AnalysisInsightsDashboard insights={insights} />);
    const card = screen.getByRole("region", { name: "Saved AI result summary" });
    const trigger = screen.getByRole("button", {name:"Details"});
    expect(card).toHaveTextContent(native.distressCategory);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("heading", {name:"Your reflection patterns"})).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", {name:"Close dialog"}));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/A newer analysis is pending/)).toBeVisible();
    expect(screen.getAllByText(native.dominantEmotion, { exact: false }).length).toBeGreaterThan(0);
    expect(card?.querySelector('time')).toHaveAttribute("datetime", "2000-01-01T00:00:00Z");
  });

});
