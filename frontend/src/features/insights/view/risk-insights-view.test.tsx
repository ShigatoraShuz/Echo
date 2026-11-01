import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { RiskInsightsView } from "./risk-insights-view";

vi.mock("../view-model/use-insights-view-model", () => ({ useInsightsViewModel: vi.fn() }));
vi.mock("@/features/verification", () => ({
  VerifiedFeatureGate: ({ children }: { children: ReactNode }) => children,
}));

describe("RiskInsightsView", () => {
  it("shows unavailable analysis without a fabricated low score", () => {
    vi.mocked(useInsightsViewModel).mockReturnValue({
      overview: { latest: null, distressTrend: [], emotionTrend: [] }, isLoading: false, error: null,
    } as unknown as ReturnType<typeof useInsightsViewModel>);

    render(<RiskInsightsView />);

    expect(screen.getByText(/A missing result does not mean low distress/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 100/)).not.toBeInTheDocument();
  });

  it("excludes simulated bands and does not convert them into scores", () => {
    vi.mocked(useInsightsViewModel).mockReturnValue({
      overview: {
        emotionTrend: [],
        latest: { schemaVersion: "echo-journal-analysis-v1", distressBand: "mild", isSimulated: true, providerName: "fixture", modelVersion: "sample-v1" },
        distressTrend: [{ date: "2026-10-16", band: "mild", value: 0.25, isSimulated: true }],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useInsightsViewModel>);

    render(<RiskInsightsView />);

    expect(screen.queryByText("Simulated development result")).not.toBeInTheDocument();
    expect(screen.getByText(/A missing result does not mean low distress/)).toBeInTheDocument();
    expect(screen.queryByText("Simulated")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 100/)).not.toBeInTheDocument();
  });
});
