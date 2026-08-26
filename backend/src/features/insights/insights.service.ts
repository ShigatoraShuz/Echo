import type { JournalService } from "../journals/journals.service.js";
import { moodScores } from "../../shared/utils/mood.js";
import { startOfUtcDay, dateKey } from "../../shared/utils/date.js";

export class InsightsService {
  constructor(private readonly journals: JournalService) {}

  async emotionInsights(userId: string) {
    const entries = await this.journals.list(userId);
    const moods = ["calm", "happy", "neutral", "anxious", "sad", "angry"];
    const counts = new Map(moods.map((mood) => [mood, 0]));
    for (const entry of entries) counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
    const total = Math.max(entries.length, 1);
    const emotionWheel = moods.map((mood) => ({
      label: mood[0].toUpperCase() + mood.slice(1),
      mood,
      value: Math.round(((counts.get(mood) ?? 0) / total) * 100),
    }));
    const today = startOfUtcDay(new Date());
    const moodTrend = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - (6 - index));
      const matching = entries.filter((entry) => dateKey(entry.created_at) === dateKey(day));
      return {
        label: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        value: matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0,
      };
    });
    const strongest = [...emotionWheel].sort((a, b) => b.value - a.value)[0];
    return {
      emotionWheel,
      moodTrend,
      summary: entries.length
        ? `${strongest.label} is the most frequent signal across ${entries.length} recent reflection${entries.length === 1 ? "" : "s"}.`
        : "No patterns are shown until you save a reflection.",
    };
  }
}
