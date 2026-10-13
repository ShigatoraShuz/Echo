import { ChevronDown } from "lucide-react";
import type { DashboardInsights } from "@echo/contracts";
import type { DashboardEntry } from "../model/dashboard.model";

export function summarizeReflections(entries: DashboardEntry[], now = Date.now()) {
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
export function OverallAnalysis({ entries, insights }: { entries: DashboardEntry[]; insights?: DashboardInsights }) {
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
    <details className="echo-compact-card group min-w-0 open:lg:col-span-2 xl:col-span-3 xl:p-4 open:xl:col-span-12" aria-labelledby="overall-analysis-title">
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 id="overall-analysis-title" className="text-sm font-semibold text-foreground">Past 30 days</h2>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {summary.total} reflection{summary.total === 1 ? "" : "s"}
            {summary.total > 0 ? ` across ${summary.days} day${summary.days === 1 ? "" : "s"}` : " in this period"}
          </p>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">
            {direction
              ? `Journal distress estimate: ${direction} across ${trend.length} real analysis days.`
              : "No journal estimate comparison yet."}
          </p>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">Reflective patterns, not clinical conclusions.</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <span>Details</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="mt-4 border-t border-border/70 pt-4">
        {summary.total < 3 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            A few more saved reflections in this period will give you more context for noticing patterns.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
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
        <div className="mt-4 border-t border-border/70 pt-4">
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
      </div>
    </details>
  );
}
