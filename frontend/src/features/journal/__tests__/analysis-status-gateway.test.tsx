import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStatusGateway } from "../components/analysis-status-gateway";

const route = vi.hoisted(() => ({ path: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("next/dynamic", () => ({
  default: () => ({ initialSubmission }: { initialSubmission?: { analysisJobId?: string } | null }) => (
    <div data-testid="analysis-status">{initialSubmission?.analysisJobId}</div>
  ),
}));

describe("analysis status loading", () => {
  beforeEach(() => { localStorage.clear(); route.path = "/dashboard"; });

  it("keeps the status UI unloaded until an analysis exists", () => {
    render(<AnalysisStatusGateway />);
    expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
  });

  it("opens a new submission outside the journal/dashboard even when storage is unavailable", () => {
    route.path = "/buddy";
    render(<AnalysisStatusGateway />);
    act(() => {
      window.dispatchEvent(new CustomEvent("echo:analysis-submitted", {
        detail: { analysisJobId: "new-job" },
      }));
    });
    expect(screen.getByTestId("analysis-status")).toHaveTextContent("new-job");
  });

  it("never opens an overlay on journal routes", () => {
    route.path = "/journal/new";
    localStorage.setItem("echo:active-analysis", "saved-submission");
    render(<AnalysisStatusGateway />);
    expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
  });

  it("does not restore a saved analysis when the dashboard opens", () => {
    localStorage.setItem("echo:active-analysis", "saved-submission");
    render(<AnalysisStatusGateway />);
    expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
  });
});


it("never opens the dashboard overlay for a fresh submission event", () => {
  render(<AnalysisStatusGateway />);
  act(() => window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: { analysisJobId: "new-job" } })));
  expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
});
it("does not carry inline journal progress to the dashboard", () => {
  route.path = "/journal/new";
  const { rerender } = render(<AnalysisStatusGateway />);
  act(() => window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: { analysisJobId: "new-job" } })));
  route.path = "/dashboard"; rerender(<AnalysisStatusGateway />);
  expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
});
it("drops an open experience on navigation and never replays it on return", () => {
  route.path = "/buddy";
  const { rerender } = render(<AnalysisStatusGateway />);
  act(() => window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: { analysisJobId: "new-job" } })));
  expect(screen.getByTestId("analysis-status")).toBeInTheDocument();
  route.path = "/dashboard"; rerender(<AnalysisStatusGateway />);
  expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
  route.path = "/buddy"; rerender(<AnalysisStatusGateway />);
  expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
});
it("clears a live experience on account invalidation", () => {
  route.path = "/buddy"; render(<AnalysisStatusGateway />);
  act(() => window.dispatchEvent(new CustomEvent("echo:analysis-submitted", { detail: { analysisJobId: "new-job" } })));
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  expect(screen.queryByTestId("analysis-status")).not.toBeInTheDocument();
});
