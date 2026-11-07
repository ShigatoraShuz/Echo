import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import native from "../../../../../packages/contracts/fixtures/core-v2.json";
import {
  journalAnalysisV2ResultSchema,
  journalAnalysisV3ResultSchema,
  facialExpressionResultSchema,
} from "@echo/contracts";
import type { DashboardInsights } from "@echo/contracts";
import { EmotionInsightsView } from "./emotion-insights-view";

const overview: DashboardInsights = {
  latestResultId: "00000000-0000-4000-8000-000000000001",
  latest: {
    schemaVersion: "echo-journal-analysis-v1",
    thresholdVersion: "v1",
    providerName: "fixture",
    modelVersion: "fixture-v1",
    isSimulated: false,
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
  emotionTrend: [{ date: "2026-10-10", values: { calm: 0.4 }, isSimulated: false }],
  distressTrend: [{ date: "2026-10-10", band: "low", value: 0, isSimulated: false }],
  period: { range: "30d", from: "2026-09-12", to: "2026-10-11", analyzedReflectionCount: 1 },
  facialStatus: "captured_pending_provider",
};
let showEmpty = false;
let showNative = false;
let nativeOverride: DashboardInsights["latest"] = null;
let savedFaces: DashboardInsights["facialResults"] = [];

afterEach(() => {
  showEmpty = false;
  showNative = false;
  nativeOverride = null;
  savedFaces = [];
  vi.unstubAllEnvs();
});

vi.mock("@/features/verification", () => ({
  VerifiedFeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../view-model/use-insights-view-model", () => ({
  useInsightsViewModel: (preview: boolean) => ({
    timeRange: "30d",
    overview: showNative
      ? {
          ...overview,
          latest: nativeOverride ?? journalAnalysisV2ResultSchema.parse(native),
          emotionTrend: [],
          distressTrend: [],
          facialResults: savedFaces,
        }
      : !preview && showEmpty
        ? { ...overview, latest: null }
        : overview,
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

  it("shows labelled sample values only in an explicit development preview", () => {
    vi.stubEnv("NODE_ENV", "development");
    showEmpty = true;
    render(<EmotionInsightsView preview />);

    expect(screen.getByText(/Preview mode — simulated examples, not your results/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Textual and facial signals" })).toBeInTheDocument();
  });

  it("does not silently replace an empty development account with fixtures", () => {
    vi.stubEnv("NODE_ENV", "development");
    showEmpty = true;
    render(<EmotionInsightsView />);
    expect(screen.getByRole("heading", { name: "No completed analysis yet" })).toBeInTheDocument();
    expect(screen.queryByText(/Preview mode/)).not.toBeInTheDocument();
  });

  it("keeps the empty state in production instead of showing sample results", () => {
    vi.stubEnv("NODE_ENV", "production");
    showEmpty = true;
    render(<EmotionInsightsView />);

    expect(screen.getByRole("heading", { name: "No completed analysis yet" })).toBeInTheDocument();
    expect(screen.queryByText(/Preview mode — simulated examples, not your results/i)).not.toBeInTheDocument();
  });
  it("keeps native results compact and opens the full report and history on request", async () => {
    showNative = true;
    render(<EmotionInsightsView />);
    expect(screen.getByRole("heading", { name: "Your emotional patterns" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Analysis period" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text emotion patterns" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Your reflection patterns" })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Full model report" }));
    expect(screen.getByRole("dialog", { name: "Full model report" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Your reflection patterns" })).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "View analysis history" }));
    expect(screen.getByRole("dialog", { name: "Saved analysis history" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Emotion history" })).toBeVisible();
    expect(screen.queryByText(/Preview mode/)).not.toBeInTheDocument();
  });
});

describe("compact native screening and face results", () => {
  const criteria = [
    "anhedonia",
    "depressed_mood",
    "sleep",
    "fatigue",
    "appetite",
    "worthlessness_guilt",
    "concentration",
    "psychomotor",
  ];
  function screening(coverage: number, value: number) {
    return journalAnalysisV3ResultSchema.parse({
      ...native,
      schemaVersion: "echo-journal-analysis-v3",
      journalScreening: {
        status: "available",
        experimental: true,
        inferenceVersion: "test",
        items: Object.fromEntries(criteria.map((key, i) => [key, i < coverage ? value : null])),
        coverage,
        subtotal: coverage ? coverage * value : null,
        total: coverage === 8 ? coverage * value : null,
        generatedAt: "2026-11-01T00:00:00Z",
        truncated: false,
      },
    });
  }
  it.each([0, 1, 8])("preserves missing PHQ evidence and real zeros (%i criteria)", async (coverage) => {
    showNative = true;
    nativeOverride = screening(coverage, 0);
    render(<EmotionInsightsView />);
    expect(screen.getByText("Top emotion score")).toBeVisible();
    expect(screen.queryByText("Text confidence")).not.toBeInTheDocument();
    if (coverage === 0) expect(screen.getByText("Unscored")).toBeVisible();
    if (coverage === 1) expect(screen.getByText(/Partial subtotal · 1\/8 criteria evidenced/)).toBeVisible();
    if (coverage === 8) expect(screen.getByText("Complete model estimate")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "View criteria" }));
    expect(screen.getByRole("dialog", { name: "Journal PHQ-8 criteria" })).toBeVisible();
    expect(screen.queryAllByText("Not evidenced")).toHaveLength(8 - coverage);
  });
  it("renders the actual saved face result separately from text, with no face preview", () => {
    showNative = true;
    savedFaces = [
      {
        journalId: "00000000-0000-4000-8000-000000000012",
        result: facialExpressionResultSchema.parse({
          schemaVersion: "echo-face-expression-v1",
          status: "available",
          experimental: true,
          prediction: "trust",
          scoreType: "uncalibrated_class_probability",
          classProbabilities: Object.fromEntries(
            native.emotionDistribution.map((item) => [item.emotion, item.emotion === "trust" ? 1 : 0]),
          ),
          quality: {},
          modelFingerprint: "a".repeat(64),
          inferenceVersion: "test",
          generatedAt: "2026-11-01T00:00:00Z",
        }),
      },
    ];
    const { container } = render(<EmotionInsightsView />);
    expect(screen.getByRole("heading", { name: "Trust expression" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View saved reflection" })).toHaveAttribute(
      "href",
      "/journal/00000000-0000-4000-8000-000000000012",
    );
    expect(container.querySelector("video,canvas")).toBeNull();
  });
});
