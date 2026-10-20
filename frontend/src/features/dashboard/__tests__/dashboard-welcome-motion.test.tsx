import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardView } from "../view/dashboard-view";

vi.mock("../view-model/use-dashboard-view-model", () => ({
  useDashboardViewModel: () => ({
    data: {
      userProfile: { name: "Lloyd", streakDays: 2 },
      journalEntries: [],
      weeklyDigest: [],
    },
    isLoading: false,
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
    expect(first.container.querySelector(".echo-immediate-card")).toHaveTextContent("Current distress");
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
