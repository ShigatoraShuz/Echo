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
});
