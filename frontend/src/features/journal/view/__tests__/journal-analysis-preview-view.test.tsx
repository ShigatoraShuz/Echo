import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JournalAnalysisPreviewView } from "../journal-analysis-preview-view";

describe("JournalAnalysisPreviewView", () => {
  it("labels simulated analysis data and renders workbench controls", () => {
    render(<JournalAnalysisPreviewView />);

    expect(screen.getByRole("heading", { name: "Your journal insight" })).toBeInTheDocument();
    expect(screen.getAllByText("Simulated data").length).toBeGreaterThan(0);
    expect(screen.getByText(/does not read or analyze a journal/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fully-ready/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Processing/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Safety attention required/i })).toBeInTheDocument();
  });

  it("switches between analysis preview states", () => {
    render(<JournalAnalysisPreviewView />);

    // Switch to processing
    fireEvent.click(screen.getByRole("tab", { name: /Processing/i }));
    expect(screen.getByText(/Preparing reflection summary/i)).toBeInTheDocument();

    // Switch to safety-attention
    fireEvent.click(screen.getByRole("tab", { name: /Safety attention required/i }));
    expect(screen.getAllByText(/Support options are ready/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open verified support options/i })).toBeInTheDocument();

    // Switch to partial-ready
    fireEvent.click(screen.getByRole("tab", { name: /Partial-ready/i }));
    expect(screen.getAllByText(/Mesh captured — analysis provider not connected/i).length).toBeGreaterThan(0);
  });
});
