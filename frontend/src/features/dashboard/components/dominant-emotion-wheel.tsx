"use client";

import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import type { JournalEntry } from "@/features/journal/model/journal.model";

type EmotionRange = "day" | "week" | "1m" | "3m" | "6m";

interface DominantEmotionWheelProps {
  entries: JournalEntry[];
}

const RANGE_OPTIONS: Array<{
  value: EmotionRange;
  label: string;
  days: number;
  description: string;
}> = [
  { value: "day", label: "Day", days: 1, description: "today" },
  { value: "week", label: "Week", days: 7, description: "the last 7 days" },
  { value: "1m", label: "1M", days: 30, description: "the last month" },
  { value: "3m", label: "3M", days: 90, description: "the last 3 months" },
  { value: "6m", label: "6M", days: 180, description: "the last 6 months" },
];

const EMOTION_COLORS: Record<string, string> = {
  calm: "#5f8b68",
  peaceful: "#6f9c87",
  hopeful: "#a5a84b",
  happy: "#d4a84f",
  joy: "#d7a34a",
  grateful: "#c58a59",
  neutral: "#9aa28d",
  worried: "#8f83ac",
  anxious: "#826f9d",
  overwhelmed: "#6f7695",
  sad: "#6d85a6",
  sadness: "#6d85a6",
  regretful: "#917a8d",
  frustrated: "#b16f63",
  angry: "#b85f52",
  anger: "#b85f52",
};

const FALLBACK_COLORS = ["#47715b", "#bf8650", "#7a88a8", "#a36f86", "#8a995d", "#a76358"];

function formatEmotion(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function startOfLocalPeriod(reference: Date, days: number) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

export function DominantEmotionWheel({ entries }: DominantEmotionWheelProps) {
  const [range, setRange] = useState<EmotionRange>("week");
  const selectedRange = RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[1];

  const insight = useMemo(() => {
    const now = new Date();
    const periodStart = startOfLocalPeriod(now, selectedRange.days);
    const periodEnd = now.getTime();
    const filteredEntries = entries.filter((entry) => {
      const timestamp = new Date(entry.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= periodStart && timestamp <= periodEnd;
    });

    const counts = new Map<string, number>();
    for (const entry of filteredEntries) {
      const signals = entry.emotions.length > 0 ? entry.emotions : [entry.mood];
      const uniqueSignals = new Set(signals.map((emotion) => emotion.trim().toLowerCase()).filter(Boolean));
      for (const emotion of uniqueSignals) counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
    }

    const ranked = [...counts.entries()]
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion));
    const totalSignals = ranked.reduce((sum, item) => sum + item.count, 0);
    const leading = ranked.slice(0, 5);
    const otherCount = ranked.slice(5).reduce((sum, item) => sum + item.count, 0);
    const visible = otherCount > 0 ? [...leading, { emotion: "other", count: otherCount }] : leading;

    return {
      entries: filteredEntries,
      dominant: ranked[0] ?? null,
      totalSignals,
      segments: visible.map((item, index) => ({
        ...item,
        color: EMOTION_COLORS[item.emotion] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        percentage: totalSignals > 0 ? (item.count / totalSignals) * 100 : 0,
      })),
    };
  }, [entries, selectedRange.days]);

  let offset = 0;

  return (
    <section aria-labelledby="emotion-wheel-title">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Emotional patterns
          </p>
          <h2 id="emotion-wheel-title" className="mt-1 text-lg font-semibold tracking-[-0.035em]">
            Your emotion wheel
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            See which feelings appear most often in your reflections.
          </p>
        </div>

        <div
          className="grid grid-cols-5 rounded-full border border-[var(--landing-primary-15)] bg-white/70 p-1 shadow-sm"
          role="radiogroup"
          aria-label="Emotion wheel time range"
        >
          {RANGE_OPTIONS.map((option) => {
            const isSelected = range === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={option.value === "day" ? "Today" : option.description}
                onClick={() => setRange(option.value)}
                className={`min-h-8 min-w-10 rounded-full px-2 text-[11px] font-bold outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.96] ${
                  isSelected
                    ? "bg-[var(--landing-primary)] text-[var(--landing-inverse)] shadow-sm"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {insight.dominant ? (
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(0,190px)_1fr]">
          <div className="relative mx-auto h-[184px] w-[184px]">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label={`${formatEmotion(insight.dominant.emotion)} is the most present emotion for ${selectedRange.description}, appearing in ${insight.dominant.count} of ${insight.entries.length} reflections.`}
              className="h-full w-full -rotate-90 drop-shadow-[0_12px_24px_rgba(35,62,39,0.13)]"
            >
              <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(71,113,91,0.10)" strokeWidth="27" />
              {insight.segments.map((segment) => {
                const segmentOffset = offset;
                offset += segment.percentage;
                return (
                  <circle
                    key={segment.emotion}
                    cx="100"
                    cy="100"
                    r="76"
                    pathLength="100"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="27"
                    strokeDasharray={`${Math.max(0, segment.percentage - 0.8)} ${100 - Math.max(0, segment.percentage - 0.8)}`}
                    strokeDashoffset={-segmentOffset}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-[36px] flex flex-col items-center justify-center rounded-full border border-white/80 bg-[rgba(255,253,247,0.94)] text-center shadow-inner">
              <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Most present
              </span>
              <strong className="mt-1 max-w-[105px] truncate text-lg font-semibold capitalize tracking-[-0.04em] text-foreground">
                {formatEmotion(insight.dominant.emotion)}
              </strong>
              <span className="mt-0.5 text-[10px] font-semibold text-primary">
                {Math.round((insight.dominant.count / insight.totalSignals) * 100)}% of tags
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="rounded-2xl border border-[var(--landing-primary-10)] bg-white/62 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Dominant emotion
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-foreground [font-family:var(--font-echo-display)]">
                {formatEmotion(insight.dominant.emotion)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Appeared in {insight.dominant.count} of {insight.entries.length}{" "}
                {insight.entries.length === 1 ? "reflection" : "reflections"} {selectedRange.description === "today" ? "today" : `across ${selectedRange.description}`}.
              </p>
            </div>

            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2" aria-label="Emotion distribution">
              {insight.segments.map((segment) => (
                <li key={segment.emotion} className="flex min-w-0 items-center gap-2 text-[11px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate capitalize text-muted-foreground">
                    {formatEmotion(segment.emotion)}
                  </span>
                  <span className="font-bold tabular-nums text-foreground">{Math.round(segment.percentage)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex min-h-[184px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--landing-primary-15)] bg-white/45 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-[10px] border-secondary/80">
            <span className="h-2.5 w-2.5 rounded-full bg-primary/45" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">No emotions recorded {selectedRange.description}.</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
            Add an emotion to a reflection and its pattern will appear here.
          </p>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
        <LockKeyhole className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
        Calculated privately from your saved emotion tags. This pattern is not a diagnosis.
      </p>
    </section>
  );
}
