import type { DashboardInsights } from "@echo/contracts";
import type { JournalEntry } from "@/features/journal/model/journal.model";

export function summarizeReflections(entries: JournalEntry[], now = Date.now()) {
  const recent = entries.filter(
    (entry) => Date.parse(entry.createdAt) >= now - 30 * 86_400_000 && Date.parse(entry.createdAt) <= now,
  );
  const count = (items: string[]) =>
    [...items.reduce((map, item) => map.set(item, (map.get(item) ?? 0) + 1), new Map<string, number>())].sort(
      (a, b) => b[1] - a[1],
    );
  return {
    total: recent.length,
    days: new Set(recent.map((entry) => entry.createdAt.slice(0, 10))).size,
    moods: count(recent.map((entry) => entry.mood)),
    themes: count(recent.flatMap((entry) => [...new Set(entry.tags)]))
      .filter(([, n]) => n > 1)
      .slice(0, 3),
  };
}
export function OverallAnalysis({ entries, insights }: { entries: JournalEntry[]; insights?: DashboardInsights }) {
  const summary = summarizeReflections(entries);
  const trend = insights?.distressTrend.filter((point) => !point.isSimulated) ?? [];
  const direction =
    trend.length < 3
      ? null
      : trend.at(-1)!.value > trend[0].value
        ? "higher"
        : trend.at(-1)!.value < trend[0].value
          ? "lower"
          : "unchanged";
  return (
    <section
      className="rounded-3xl border border-primary/15 bg-card p-5 sm:p-6"
      aria-labelledby="overall-analysis-title"
    >
      <p className="text-xs uppercase tracking-widest text-primary">The bigger picture · past 30 days</p>
      <h2 id="overall-analysis-title" className="mt-2 font-serif text-3xl">
        Overall analysis
      </h2>
      {summary.total < 3 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          You have {summary.total} saved reflection{summary.total === 1 ? "" : "s"} in this period. A few more entries
          will give you more context for noticing patterns.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{summary.total}</p>
            <p className="mt-1 text-sm text-muted-foreground">reflections across {summary.days} days</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Moods you recorded</h3>
            <p className="mt-2 text-sm capitalize text-muted-foreground">
              {summary.moods
                .slice(0, 3)
                .map(([mood, count]) => `${mood} (${count})`)
                .join(" · ")}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Recurring tags</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.themes.length
                ? summary.themes.map(([tag, count]) => `${tag} (${count})`).join(" · ")
                : "No repeated tags in this period."}
            </p>
          </div>
        </div>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Journal estimate direction</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {direction
            ? `Across ${trend.length} days with real analysis, the latest distress estimate is ${direction} compared with the first. Individual days may vary.`
            : "At least three days with real analysis are needed for this comparison. Simulated results are excluded."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          These summaries describe saved reflections and AI estimates. They are not clinical conclusions or a measure of
          your progress as a person.
        </p>
      </div>
    </section>
  );
}
