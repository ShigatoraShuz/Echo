import { describe, expect, it } from "vitest";
import { emotionInsights } from "./insights.js";

describe("insight derivation", () => {
  it("derives from journal API results", () => expect(emotionInsights([{ id: "1", mood: "calm", tags: [], created_at: new Date().toISOString() }]).emotionWheel.find((item) => item.mood === "calm")?.value).toBe(100));
  it("changes trend aggregation to match the selected range", () => {
    const entries = [{ id: "1", mood: "calm", tags: [], created_at: new Date().toISOString() }];
    expect(emotionInsights(entries, 7).moodTrend).toHaveLength(7);
    expect(emotionInsights(entries, 30).moodTrend).toHaveLength(10);
    expect(emotionInsights(entries, 90).moodTrend).toHaveLength(13);
  });
});
