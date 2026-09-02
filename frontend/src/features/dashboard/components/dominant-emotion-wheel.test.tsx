import { render, screen } from "@/shared/test-utils/test-utils";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import type { JournalEntry } from "@/features/journal/model/journal.model";
import { DominantEmotionWheel } from "./dominant-emotion-wheel";

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

  it("uses the entry mood when no emotion tags were saved", () => {
    render(<DominantEmotionWheel entries={[entry("fallback", 0, [])]} />);

    expect(screen.getByText("Calm", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/appeared in 1 of 1 reflection/i)).toBeInTheDocument();
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
