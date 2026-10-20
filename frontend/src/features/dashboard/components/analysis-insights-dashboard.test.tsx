import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  facialExpressionAnalysis: null,
};

describe("analysis dashboard", () => {
  it("renders an honest empty state", () => {
    render(<AnalysisInsightsDashboard />);
    expect(screen.getByRole("heading", { name: "Journal analysis" })).toBeInTheDocument();
    expect(screen.getByText("No completed analysis yet")).toBeInTheDocument();
    expect(screen.getByText(/will not invent a trend/i)).toBeInTheDocument();
  });
  it("labels simulated results and opens the non-diagnostic details", async () => {
    const insights: DashboardInsights = {
      latest: result,
      recommendation: { id: "00000000-0000-4000-8000-000000000001", title: "Breathe", description: "Pause gently.", activity: "paced" },
      emotionTrend: [], distressTrend: [],
    };
    render(<AnalysisInsightsDashboard insights={insights} />);
    const disclosure = screen.getByText("Journal analysis").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Sample analysis preview")).toBeInTheDocument();
    expect(screen.getByText("Simulated analysis")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Journal analysis"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText(/not a diagnosis or completed PHQ-8 assessment/i)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("development example");
    expect(screen.getByText("Buddy handoff is unavailable for a simulated result.")).toBeInTheDocument();
    expect(screen.queryByText("Start with ECHO Buddy")).not.toBeInTheDocument();
    expect(screen.getByText(/not enough dated analysis/i)).toBeInTheDocument();
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
    await userEvent.setup().click(screen.getByText("Journal analysis"));
    expect(screen.getByText("Start with ECHO Buddy")).toBeInTheDocument();
    expect(screen.queryByText(/Only simulated points/i)).not.toBeInTheDocument();
  });
});
