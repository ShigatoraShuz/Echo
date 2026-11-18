import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { journalAnalysisV3ResultSchema } from "@echo/contracts";
import fixture from "../../../../../packages/contracts/fixtures/core-v2.json";
import { JournalAnalysisDock } from "./journal-analysis-dock";
import type { JournalAnalysis } from "../model/journal.model";

vi.mock("./local-face-result", () => ({
  LocalFaceResult: () => <p>Saved expression estimate</p>,
}));
afterEach(() => localStorage.removeItem("echo:analysis-wording"));
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
        items: Object.fromEntries(names.map((name, i) => [name, i < coverage ? 0 : null])),
        coverage,
        subtotal: coverage ? 0 : null,
        total: coverage === 8 ? 0 : null,
        generatedAt: "2026-11-01T00:00:00Z",
        truncated: false,
      },
    }),
  };
}
it.each([0, 1, 8])("preserves absent evidence and actual zeros in report tabs (%i criteria)", async (coverage) => {
  render(<JournalAnalysisDock enabled journalId="entry" analysis={analysis(coverage)} />);
  expect(screen.getByText("Saved summary")).toBeVisible();
  expect(screen.queryByText("Journal category")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("switch", { name: "Deep analysis" }));
  expect(screen.getByText("Journal category")).toBeVisible();
  expect(screen.getByText(fixture.distressCategory)).toBeVisible();
  await userEvent.setup().click(screen.getByRole("switch", { name: "Deep analysis" }));
  await userEvent.setup().click(screen.getByRole("tab", { name: "PHQ-8" }));
  expect(screen.getByText("PHQ-8 analysis finished")).toBeVisible();
  if (coverage < 8) expect(screen.getByText(/The model ran successfully/)).toBeVisible();
  expect(screen.queryAllByText("Not evidenced")).toHaveLength(8 - coverage);
  if (coverage > 0) expect(screen.getAllByText("Evidenced").length).toBe(coverage);
  if (coverage === 8) expect(screen.getByText("Complete estimate: 0 / 24")).toBeVisible();
  else expect(screen.queryByText(/Complete estimate/)).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("tab", { name: "Face" }));
  expect(screen.getByText("Saved expression estimate")).toBeVisible();
  expect(document.querySelector("video,canvas")).toBeNull();
});
it("reveals PHQ frequency values only with Deep analysis", async () => {
  render(<JournalAnalysisDock enabled journalId="entry" analysis={analysis(1)} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "PHQ-8" }));
  expect(screen.getAllByText("Evidenced")).toHaveLength(1);
  expect(screen.queryByText("Not at all")).not.toBeInTheDocument();
  await user.click(screen.getByRole("switch", { name: "Deep analysis" }));
  expect(screen.getByText("0")).toBeInTheDocument();
});
it("does not display simulated results as a saved personal report", () => {
  const value = analysis(0);
  value.result = { ...value.result!, isSimulated: true } as typeof value.result;
  render(<JournalAnalysisDock enabled journalId="entry" analysis={value} />);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByText("No model result is available for this entry yet.")).toBeVisible();
});

it.each(["failed", "unavailable"] as const)("does not label %s PHQ inference successful", async (status) => {
  const value = analysis(0);
  const result = value.result as ReturnType<typeof journalAnalysisV3ResultSchema.parse>;
  result.journalScreening = {
    ...result.journalScreening,
    status,
    items: null,
  };
  render(<JournalAnalysisDock enabled journalId="entry" analysis={value} />);
  await userEvent.setup().click(screen.getByRole("tab", { name: "PHQ-8" }));
  expect(screen.queryByText("PHQ-8 analysis finished")).not.toBeInTheDocument();
  expect(screen.getByText("No PHQ-8 estimate is available for this entry.")).toBeVisible();
});

it("renders saved CBT next steps as text with provenance and rejects malformed payloads", () => {
  const value = analysis(0);
  const base = value.result as ReturnType<typeof journalAnalysisV3ResultSchema.parse>;
  const recommendation = {
    status: "available" as const,
    text: "Pause and write one manageable next step.",
    model: { providerName: "buddy", modelVersion: "adapter", inferenceVersion: "reviewed" },
  };
  value.result = journalAnalysisV3ResultSchema.parse({ ...base, cbtRecommendation: recommendation });
  render(<JournalAnalysisDock enabled analysis={value} />);
  expect(screen.getByRole("region", { name: "Suggested next steps" })).toBeVisible();
  expect(screen.getByText(recommendation.text)).toBeVisible();
  expect(screen.getByText(/Generated by Buddy/)).toBeVisible();
  expect(
    journalAnalysisV3ResultSchema.safeParse({
      ...base,
      cbtRecommendation: { status: "available", text: "No attribution" },
    }).success,
  ).toBe(false);
  expect(
    journalAnalysisV3ResultSchema.safeParse({
      ...base,
      cbtRecommendation: { status: "unavailable", text: "Invented fallback" },
    }).success,
  ).toBe(false);
});

it.each([undefined, { status: "unavailable" as const }, { status: "support_required" as const }])(
  "keeps absent or unavailable suggestions honest (%j)",
  (cbtRecommendation) => {
    const value = analysis(0);
    value.result = journalAnalysisV3ResultSchema.parse({ ...value.result, cbtRecommendation });
    render(<JournalAnalysisDock enabled analysis={value} />);
    expect(screen.queryByText(/Generated by Buddy/)).not.toBeInTheDocument();
    if (cbtRecommendation?.status === "support_required")
      expect(screen.getByRole("link", { name: "Explore support options" })).toHaveAttribute("href", "/crisis-help");
  },
);

it("renders safe bold and numbered actions without interpreting HTML", () => {
  const value = analysis(0);
  value.result = journalAnalysisV3ResultSchema.parse({
    ...value.result,
    cbtRecommendation: {
      status: "available",
      text: "1. **Celebrate** with your *team*.\n2. Reflect on <img src=x onerror=alert(1)> safely.",
      model: { providerName: "buddy", modelVersion: "adapter", inferenceVersion: "reviewed" },
    },
  });
  const { container } = render(<JournalAnalysisDock enabled analysis={value} />);
  const region = screen.getByRole("region", { name: "Suggested next steps" });
  expect(region.querySelectorAll("ol li")).toHaveLength(2);
  expect(region.querySelector("strong")).toHaveTextContent("Celebrate");
  expect(region.querySelector("em")).toHaveTextContent("team");
  expect(region).not.toHaveTextContent("**Celebrate**");
  expect(container.querySelector("img[src=x]")).toBeNull();
  expect(region).toHaveTextContent("<img src=x onerror=alert(1)>");
});

it.each([
  ["gentle", "Cloudy days"],
  ["original", "Depressed"],
])("shows the category only in Deep analysis with %s wording", async (preference, label) => {
  localStorage.setItem("echo:analysis-wording", preference);
  const value = analysis(1);
  value.result = journalAnalysisV3ResultSchema.parse({
    ...value.result,
    distressCategory: "Depressed",
    categoryScores: { Others: 0, Anxious: 0, Depressed: 1, Frustrated: 0, Suicidal: 0 },
  });
  render(<JournalAnalysisDock enabled journalId="entry" analysis={value} />);
  expect(screen.queryByText("Journal category")).not.toBeInTheDocument();
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("switch", { name: "Deep analysis" }));
  expect(screen.getByText("Journal category")).toBeVisible();
  expect(screen.getByText(label)).toBeVisible();
  await user.click(screen.getByRole("switch", { name: "Deep analysis" }));
  expect(screen.queryByText("Journal category")).not.toBeInTheDocument();
});
