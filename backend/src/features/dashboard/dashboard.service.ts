import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../journals/journals.service.js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";
import { asString } from "../../shared/utils/coerce.js";
import { moodScores } from "../../shared/utils/mood.js";
import { startOfUtcDay, dateKey } from "../../shared/utils/date.js";

type DatabaseRow = Record<string, unknown>;

function calculateStreak(entries: Array<{ created_at: string }>): number {
  const dates = new Set(entries.map((entry) => dateKey(entry.created_at)));
  const cursor = startOfUtcDay(new Date());
  if (!dates.has(dateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export class DashboardService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly journals: JournalService,
  ) {}

  async dashboard(userId: string, range = "7d") {
    const [entries, profileResult, preferenceResult] = await Promise.all([
      this.journals.list(userId),
      this.database.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      this.database
        .from("notification_preferences")
        .select("reminder_time")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (profileResult.error || preferenceResult.error) {
      throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your dashboard is temporarily unavailable.");
    }

    const today = startOfUtcDay(new Date());
    let moodTrend: Array<{ label: string; value: number }>;

    if (range === "30d" || range === "month") {
      // 4 clean weekly buckets over the 30-day period
      moodTrend = Array.from({ length: 4 }, (_, index) => {
        const weekEnd = new Date(today);
        weekEnd.setUTCDate(weekEnd.getUTCDate() - (3 - index) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        const matching = entries.filter((entry) => {
          const entryDate = new Date(entry.created_at);
          return entryDate >= weekStart && entryDate <= weekEnd;
        });
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        return { label: `Week ${index + 1}`, value };
      });
    } else if (range === "90d") {
      // 3 monthly intervals over 90 days
      moodTrend = Array.from({ length: 3 }, (_, index) => {
        const periodEnd = new Date(today);
        periodEnd.setUTCDate(periodEnd.getUTCDate() - (2 - index) * 30);
        const periodStart = new Date(periodEnd);
        periodStart.setUTCDate(periodStart.getUTCDate() - 29);
        const matching = entries.filter((entry) => {
          const entryDate = new Date(entry.created_at);
          return entryDate >= periodStart && entryDate <= periodEnd;
        });
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        const monthLabel = periodEnd.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return { label: monthLabel, value };
      });
    } else {
      moodTrend = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - (6 - index));
        const matching = entries.filter((entry) => dateKey(entry.created_at) === dateKey(day));
        const value = matching.length
          ? Math.round(matching.reduce((sum, entry) => sum + (moodScores[entry.mood] ?? 60), 0) / matching.length)
          : 0;
        return { label: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), value };
      });
    }

    const moodCounts = new Map<string, number>();
    for (const entry of entries) moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1);
    const topMood = [...moodCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "calm";
    const weeklyDigest = entries.length
      ? [
          `You kept ${entries.length} private reflection${entries.length === 1 ? "" : "s"} close.`,
          `${topMood[0]?.toUpperCase() ?? ""}${topMood.slice(1)} appeared most often in your recent entries.`,
          entries.some((entry) => entry.tags.length > 0)
            ? "Your saved tags can help you revisit recurring themes."
            : "Adding a small tag can make recurring themes easier to revisit.",
        ]
      : [
          "Your reflection space is ready when you are.",
          "A few honest words are enough for a first entry.",
          "Your entries remain private by design.",
        ];

    return {
      userProfile: {
        name: asString((profileResult.data as DatabaseRow | null)?.display_name, "Friend"),
        streakDays: calculateStreak(entries),
        nextCheckIn: asString((preferenceResult.data as DatabaseRow | null)?.reminder_time, "Whenever you are ready"),
        privacyStatus: "Private",
      },
      latestEntry: entries[0] ?? null,
      journalEntries: entries,
      moodTrend,
      riskTrend: moodTrend.map((point) => ({ label: point.label, value: Math.max(0, 100 - point.value) })),
      weeklyDigest,
      quickActions: [
        { href: "/journal/new", title: "Write a reflection", description: "Private journal entry" },
        { href: "/buddy", title: "Talk with Buddy", description: "Gentle check-in conversation" },
        { href: "/tools/grounding", title: "Grounding exercise", description: "Breathing or sensory" },
        { href: "/insights/emotion", title: "Review patterns", description: "Mood and emotion trends" },
      ],
    };
  }
}
