import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStatusExperience } from "../components/analysis-status-experience";

const api = vi.hoisted(() => ({ getAnalysisStatus: vi.fn() }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => api }));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => {
    throw new Error("Realtime offline");
  },
}));
const submission = {
  journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  analysisJobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  status: "waiting_for_provider",
};
const status = (state: string, progress: number, time = "2026-08-31T00:00:00Z") => ({
  success: true,
  data: { jobId: submission.analysisJobId, journalId: submission.journalId, status: state, progress, updatedAt: time },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("echo:active-analysis", JSON.stringify(submission));
});
afterEach(() => vi.useRealTimers());
describe("backend-owned analysis progress", () => {
  it("keeps polling while waiting even when Realtime is offline", async () => {
    api.getAnalysisStatus
      .mockResolvedValueOnce(status("waiting_for_provider", 0))
      .mockResolvedValue(status("safety_checking", 10));
    await act(async () => {
      render(<AnalysisStatusExperience />);
    });
    expect(screen.getByText(/AI insights are not available yet/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });
  it("never advances from elapsed time or animates retry progress backward", async () => {
    api.getAnalysisStatus
      .mockResolvedValueOnce(status("retrying", 70))
      .mockResolvedValue(status("queued", 5, "2026-08-31T00:00:01Z"));
    await act(async () => {
      render(<AnalysisStatusExperience />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    expect(screen.getByRole("heading", { name: "Trying again safely" })).toBeInTheDocument();
  });
  it("supports minimized state without cancelling backend processing", async () => {
    api.getAnalysisStatus.mockResolvedValue(status("safety_checking", 10));
    await act(async () => {
      render(<AnalysisStatusExperience />);
    });
    act(() => screen.getByRole("button", { name: "Minimize analysis progress" }).click());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(api.getAnalysisStatus).toHaveBeenCalledTimes(2);
  });
  it("clears inaccessible or deleted saved job identifiers", async () => {
    api.getAnalysisStatus.mockResolvedValue({ success: false, error: { code: "NOT_FOUND" } });
    await act(async () => {
      render(<AnalysisStatusExperience />);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("echo:active-analysis")).toBeNull();
  });
});
