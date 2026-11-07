import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { journalAnalysisV3ResultSchema } from "@echo/contracts";
import fixture from "../../../../../packages/contracts/fixtures/core-v2.json";
import { JournalAnalysisDock } from "./journal-analysis-dock";
import type { JournalAnalysis } from "../model/journal.model";

vi.mock("./local-face-result", () => ({
  LocalFaceResult: () => <p>Saved expression estimate</p>,
}));
const names = [
  "anhedonia",
  "depressed_mood",
  "sleep",
  "fatigue",
  "appetite",
  "worthlessness_guilt",
  "concentration",
  "psychomotor",
];
function analysis(coverage: number): JournalAnalysis {
  return {
    id: "test",
    entryId: "entry",
    summary: "Saved summary",
    perspective: "",
    moodInsight: "",
    riskIndication: "",
    isDemoData: false,
    createdAt: "2026-11-01T00:00:00Z",
    result: journalAnalysisV3ResultSchema.parse({
      ...fixture,
      schemaVersion: "echo-journal-analysis-v3",
      journalScreening: {
        status: "available",
        experimental: true,
        inferenceVersion: "test",
        items: Object.fromEntries(
          names.map((name, i) => [name, i < coverage ? 0 : null]),
        ),
        coverage,
        subtotal: coverage ? 0 : null,
        total: coverage === 8 ? 0 : null,
        generatedAt: "2026-11-01T00:00:00Z",
        truncated: false,
      },
    }),
  };
}
it.each([0, 1, 8])(
  "preserves absent evidence and actual zeros in report tabs (%i criteria)",
  async (coverage) => {
    render(
      <JournalAnalysisDock
        enabled
        journalId="entry"
        analysis={analysis(coverage)}
      />,
    );
    expect(screen.getByText("Saved summary")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("tab", { name: "PHQ-8" }));
    expect(screen.getByText("PHQ-8 analysis finished")).toBeVisible();
    if (coverage < 8)
      expect(screen.getByText(/The model ran successfully/)).toBeVisible();
    expect(screen.queryAllByText("Not evidenced")).toHaveLength(8 - coverage);
    if (coverage === 8)
      expect(screen.getByText("Complete estimate: 0 / 24")).toBeVisible();
    else
      expect(screen.queryByText(/Complete estimate/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Face" }));
    expect(screen.getByText("Saved expression estimate")).toBeVisible();
    expect(document.querySelector("video,canvas")).toBeNull();
  },
);
it("does not display simulated results as a saved personal report", () => {
  const value = analysis(0);
  value.result = { ...value.result!, isSimulated: true } as typeof value.result;
  render(<JournalAnalysisDock enabled journalId="entry" analysis={value} />);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(
    screen.getByText("No model result is available for this entry yet."),
  ).toBeVisible();
});

it.each(["failed", "unavailable"] as const)(
  "does not label %s PHQ inference successful",
  async (status) => {
    const value = analysis(0);
    const result = value.result as ReturnType<
      typeof journalAnalysisV3ResultSchema.parse
    >;
    result.journalScreening = {
      ...result.journalScreening,
      status,
      items: null,
    };
    render(<JournalAnalysisDock enabled journalId="entry" analysis={value} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "PHQ-8" }));
    expect(
      screen.queryByText("PHQ-8 analysis finished"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No PHQ-8 estimate is available for this entry."),
    ).toBeVisible();
  },
);
