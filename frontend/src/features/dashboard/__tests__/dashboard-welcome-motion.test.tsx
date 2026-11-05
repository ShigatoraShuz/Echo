import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DashboardView } from "../view/dashboard-view";

const loadingState = vi.hoisted(() => ({ loading: false, hasData: true }));
beforeEach(() => { loadingState.loading = false; loadingState.hasData = true; });
vi.mock("../view-model/use-dashboard-view-model", () => ({
  useDashboardViewModel: () => ({
    data: loadingState.hasData ? {
      userProfile: { name: "Lloyd", streakDays: 2 },
      journalEntries: [],
      weeklyDigest: [],
    } : null,
    isLoading: loadingState.loading,
    error: null,
  }),
}));
vi.mock("@/services/settings/settings.service", () => ({
  settingsService: { get: () => Promise.resolve({ profile: { displayName: "Lloyd" } }) },
}));
vi.mock("../components/wellness-checkin", () => ({ WellnessCheckin: () => null }));
vi.mock("../components/analysis-insights-dashboard", () => ({ AnalysisInsightsDashboard: () => null }));
vi.mock("../components/overall-analysis", () => ({ OverallAnalysis: () => null }));
vi.mock("../components/dominant-emotion-wheel", () => ({ DominantEmotionWheel: () => null }));
vi.mock("next/image", () => ({ default: () => null }));

describe("dashboard welcome motion", () => {
  it("plays on every dashboard visit, including preview", () => {
    const first = render(<DashboardView />);
    expect(first.container.querySelector(".echo-dashboard-welcome")).toBeInTheDocument();
    expect(first.container.querySelector("[data-echo-reveal]")).not.toBeInTheDocument();
    expect(first.container.querySelector(".echo-immediate-card")).toHaveTextContent("Journal category");
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
  expect(view.container.querySelector(".echo-immediate-card")).toHaveTextContent("Journal category");
  expect(screen.getByRole("status")).toHaveTextContent("Updating your dashboard");
});
