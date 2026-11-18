"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  Activity,
  Brain,
  CalendarDays,
  FileText,
  Leaf,
  LockKeyhole,
  RefreshCw,
  ScanFace,
  Sparkles,
} from "lucide-react";
import type { DashboardInsights } from "@echo/contracts";
import { VerifiedFeatureGate } from "@/features/verification";
import { realAnalysisInsights } from "@/features/journal/model/real-analysis-insights";
import { useAnalysisWording } from "@/shared/hooks/use-analysis-wording";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { overallAnalysis, type AverageSignal } from "../model/overall-analysis";
import styles from "./overall-insights.module.css";
const emotionColors: Record<string, string> = {
  joy: "#e5ba54",
  calm: "#76ac8f",
  sadness: "#7887ad",
  anxiety: "#9680b0",
  anger: "#c17974",
  hope: "#a1b24b",
  trust: "#72a089",
  fear: "#9680b0",
  disgust: "#a18a65",
  anticipation: "#c39169",
  surprise: "#d0b363",
};
const title = (text: string) => text.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function Scores({ values, colored = false }: { values: AverageSignal[]; colored?: boolean }) {
  const { label } = useAnalysisWording();
  return values.length ? (
    <div className={styles.scores}>
      {values.map((item) => (
        <div key={item.label}>
          <span>{label(title(item.label))}</span>
          <span className={styles.track}>
            <span
              style={{ width: `${item.value * 100}%`, background: colored ? emotionColors[item.label] : undefined }}
            />
          </span>
          <strong>{item.value > 0 && item.value < 0.001 ? "<0.1" : (item.value * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  ) : (
    <p className={styles.empty}>No saved scores in this period.</p>
  );
}
function EmotionWheel({ values }: { values: AverageSignal[] }) {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient =
    values.length && Math.abs(total - 1) < 0.01
      ? `conic-gradient(${values
          .map((item) => {
            const start = cursor;
            cursor += item.value * 100;
            return `${emotionColors[item.label] ?? "#89a991"} ${start}% ${cursor}%`;
          })
          .join(",")})`
      : undefined;
  return (
    <div className={styles.donut} style={{ background: gradient }} role="img" aria-label="Overall emotion distribution">
      <div>
        <span>Most present</span>
        <strong>{values[0] ? title(values[0].label) : "Unavailable"}</strong>
        <small>{values[0] ? `${(values[0].value * 100).toFixed(1)}% average score` : "No saved scores"}</small>
      </div>
    </div>
  );
}
function Trend({ points }: { points: DashboardInsights["emotionTrend"] }) {
  if (!points.length) return <p className={styles.empty}>No dated analysis in this period.</p>;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = Date.parse(sorted[0].date),
    span = Math.max(1, Date.parse(sorted.at(-1)!.date) - first);
  const coords = sorted.map((point) => ({
    x: sorted.length === 1 ? 250 : 15 + ((Date.parse(point.date) - first) / span) * 470,
    y: 105 - Math.max(...Object.values(point.values)) * 90,
    date: point.date,
  }));
  return (
    <>
      <svg viewBox="0 0 500 120" role="img" aria-label="Daily leading emotion score trend" className={styles.trend}>
        <path d="M15 15V105H485" fill="none" stroke="currentColor" opacity=".15" />
        {coords.length > 1 && (
          <path
            d={`M${coords[0].x},105 L${coords.map((point) => `${point.x},${point.y}`).join(" L")} L${coords.at(-1)!.x},105 Z`}
            fill="currentColor"
            opacity=".08"
          />
        )}
        {coords.length > 1 && (
          <polyline
            points={coords.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        )}
        {coords.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="currentColor" />
        ))}
      </svg>
      <div className={styles.dates}>
        <span>{sorted[0].date}</span>
        <span>{sorted.at(-1)!.date}</span>
      </div>
    </>
  );
}
export function EmotionInsightsView({ preview = false }: { preview?: boolean }) {
  const vm = useInsightsViewModel(preview);
  const { label: analysisLabel } = useAnalysisWording();
  const insights = preview ? vm.overview : realAnalysisInsights(vm.overview);
  const summary = insights ? overallAnalysis(insights, preview && process.env.NODE_ENV === "development") : null;
  const [sourceId, setSourceId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const source = summary?.emotionSources.find((item) => item.identity === sourceId) ?? summary?.emotionSources.at(-1);
  const category =
    summary?.categorySources.find((item) => item.identity === categoryId) ?? summary?.categorySources.at(-1);
  const savedPerspective =
    insights?.latest && insights.latest.schemaVersion !== "echo-model-pipeline-v2"
      ? insights.latest.sanctuaryPerspective
      : null;
  const savedSuggestion =
    insights?.latest?.schemaVersion === "echo-journal-analysis-v3" &&
    !insights.latest.supportReviewRequired &&
    insights.latest.cbtRecommendation?.status === "available"
      ? insights.latest.cbtRecommendation.text
      : insights?.recommendation?.description;
  const customMenu = useRef<HTMLDetailsElement>(null);
  const [customFrom, setCustomFrom] = useState(""),
    [customTo, setCustomTo] = useState(""),
    [customError, setCustomError] = useState<string | null>(null);
  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customFrom || !customTo || customFrom > customTo) {
      setCustomError("Choose a valid start and end date.");
      return;
    }
    if ((Date.parse(customTo) - Date.parse(customFrom)) / 86_400_000 > 366) {
      setCustomError("Choose a range of 366 days or less.");
      return;
    }
    setCustomError(null);
    vm.applyCustomRange(customFrom, customTo);
    if (customMenu.current) customMenu.current.open = false;
  }

  // The public page header renders immediately; saved results stay behind the live access gate.
  const hero = (
    <header className="insights-hero relative overflow-visible rounded-[1.35rem] border border-primary/10 bg-card/90 px-4 py-4 shadow-[0_14px_34px_rgba(24,48,37,0.06)] sm:rounded-[1.5rem] sm:px-5">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[38%] overflow-hidden lg:w-[44%]"
        aria-hidden="true"
      >
        <Leaf
          className="absolute right-9 top-4 h-14 w-14 rotate-12 text-[#b9d1ac]/55 lg:right-16 lg:h-20 lg:w-20"
          strokeWidth={1}
        />
        <Leaf
          className="absolute right-0 top-11 h-20 w-20 -rotate-12 text-[#d9c981]/25 lg:right-2 lg:top-10 lg:h-28 lg:w-28"
          strokeWidth={0.8}
        />
      </div>
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[16.5rem] sm:max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-primary">
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            Reflective insights
          </p>
          <h1
            aria-label="Overall insights"
            className="mt-1 text-[clamp(1.9rem,3vw,3.2rem)] font-medium leading-[0.95] text-foreground [font-family:var(--font-echo-display)]"
          >
            {["Your", "emotional", "patterns"].map((word, index) => (
              <span className="insights-word-mask" key={word}>
                <span style={{ animationDelay: `${120 + index * 110}ms` }}>{word} </span>
              </span>
            ))}
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
            An overall view of saved analysis across your app activity in the selected period.
          </p>
          {preview ? (
            <p className="mt-2 text-xs font-semibold text-primary">
              Preview mode — simulated examples, not your results.
            </p>
          ) : null}
        </div>
        <div className="relative z-10 grid w-full grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
          <div
            className="grid min-w-0 grid-cols-3 rounded-full border border-primary/10 bg-background p-1 shadow-subtle"
            role="group"
            aria-label="Analysis period"
          >
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => vm.setTimeRange(range)}
                aria-pressed={vm.timeRange === range}
                className={`h-10 rounded-full px-1 text-[11px] font-bold transition-colors sm:px-3 ${vm.timeRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <details
            ref={customMenu}
            className="insights-custom-range group relative min-w-0"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary
              className={`inline-flex h-12 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-bold shadow-subtle sm:gap-2 sm:px-3 ${vm.timeRange === "custom" ? "border-primary bg-secondary text-primary" : "border-primary/10 bg-background text-muted-foreground"}`}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Custom
            </summary>
            <form
              onSubmit={applyCustom}
              className="absolute right-0 top-14 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-primary/10 bg-card p-4 shadow-2xl sm:w-72"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 text-[10px] font-bold text-muted-foreground">
                  From
                  <input
                    required
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-1 text-xs text-foreground sm:px-2"
                  />
                </label>
                <label className="min-w-0 text-[10px] font-bold text-muted-foreground">
                  To
                  <input
                    required
                    type="date"
                    min={customFrom || undefined}
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-1 text-xs text-foreground sm:px-2"
                  />
                </label>
              </div>
              {customError ? (
                <p role="alert" className="mt-2 text-[10px] text-danger">
                  {customError}
                </p>
              ) : null}
              <button
                type="submit"
                className="mt-3 h-11 w-full rounded-full bg-primary text-xs font-bold text-primary-foreground"
              >
                Apply range
              </button>
            </form>
          </details>
        </div>
      </div>
      <p className="relative mt-3 flex items-center gap-2 border-t border-primary/10 pt-3 text-[10px] leading-4 text-muted-foreground">
        <LockKeyhole size={13} aria-hidden="true" className="shrink-0" />
        AI supports reflection and does not replace professional care.
      </p>
    </header>
  );

  const dashboard = (
    <div className={`insights-premium insights-compact ${styles.page}`} aria-busy={vm.isLoading}>
      {hero}
      {vm.error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-danger/20 p-3 text-sm">
          <span>{vm.error}</span>
          <button type="button" onClick={vm.retry} className="font-semibold text-primary">
            Retry
          </button>
        </div>
      )}
      {vm.isLoading && !insights ? (
        <p role="status" className="p-8 text-center text-sm text-muted-foreground">
          Loading overall insights…
        </p>
      ) : summary && insights ? (
        <>
          <section aria-label="Overall analysis summary" className={styles.metrics}>
            {[
              [
                Brain,
                "Dominant emotion",
                source?.scores[0] ? analysisLabel(title(source.scores[0].label)) : "Unavailable",
                "Most present average signal",
              ],
              [
                Activity,
                "Top emotion score",
                source?.scores[0] ? `${(source.scores[0].value * 100).toFixed(1)}%` : "Unavailable",
                "Average model score, not confidence",
              ],
              [FileText, "Reflection count", summary.reports ?? "Unavailable", "Completed analyses in this period"],
              [CalendarDays, "Analysis days", summary.analyzedDays, "Dates with saved text results"],
            ].map(([Icon, name, value, note]) => {
              const MetricIcon = Icon as typeof Brain;
              return (
                <article key={String(name)}>
                  <MetricIcon size={17} aria-hidden="true" />
                  <div>
                    <p>{String(name)}</p>
                    <strong>{String(value)}</strong>
                    <small>{String(note)}</small>
                  </div>
                </article>
              );
            })}
          </section>
          {insights.period?.historyTruncated && (
            <p role="status" className="rounded-xl border border-border p-3 text-xs">
              History is limited to the latest 1,000 saved outputs. Choose a shorter period for complete coverage.
            </p>
          )}
          <section aria-label="Overall analysis cards" className={styles.grid}>
            <article className={`${styles.card} ${styles.emotions}`}>
              <header>
                <span className={styles.icon}>
                  <Brain size={17} />
                </span>
                <div>
                  <p className={styles.eyebrow}>Emotion analysis</p>
                  <h2>Textual and facial signals</h2>
                </div>
                <span className={styles.badge}>Text model · {source?.points.length ?? 0} days</span>
              </header>
              {summary.emotionSources.length > 1 && (
                <label className={styles.source}>
                  Analysis source
                  <select value={source?.identity} onChange={(event) => setSourceId(event.target.value)}>
                    {summary.emotionSources.map((item, index) => (
                      <option key={item.identity} value={item.identity}>
                        Source {index + 1} · {item.points.length} days
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className={styles.emotionBody}>
                <div className={styles.distribution}>
                  <EmotionWheel values={source?.scores ?? []} />
                  <Scores values={source?.scores ?? []} colored />
                </div>
                <div className={styles.signal}>
                  <p className={styles.eyebrow}>Dominant signal strength</p>
                  <Trend points={source?.points ?? []} />
                  <p className={styles.note}>Average daily signals · Missing days stay unfilled</p>
                </div>
              </div>
              <p className={styles.note}>
                Overall saved text scores in the selected period. Facial results remain separate.
              </p>
            </article>
            <article className={`${styles.card} ${styles.perspective}`}>
              <header>
                <span className={styles.icon}>
                  <Sparkles size={17} />
                </span>
                <div>
                  <p className={styles.eyebrow}>Sanctuary perspective</p>
                  <h2>A kinder view of the whole pattern</h2>
                </div>
                <span className={styles.badge}>{savedPerspective ? "Saved perspective" : "Not available"}</span>
              </header>
              {savedPerspective ? (
                <div className={styles.perspectiveBox}>
                  <strong>{analysisLabel(savedPerspective.headline)}</strong>
                  <p>{analysisLabel(savedPerspective.narrative)}</p>
                </div>
              ) : (
                <div className={styles.perspectiveBox}>
                  <strong>No saved overall perspective yet</strong>
                  <p>
                    This space is reserved for a saved written perspective. ECHO does not turn scores into an invented
                    narrative.
                  </p>
                </div>
              )}
              <div className={styles.nextStep}>
                <p className={styles.eyebrow}>Latest saved next step</p>
                {savedSuggestion ? (
                  <>
                    <strong>{analysisLabel(insights.recommendation?.title ?? "A gentle way forward")}</strong>
                    <p className="line-clamp-2">{analysisLabel(savedSuggestion.replace(/\*/g, ""))}</p>
                    {savedSuggestion.length > 180 && (
                      <details>
                        <summary>Read suggestion</summary>
                        <p>{analysisLabel(savedSuggestion.replace(/\*/g, ""))}</p>
                      </details>
                    )}
                  </>
                ) : (
                  <p>No saved recommendation is available in this period.</p>
                )}
              </div>
            </article>
            <article className={`${styles.card} ${styles.screening}`}>
              <header>
                <span className={styles.icon}>
                  <FileText size={17} />
                </span>
                <div>
                  <p className={styles.eyebrow}>{analysisLabel("Depression")} · PHQ-8 estimate</p>
                  <h2>Journal-derived symptom estimate</h2>
                </div>
              </header>
              <p className={styles.value}>
                {summary.meanPhq === null ? (
                  "Unavailable"
                ) : (
                  <>
                    {summary.meanPhq.toFixed(1)}
                    <small>of 24</small>
                  </>
                )}
              </p>
              <div className={styles.estimateTrack}>
                <span style={{ width: summary.meanPhq === null ? "0%" : `${(summary.meanPhq / 24) * 100}%` }} />
              </div>
              <dl className={styles.counts}>
                <div>
                  <dt>Complete</dt>
                  <dd>{summary.complete.length}</dd>
                </div>
                <div>
                  <dt>Incomplete</dt>
                  <dd>{summary.partial.length}</dd>
                </div>
                <div>
                  <dt>Unavailable</dt>
                  <dd>{summary.unavailable}</dd>
                </div>
              </dl>
              <p className={styles.note}>
                Average of complete journal estimates. Incomplete estimates stay unscored. This is not a questionnaire
                score or diagnosis.
              </p>
              {summary.estimates.length > 0 && (
                <details className={styles.estimateDetails}>
                  <summary>View recent daily estimates</summary>
                  <div className={styles.rows}>
                    {[...summary.estimates]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 4)
                      .map((point, index) => (
                        <div key={point.date + index}>
                          <time>{point.date.slice(0, 10)}</time>
                          <span>
                            {point.status !== "available"
                              ? "Unavailable"
                              : point.coverage === 8
                                ? `${point.total} / 24`
                                : `${point.coverage}/8 evidenced`}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </article>
            <article className={`${styles.card} ${styles.classification}`}>
              <header>
                <span className={styles.icon}>
                  <Activity size={17} />
                </span>
                <div>
                  <p className={styles.eyebrow}>Journal signal patterns</p>
                  <h2>Overall support signals</h2>
                </div>
              </header>
              {summary.categorySources.length > 1 && (
                <label className={styles.source}>
                  Classification source
                  <select value={category?.identity} onChange={(event) => setCategoryId(event.target.value)}>
                    {summary.categorySources.map((item, index) => (
                      <option key={item.identity} value={item.identity}>
                        Source {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {category?.counts.length ? (
                <>
                  <p className={styles.value}>{analysisLabel(category.counts[0][0])}</p>
                  <div className={styles.scores}>
                    {category.counts.map(([name, count]) => (
                      <div key={name}>
                        <span>{analysisLabel(name)}</span>
                        <span className={styles.track}>
                          <span
                            style={{
                              width: `${(count / category.counts.reduce((sum, item) => sum + item[1], 0)) * 100}%`,
                            }}
                          />
                        </span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.empty}>No saved journal classifications in this period.</p>
              )}
              <p className={styles.note}>
                Dated dataset classifications across this period. They do not predict harm or establish clinical
                severity.
              </p>
            </article>
            <article className={`${styles.card} ${styles.face}`}>
              <header>
                <span className={styles.icon}>
                  <ScanFace size={17} />
                </span>
                <div>
                  <p className={styles.eyebrow}>Facial expression analysis</p>
                  <h2>{summary.faceCount ? "Overall facial expressions" : "Model output unavailable"}</h2>
                </div>
              </header>
              <Scores values={summary.faceScores} />
              <p className={styles.note}>
                <LockKeyhole size={11} className="mr-1 inline" />
                Only consented saved expression outputs are included. No face preview is shown.
              </p>
            </article>
          </section>
        </>
      ) : (
        !vm.error && (
          <p className="rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
            No completed analysis yet. Save a reflection with optional analysis to build your overview.
          </p>
        )
      )}
      <p className={styles.privacy}>
        <LockKeyhole size={13} aria-hidden="true" />
        Only your saved, consented analysis is included. Model outputs support reflection, not diagnosis.
      </p>
    </div>
  );
  return preview ? (
    dashboard
  ) : (
    <VerifiedFeatureGate
      featureName="AI insights"
      loadingFallback={
        <div className={styles.page}>
          {hero}
          <p className="p-6 text-sm">Loading overall insights…</p>
        </div>
      }
    >
      {dashboard}
    </VerifiedFeatureGate>
  );
}
