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

  it("opens a new submission even when storage is unavailable", () => {
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

  it("restores an analysis already saved in this browser", () => {
    localStorage.setItem("echo:active-analysis", "saved-submission");
    render(<AnalysisStatusGateway />);
    expect(screen.getByTestId("analysis-status")).toBeInTheDocument();
  });
});
