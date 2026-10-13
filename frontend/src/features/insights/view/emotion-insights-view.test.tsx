import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import { EmotionInsightsView } from "./emotion-insights-view";

const overview: DashboardInsights = {
  latestResultId: "00000000-0000-4000-8000-000000000001",
  latest: {
    schemaVersion: "echo-journal-analysis-v1",
    thresholdVersion: "v1",
    providerName: "fixture",
    modelVersion: "fixture-v1",
    isSimulated: true,
    emotionDistribution: [
      { emotion: "joy", value: 0.1 },
      { emotion: "calm", value: 0.4 },
      { emotion: "sadness", value: 0.1 },
      { emotion: "anxiety", value: 0.1 },
      { emotion: "anger", value: 0.1 },
      { emotion: "hope", value: 0.2 },
    ],
    dominantEmotion: "calm",
    emotionConfidence: 0.9,
    distressBand: "low",
    distressConfidence: 0.85,
    depressiveSymptomRange: { lower: 0, upper: 4 },
    recommendationFeatures: ["paced_breathing"],
    facialExpressionAnalysis: null,
  },
  recommendation: null,
  emotionTrend: [{ date: "2026-10-10", values: { calm: 0.4 }, isSimulated: true }],
  distressTrend: [{ date: "2026-10-10", band: "low", value: 0, isSimulated: true }],
  period: { range: "30d", from: "2026-09-12", to: "2026-10-11", analyzedReflectionCount: 1 },
  facialStatus: "captured_pending_provider",
};
let showEmpty = false;

afterEach(() => {
  showEmpty = false;
  vi.unstubAllEnvs();
});

vi.mock("@/features/verification", () => ({
  VerifiedFeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../view-model/use-insights-view-model", () => ({
  useInsightsViewModel: (preview: boolean) => ({
    timeRange: "30d",
    overview: !preview && showEmpty ? { ...overview, latest: null } : overview,
    isLoading: false,
    error: null,
    setTimeRange: vi.fn(),
    applyCustomRange: vi.fn(),
    retry: vi.fn(),
  }),
}));

describe("AI insights dashboard", () => {
  it("shows all five outcomes and honest provider states", () => {
    render(<EmotionInsightsView />);

    expect(screen.getByRole("heading", { name: "Your emotional patterns" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Textual and facial signals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A kinder view of the whole pattern" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Journal-derived symptom estimate" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current support signal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model output unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/Perspective model is not connected yet/i)).toBeInTheDocument();
    expect(screen.getAllByText(/facial model provider not connected/i).length).toBeGreaterThan(0);
  });

  it("shows labelled sample values only when development has no completed analysis", () => {
    vi.stubEnv("NODE_ENV", "development");
    showEmpty = true;
    render(<EmotionInsightsView previewWhenEmpty />);

    expect(screen.getByText(/Preview mode — simulated examples, not your results/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Textual and facial signals" })).toBeInTheDocument();
  });

  it("keeps the empty state in production instead of showing sample results", () => {
    vi.stubEnv("NODE_ENV", "production");
    showEmpty = true;
    render(<EmotionInsightsView previewWhenEmpty />);

    expect(screen.getByRole("heading", { name: "No completed analysis yet" })).toBeInTheDocument();
    expect(screen.queryByText(/Preview mode — simulated examples, not your results/i)).not.toBeInTheDocument();
  });
});
