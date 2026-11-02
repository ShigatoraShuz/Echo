import { render, screen } from "@/shared/test-utils/test-utils";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import type { DashboardInsights } from "@echo/contracts";
import type { JournalEntry } from "@/features/journal/model/journal.model";
import { DominantEmotionWheel } from "./dominant-emotion-wheel";

const historyApi = vi.hoisted(() => vi.fn());
vi.mock("@/services/insights/insights-service.factory", () => ({
  getInsightsService: () => ({ getAnalysisOverview: historyApi }),
}));
function entry(id: string, daysAgo: number, emotions: string[]): JournalEntry {
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id,
    title: id,
    body: "Reflection",
    excerpt: "Reflection",
    mood: "calm",
    emotions,
    tags: [],
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

const entries = [
  entry("today", 0, ["peaceful"]),
  entry("recent", 2, ["peaceful", "hopeful"]),
  entry("month", 20, ["worried"]),
  entry("six-month", 120, ["angry"]),
];

describe("DominantEmotionWheel", () => {
  it("shows the dominant emotion for the selected period", async () => {
    const user = userEvent.setup();
    render(<DominantEmotionWheel entries={entries} />);

    expect(screen.getByText("Peaceful", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/appeared in 2 of 2 reflections across the last 7 days/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "the last 6 months" }));

    expect(screen.getByText(/appeared in 2 of 4 reflections across the last 6 months/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "the last 6 months" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Angry")).toBeInTheDocument();
  });

  it("does not fabricate an emotion from the retired mood field", () => {
    render(<DominantEmotionWheel entries={[entry("fallback", 0, [])]} />);

    expect(screen.queryByText("Calm", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.getByText("No emotions recorded the last 7 days.")).toBeInTheDocument();
  });

  it("expands to the nearest range containing saved reflections", () => {
    render(<DominantEmotionWheel entries={[entry("older", 40, ["calm"])]} />);

    expect(screen.getByRole("radio", { name: "the last 3 months" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Calm", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/across the last 3 months/i)).toBeInTheDocument();
  });

  it("shows a useful empty state for a period without reflections", () => {
    render(<DominantEmotionWheel entries={[entry("old", 220, ["hopeful"])]} />);

    expect(screen.getByText("No emotions recorded the last 7 days.")).toBeInTheDocument();
    expect(screen.getByText(/add an emotion to a reflection/i)).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<DominantEmotionWheel entries={entries} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("saved model emotion wheel", () => {
  const dateKey = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const base = (): DashboardInsights => ({
    latest: null,
    recommendation: null,
    distressTrend: [],
    emotionTrend: [
      { date: dateKey(0), values: { joy: 0.8, sadness: 0.2 }, isSimulated: false },
      { date: dateKey(1), values: { anger: 1 }, isSimulated: true },
    ],
  });
  it("uses real model scores and excludes manual tags and simulated days", () => {
    render(<DominantEmotionWheel entries={[entry("manual", 0, ["angry"])]} insights={base()} />);
    expect(screen.getByText("Joy", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("80% of scores")).toBeVisible();
    expect(screen.getByText(/Average of 1 saved analysis day/)).toBeVisible();
    expect(screen.queryByText("Angry")).not.toBeInTheDocument();
  });
  it("shows an honest empty state when no model analysis exists", () => {
    render(<DominantEmotionWheel entries={[entry("manual", 0, ["calm"])]} insights={null} />);
    expect(screen.getByText("No saved analysis the last 7 days.")).toBeVisible();
    expect(screen.queryByText("Calm", { selector: "strong" })).not.toBeInTheDocument();
  });
  it("loads six months of real history when the longer range is selected", async () => {
    historyApi.mockResolvedValueOnce({
      success: true,
      data: { ...base(), emotionTrend: [{ date: dateKey(150), values: { anger: 1 }, isSimulated: false }] },
    });
    render(<DominantEmotionWheel entries={[]} insights={base()} />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "the last 6 months" }));
    expect(await screen.findByText("Anger", { selector: "strong" })).toBeVisible();
    expect(historyApi).toHaveBeenCalledWith(
      "custom",
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.any(AbortSignal),
    );
  });
  it("offers a real retry when history fails instead of keeping stale scores", async () => {
    historyApi
      .mockResolvedValueOnce({ success: false, error: { message: "Unavailable", code: "NETWORK" } })
      .mockResolvedValueOnce({ success: true, data: base() });
    render(<DominantEmotionWheel entries={[]} insights={base()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "the last 3 months" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Joy", { selector: "strong" })).toBeVisible();
  });
});
