import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalAnalysisPanel } from "./journal-analysis-panel";

describe("JournalAnalysisPanel", () => {
  it("offers an explicit action only when the reflection has analysis consent", () => {
    const onAnalyze = vi.fn();
    const { rerender } = render(<JournalAnalysisPanel analysis={null} canAnalyze={false} onAnalyze={onAnalyze} />);
    expect(screen.queryByRole("button", { name: "Analyze reflection" })).not.toBeInTheDocument();
    rerender(<JournalAnalysisPanel analysis={null} canAnalyze onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze reflection" }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });
  it("shows failed analysis as retryable without showing a screening result", () => {
    render(<JournalAnalysisPanel analysis={{ id: "a", entryId: "j", status: "failed", summary: "", perspective: "", moodInsight: "", riskIndication: "", isDemoData: false, createdAt: "" }} canAnalyze onAnalyze={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be completed");
    expect(screen.getByRole("button", { name: "Analyze reflection" })).toBeInTheDocument();
    expect(screen.queryByText("Risk indication")).not.toBeInTheDocument();
  });
});
