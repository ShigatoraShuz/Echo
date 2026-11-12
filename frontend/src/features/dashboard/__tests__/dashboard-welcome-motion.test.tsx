import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { journalAnalysisV3ResultSchema, type DashboardInsights } from "@echo/contracts";
import native from "../../../../../packages/contracts/fixtures/core-v2.json";
import { DashboardView } from "../view/dashboard-view";

const loadingState = vi.hoisted(() => ({ loading: false, hasData: true, insights: undefined as DashboardInsights | undefined }));
beforeEach(() => { loadingState.loading = false; loadingState.hasData = true; loadingState.insights = undefined; });
vi.mock("../view-model/use-dashboard-view-model", () => ({
  useDashboardViewModel: () => ({
    data: loadingState.hasData ? {
      userProfile: { name: "Lloyd", streakDays: 2 },
      journalEntries: [],
      weeklyDigest: [],
      analysisInsights: loadingState.insights,
    } : null,
    isLoading: loadingState.loading,
    error: null,
  }),
}));
vi.mock("@/services/settings/settings.service", () => ({
  settingsService: { get: () => Promise.resolve({ profile: { displayName: "Lloyd" } }) },
}));
vi.mock("../components/wellness-checkin", () => ({ WellnessCheckin: () => <h2>PHQ-8 check-in</h2> }));
vi.mock("../components/analysis-insights-dashboard", () => ({ AnalysisInsightsDashboard: () => null }));
vi.mock("../components/overall-analysis", () => ({ OverallAnalysis: () => null }));
vi.mock("../components/dominant-emotion-wheel", () => ({ DominantEmotionWheel: () => null }));
vi.mock("next/image", () => ({ default: () => null }));

describe("dashboard welcome motion", () => {
  it("plays on every dashboard visit, including preview", () => {
    const first = render(<DashboardView />);
    expect(first.container.querySelector(".echo-dashboard-welcome")).toBeInTheDocument();
    expect(first.container.querySelector("[data-echo-reveal]")).not.toBeInTheDocument();
    expect(first.container.querySelector(".echo-immediate-card")).toHaveTextContent("PHQ-8 check-in");
    first.unmount();

    const second = render(<DashboardView />);
    expect(second.container.querySelector(".echo-dashboard-welcome")).toBeInTheDocument();
    second.unmount();

    const preview = render(<DashboardView preview />);
    expect(preview.container.querySelector(".echo-dashboard-welcome")).toBeInTheDocument();
  });

  it("switches the reflection rhythm to the full year", () => {
    render(<DashboardView />);
    fireEvent.change(screen.getByRole("combobox", { name: /wellbeing activity range/i }), { target: { value: "52" } });
    expect(screen.getAllByRole("gridcell")).toHaveLength(364);
  });
});

it("opens the public dashboard heading before any private data is ready", () => {
  loadingState.loading = true; loadingState.hasData = false;
  render(<DashboardView />);
  expect(screen.getByRole("heading", {name: "Dashboard"})).toBeInTheDocument();
  expect(screen.queryByText(/Lloyd/)).not.toBeInTheDocument();
});
it("keeps the current dashboard visible during a background model-result refresh", () => {
  loadingState.loading = true;
  const view = render(<DashboardView />);
  expect(view.container.querySelector(".echo-immediate-card")).toHaveTextContent("PHQ-8 check-in");
  expect(screen.getByRole("status")).toHaveTextContent("Updating your dashboard");
});


it("shows the latest saved Buddy recommendation on the dashboard", () => {
  loadingState.insights = {
    latest: journalAnalysisV3ResultSchema.parse({
      ...native, schemaVersion: "echo-journal-analysis-v3", isSimulated: false, supportReviewRequired: false,
      journalScreening: { status: "unavailable", experimental: true, inferenceVersion: "test", items: null, coverage: 0, subtotal: null, total: null },
      cbtRecommendation: { status: "available", text: "Take a short pause before your next task.",
        model: { providerName: "buddy", modelVersion: "test", inferenceVersion: "test" } },
    }),
    recommendation: null, emotionTrend: [], distressTrend: [],
  };
  render(<DashboardView />);
  expect(screen.getByRole("region", { name: "Latest reflection recommendation" })).toHaveTextContent("Take a short pause before your next task.");
});
