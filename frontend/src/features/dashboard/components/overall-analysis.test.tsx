import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import type { JournalEntry } from "@/features/journal/model/journal.model";
import { OverallAnalysis } from "./overall-analysis";

function entry(daysAgo: number, mood: JournalEntry["mood"]): JournalEntry {
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id: `${daysAgo}-${mood}`,
    title: "Reflection",
    body: "Reflection",
    excerpt: "Reflection",
    mood,
    emotions: [],
    tags: ["rest"],
    privacyStatus: "private",
    analysisConsent: false,
    riskScore: 0,
    riskBand: "low",
    summary: "",
    perspective: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("overall dashboard analysis", () => {
  it("keeps the last-30-day count distinct from older reflections", async () => {
    render(<OverallAnalysis entries={[entry(60, "calm")]} />);
    expect(screen.getByText("0 reflections in this period")).toBeInTheDocument();
    expect(screen.getByText("No journal estimate comparison yet.")).toBeInTheDocument();
    const disclosure = screen.getByText("Past 30 days").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    await userEvent.setup().click(screen.getByText("Past 30 days"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText(/At least three days with real analysis/i)).toBeInTheDocument();
  });

  it("compares only real analysis days and retains the caution", async () => {
    const insights: DashboardInsights = {
      latest: null,
      recommendation: null,
      emotionTrend: [],
      distressTrend: [
        { date: "2026-10-01", band: "low", value: 0.8, isSimulated: false },
        { date: "2026-10-02", band: "high", value: 1, isSimulated: true },
        { date: "2026-10-03", band: "low", value: 0.6, isSimulated: false },
        { date: "2026-10-04", band: "low", value: 0.4, isSimulated: false },
      ],
    };
    render(<OverallAnalysis entries={[entry(1, "calm"), entry(2, "happy"), entry(3, "calm")]} insights={insights} />);
    expect(screen.getByText("3 reflections across 3 days")).toBeInTheDocument();
    expect(screen.getByText("Journal distress estimate: lower across 3 real analysis days.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Past 30 days"));
    expect(screen.getByText(/These summaries describe saved reflections/i)).toBeInTheDocument();
    expect(screen.getByText("Moods you recorded")).toBeInTheDocument();
  });
});
