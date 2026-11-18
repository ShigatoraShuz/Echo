import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import { EmotionInsightsView } from "./emotion-insights-view";
let overview: DashboardInsights = {
  latest: null,
  recommendation: null,
  emotionTrend: [
    { date: "2026-11-01", values: { joy: 0.8, fear: 0.2 }, isSimulated: false },
    { date: "2026-11-02", values: { joy: 0.2, fear: 0.8 }, isSimulated: false },
  ],
  distressTrend: [],
  period: { range: "30d", from: "2026-11-01", to: "2026-11-30", analyzedReflectionCount: 12 },
  categoryTrend: [{ date: "2026-11-01", label: "Depressed", modelIdentity: "source" }],
  journalScreeningTrend: [
    { date: "2026-11-01", status: "available", coverage: 8, total: 0, subtotal: 0 },
    { date: "2026-11-02", status: "available", coverage: 2, total: null, subtotal: 4 },
  ],
};
vi.mock("@/features/verification", () => ({
  VerifiedFeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../view-model/use-insights-view-model", () => ({
  useInsightsViewModel: () => ({
    overview,
    timeRange: "30d",
    isLoading: false,
    error: null,
    setTimeRange: vi.fn(),
    applyCustomRange: vi.fn(),
    retry: vi.fn(),
  }),
}));
afterEach(() => localStorage.clear());
it("shows aggregate analytics cards together without tabs or individual report controls", async () => {
  render(<EmotionInsightsView />);
  expect(screen.getByRole("heading", { name: "Overall insights" })).toBeVisible();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  for (const name of [
    "Textual and facial signals",
    "A kinder view of the whole pattern",
    "Model output unavailable",
    "Journal-derived symptom estimate",
    "Overall support signals",
  ])
    expect(screen.getByRole("heading", { name })).toBeVisible();
  expect(screen.queryByText("Explore the dates and details behind these signals.")).not.toBeInTheDocument();
  expect(screen.queryByText("Latest saved output")).not.toBeInTheDocument();
  expect(screen.getByText("12")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Journal-derived symptom estimate" }).closest("article"),
  ).toHaveTextContent("0.0");
  await userEvent.setup().click(screen.getByText("View recent daily estimates"));
  expect(screen.getByText("2/8 evidenced")).toBeVisible();
  expect(screen.getAllByText("Cloudy days").length).toBeGreaterThan(0);
  expect(screen.queryByText("Depressed")).not.toBeInTheDocument();
});
it("respects original terminology selected in Settings", () => {
  localStorage.setItem("echo:analysis-wording", "original");
  render(<EmotionInsightsView />);
  expect(screen.getAllByText("Depressed").length).toBeGreaterThan(0);
  expect(screen.queryByText("Cloudy days")).not.toBeInTheDocument();
});
it("keeps absent saved analyses unavailable rather than reusing a latest journal result", () => {
  const previous = overview;
  overview = { ...overview, emotionTrend: [], journalScreeningTrend: [], categoryTrend: [], period: undefined };
  render(<EmotionInsightsView />);
  expect(screen.getAllByText("No saved scores in this period.")).toHaveLength(2);
  expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  overview = previous;
});
