import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisInsightsDashboard } from "./analysis-insights-dashboard";
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
};

describe("analysis dashboard", () => {
  it("renders an honest empty state", () => {
    render(<AnalysisInsightsDashboard />);
    expect(screen.getByText(/will not invent a trend/i)).toBeInTheDocument();
  });
  it("labels simulated results and shows the permanent non-diagnostic statement", () => {
    const insights: DashboardInsights = { latest: result, recommendation: null, emotionTrend: [], distressTrend: [] };
    render(<AnalysisInsightsDashboard insights={insights} />);
    expect(screen.getByText("Simulated analysis")).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis or completed PHQ-8 assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/not enough dated analysis/i)).toBeInTheDocument();
  });
  it("renders real dated mappings without a simulated-only notice", () => {
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
    expect(screen.getByText("Start with ECHO Buddy")).toBeInTheDocument();
    expect(screen.queryByText(/Only simulated points/i)).not.toBeInTheDocument();
  });
});
