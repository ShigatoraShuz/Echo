"use client";
import { AiSupportNotice } from "@/shared/components/echo/ai-support-notice";
import { realAnalysisInsights } from "@/features/journal/model/real-analysis-insights";
const AnalysisHistory = dynamic(() => import("./analysis-history").then(m => m.AnalysisHistory), { loading: () => <p role="status" className="text-sm text-muted-foreground">Loading saved report…</p> });
import { AnalysisRequestStatus } from "@/features/journal/components/analysis-request-status";
const NativeAnalysis = dynamic(() => import("@/features/journal/components/native-analysis").then(m => m.NativeAnalysis), { loading: () => <p role="status" className="text-sm text-muted-foreground">Loading saved report…</p> });

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  Brain,
  CalendarDays,
  FileText,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Minus,
  RefreshCw,
  ScanFace,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { DashboardInsights, JournalAnalysisResult as AnyJournalResult } from "@echo/contracts";
import dynamic from "next/dynamic";
const ModelPipelinePanel = dynamic(() =>
  import("@/features/journal/components/model-pipeline-panel").then((m) => m.ModelPipelinePanel),
);
import { EchoDialog } from "@/shared/components/ui/echo-dialog";
import Link from "next/link";
import { VerifiedFeatureGate } from "@/features/verification";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";

type JournalAnalysisResult = Exclude<AnyJournalResult, { schemaVersion: "echo-model-pipeline-v2" }>;

const emotionColors: Record<string, string> = {
  joy: "#e6b955",
  calm: "#6fad8a",
  sadness: "#7181a7",
  anxiety: "#8e79ad",
  anger: "#c06f68",
  hope: "#9ba947",
  trust: "#6d9c85",
  anticipation: "#c18e61",
  fear: "#8e79ad",
  disgust: "#a28b60",
  surprise: "#c9a34e",
};

const facialStatusCopy: Record<string, string> = {
  not_requested: "Not requested for the latest reflection",
  not_captured: "No valid facial mesh was captured",
  captured_pending_provider: "Mesh captured; facial model provider not connected",
  queued: "Facial mesh is queued securely",
  analyzing: "Facial expression analysis is in progress",
  completed: "Facial expression signal is ready",
  unavailable: "Facial analysis is currently unavailable",
  failed: "Facial analysis could not finish",
};

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function Panel({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  return (
    <EchoMotionSurface
      as="article"
      id={id}
      entryDelay={delay}
      className={`insights-panel overflow-hidden rounded-[1.1rem] border border-primary/10 bg-card/90 shadow-[0_14px_34px_rgba(24,48,37,0.07)] sm:rounded-[1.35rem] ${className}`}
    >
      {children}
    </EchoMotionSurface>
  );
}

function PanelHeading({
  icon: Icon,
  eyebrow,
  title,
  aside,
}: {
  icon: typeof Brain;
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-secondary text-primary sm:h-8 sm:w-8">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/75">{eyebrow}</p>
          <h2 className="mt-0.5 text-sm font-bold text-foreground">{title}</h2>
        </div>
      </div>
      {aside}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  delay,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
  detail: string;
  delay: number;
}) {
  return (
    <Panel delay={delay} className="p-3 sm:p-3.5">
      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-primary sm:h-9 sm:w-9">
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase leading-3 tracking-[0.1em] text-muted-foreground sm:tracking-[0.13em]">
            {label}
          </p>
          <p className="text-[1.25rem] font-semibold leading-5 text-foreground [font-family:var(--font-echo-display)]">
            {value}
          </p>
          <p className="mt-0.5 text-[10px] leading-[1.3] text-muted-foreground">{detail}</p>
        </div>
      </div>
    </Panel>
  );
}

function EmotionDonut({ result }: { result: JournalAnalysisResult }) {
  const output = result.combinedEmotionAnalysis ?? {
    emotionDistribution: result.emotionDistribution,
    dominantEmotion: result.dominantEmotion,
    confidence:
      result.schemaVersion === "echo-journal-analysis-v1"
        ? result.emotionConfidence
        : Math.max(...result.emotionDistribution.map((item) => item.value)),
  };
  const gradient = useMemo(() => {
    let cursor = 0;
    return `conic-gradient(${output.emotionDistribution
      .map((item) => {
        const start = cursor;
        cursor += item.value * 100;
        return `${emotionColors[item.emotion] ?? "#829f92"} ${start}% ${cursor}%`;
      })
      .join(", ")})`;
  }, [output.emotionDistribution]);

  return (
    <div className="insights-emotion-donut grid min-h-0 grid-cols-[104px_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <div className="insights-donut-ring relative mx-auto h-24 w-24 sm:h-32 sm:w-32">
        <div
          key={gradient}
          className="echo-chart-wheel-reveal h-full w-full rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label="Emotion distribution chart"
        />
        <div className="insights-donut-core absolute inset-[22%] grid place-items-center rounded-full border border-primary/10 bg-card text-center shadow-inner">
          <div>
            <p className="text-[7px] font-bold uppercase leading-[1.1] tracking-[0.09em] text-muted-foreground sm:text-[8px]">
              Most present
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-foreground sm:text-sm">
              {titleCase(output.dominantEmotion)}
            </p>
            <p className="text-[8px] leading-tight text-muted-foreground sm:text-[9px]">
              {Math.round(output.confidence * 100)}%{" "}
              {result.schemaVersion === "echo-journal-analysis-v1" ? "confidence" : "model score"}
            </p>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-1.5">
        {output.emotionDistribution.map((item, index) => (
          <div
            key={item.emotion}
            className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_30px] items-center gap-1.5 text-[10px] sm:grid-cols-[64px_minmax(0,1fr)_34px] sm:gap-2"
          >
            <span className="truncate capitalize text-muted-foreground">{item.emotion}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <span
                className="echo-insights-bar block h-full origin-left rounded-full"
                style={{
                  width: `${item.value * 100}%`,
                  background: emotionColors[item.emotion],
                  animationDelay: `${260 + index * 45}ms`,
                }}
              />
            </span>
            <span className="text-right font-bold tabular-nums text-foreground">{Math.round(item.value * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ insights }: { insights: DashboardInsights }) {
  const realPoints = insights.emotionTrend
    .filter((point) => !point.isSimulated && Object.keys(point.values).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const identity = realPoints.at(-1)?.modelIdentity ?? realPoints.at(-1)?.schemaVersion;
  const points = realPoints
    .filter((point) => (point.modelIdentity ?? point.schemaVersion) === identity)
    .map((point) => ({ date: point.date, value: Math.max(0, ...Object.values(point.values)) * 100 }));
  const width = 500;
  const height = 112;
  const pad = 14;
  const coords = points.map((point) => ({
    x:
      points.length === 1
        ? width / 2
        : pad +
          ((Date.parse(point.date) - Date.parse(points[0].date)) /
            Math.max(1, Date.parse(points.at(-1)!.date) - Date.parse(points[0].date))) *
            (width - pad * 2),
    y: height - pad - (point.value / 100) * (height - pad * 2),
    ...point,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area =
    coords.length > 1
      ? `M${coords[0].x},${height - pad} L${line.replaceAll(" ", " L")} L${coords.at(-1)?.x},${height - pad} Z`
      : "";

  if (points.length === 0) return <EmptyCopy text="No dated analysis results are available in this period." />;
  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="echo-chart-line-reveal h-16 w-full sm:h-[112px]"
        role="img"
        aria-label="Dominant emotion signal strength over time"
      >
        {[25, 50, 75].map((value) => (
          <line
            key={value}
            x1={pad}
            x2={width - pad}
            y1={height - pad - value * 0.84}
            y2={height - pad - value * 0.84}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}
        {area ? <path d={area} fill="rgba(111,173,138,0.14)" /> : null}
        {coords.length > 1 ? (
          <polyline
            pathLength={1}
            className="insights-trend-path"
            points={line}
            fill="none"
            stroke="#536733"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {coords.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="#fbf7ee" stroke="#536733" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] font-semibold uppercase text-muted-foreground">
        <span>{shortDate(points[0].date)}</span>
        <span>{points.length > 1 ? shortDate(points.at(-1)!.date) : "One analysis day"}</span>
      </div>
    </div>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-primary/15 bg-secondary/25 px-4 text-center text-xs leading-5 text-muted-foreground">
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading AI insights" className="grid gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-[1.35rem] bg-card/75 motion-reduce:animate-none ${index > 3 ? "h-56" : "h-20"}`}
        />
      ))}
    </div>
  );
}

function EmptyState({ retry }: { retry: () => void }) {
  return (
    <div className="grid min-h-[430px] place-items-center rounded-[1.5rem] border border-primary/10 bg-card/85 p-8 text-center shadow-card">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
          <Brain className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-3xl font-semibold text-foreground [font-family:var(--font-echo-display)]">
          No completed analysis yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Choose optional analysis when saving a reflection. ECHO will show only completed, consented outputs and will
          not invent missing model results.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-primary/15 bg-background px-4 text-sm font-semibold text-primary"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>
    </div>
  );
}

export function EmotionInsightsView({ preview = false }: { preview?: boolean }) {
  const vm = useInsightsViewModel(preview);
  const [detail, setDetail] = useState<"history" | "report" | null>(null);
  const customMenu = useRef<HTMLDetailsElement>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const insights = preview ? vm.overview : realAnalysisInsights(vm.overview);
  const latest = insights?.latest ?? null;
  const native =
    insights?.latest?.schemaVersion === "echo-journal-analysis-v2" ||
    insights?.latest?.schemaVersion === "echo-journal-analysis-v3"
      ? insights.latest
      : null;
  const period = insights?.period;
  const distressStart = insights?.distressTrend[0]?.value;
  const distressEnd = insights?.distressTrend.at(-1)?.value;
  const direction =
    (insights?.distressTrend.length ?? 0) < 2 || distressStart === undefined || distressEnd === undefined
      ? "Not enough data"
      : distressStart === distressEnd
        ? "Unchanged"
        : distressEnd < distressStart
          ? "Easing"
          : "Rising";
  const DirectionIcon = direction === "Easing" ? TrendingDown : direction === "Rising" ? TrendingUp : Minus;

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
              aria-label="Your emotional patterns"
              className="mt-1 text-[clamp(1.9rem,3vw,3.2rem)] font-medium leading-[0.95] text-foreground [font-family:var(--font-echo-display)]"
            >
              {["Your", "emotional", "patterns"].map((word, index) => (
                <span className="insights-word-mask" key={word}>
                  <span style={{ animationDelay: `${120 + index * 110}ms` }}>{word} </span>
                </span>
              ))}
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
              A private view of optional journal analysis. Model outputs support reflection and are not diagnosis,
              emergency monitoring, or clinical decisions.
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
        <AiSupportNotice className="relative ml-auto mt-3 max-w-xl" />
      </header>
  );
  const dashboard = (
    <div
      aria-busy={vm.isLoading}
      className="echo-insights-dashboard insights-premium mx-auto max-w-[1600px] space-y-4 pb-5"
    >
      {hero}

      <AnalysisRequestStatus insights={insights} />
      {native?.supportReviewRequired && (
        <p role="status" className="rounded-2xl border border-primary/20 bg-secondary p-4 text-sm">
          This saved reflection included a support flag.{" "}
          <Link href="/crisis-help" className="font-semibold underline">
            Open support options
          </Link>
        </p>
      )}
      {vm.isLoading && insights ? (
        <p role="status" className="text-sm text-muted-foreground">
          Updating saved analysis…
        </p>
      ) : null}
      {vm.error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-danger/20 bg-crisis-soft px-4 py-3 text-sm text-foreground"
        >
          <span>{vm.error}</span>
          <button type="button" onClick={vm.retry} className="font-bold text-primary">
            Retry
          </button>
        </div>
      ) : null}
      {vm.error && !insights ? null : vm.isLoading && !insights ? (
        <LoadingState />
      ) : !insights || (!latest && !native) ? (
        <EmptyState retry={vm.retry} />
      ) : latest?.schemaVersion === "echo-model-pipeline-v2" ? (
        <ModelPipelinePanel result={latest} />
      ) : latest ? (
        <>
          <section className="insights-metrics grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Analysis summary">
            <Metric
              icon={HeartPulse}
              label="Dominant emotion"
              value={titleCase((latest.combinedEmotionAnalysis ?? latest).dominantEmotion)}
              detail="Most present model signal"
              delay={60}
            />
            <Metric
              icon={Activity}
              label={native ? "Top emotion score" : "Text confidence"}
              value={`${Math.round((native ? Math.max(...native.emotionDistribution.map((item) => item.value)) : latest.emotionConfidence) * 100)}%`}
              detail={native ? "Relative model score, not confidence" : "Latest completed text analysis"}
              delay={110}
            />
            <Metric
              icon={FileText}
              label="Reflection count"
              value={period ? String(period.analyzedReflectionCount) : "Unavailable"}
              detail="Completed analyses in this period"
              delay={160}
            />
            <Metric
              icon={DirectionIcon}
              label={native ? "Analysis coverage" : "Distress direction"}
              value={
                native
                  ? native.schemaVersion === "echo-journal-analysis-v3" &&
                    (native.journalScreening.status !== "available" || native.journalScreening.coverage !== 8)
                    ? "Partial"
                    : "Complete"
                  : direction
              }
              detail={native ? "Available outputs in the latest result" : "Compared across this period"}
              delay={210}
            />
          </section>

          <section
            className="insights-outcomes grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12"
            aria-label="AI analysis outcomes"
          >
            <Panel id="emotion-analysis" delay={260} className="md:col-span-2 p-5 xl:col-span-7">
              <PanelHeading
                icon={Brain}
                eyebrow="Emotion analysis"
                title={native ? "Text emotion patterns" : "Textual and facial signals"}
                aside={
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-bold text-primary">
                    {latest.combinedEmotionAnalysis ? "Multimodal" : "Text model"}
                  </span>
                }
              />
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <EmotionDonut result={latest} />
                <div className="border-t border-border/70 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Dominant signal strength
                  </p>
                  <TrendChart insights={insights} />
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold">
                    <span className="rounded-full bg-secondary px-2 py-1 text-primary">Text output ready</span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">
                      {facialStatusCopy[insights.facialStatus ?? "not_requested"]}
                    </span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel id="sanctuary-perspective" delay={310} className="relative md:col-span-2 p-5 xl:col-span-5">
              <PanelHeading
                icon={Sparkles}
                eyebrow="Sanctuary perspective"
                title="A kinder view of the whole pattern"
                aside={
                  latest.sanctuaryPerspective ? (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-bold text-primary">
                      AI perspective
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-bold text-muted-foreground">
                      {native ? "Not available" : "Provider pending"}
                    </span>
                  )
                }
              />
              {latest.sanctuaryPerspective ? (
                <div className="mt-4 flex gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                    <Leaf className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground [font-family:var(--font-echo-display)]">
                      {latest.sanctuaryPerspective.headline}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {latest.sanctuaryPerspective.narrative}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-primary/20 bg-secondary/25 p-4">
                  <p className="text-sm font-bold text-foreground">
                    {native ? "No saved AI perspective for this result" : "Perspective model is not connected yet"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A written AI perspective is not available in this saved result. Your model scores and suggested next
                    step remain available below.
                  </p>
                </div>
              )}
              {insights.recommendation ? (
                <div className="mt-3 border-t border-border/70 pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Reviewed next step</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{insights.recommendation.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{insights.recommendation.description}</p>
                </div>
              ) : null}
            </Panel>

            <Panel id="depression-severity" delay={360} className="p-5 xl:col-span-4">
              <PanelHeading icon={FileText} eyebrow="PHQ-8 model estimate" title="Journal-derived symptom estimate" />
              <ScreeningSummary result={latest} />
            </Panel>
            <Panel id="distress-classification" delay={410} className="p-5 xl:col-span-4">
              <PanelHeading
                icon={Activity}
                eyebrow={native ? "Journal classification" : "Distress classification"}
                title={native ? "Saved journal category" : "Current support signal"}
              />
              {native ? (
                <>
                  <p className="insights-main-value mt-5">{native.distressCategory}</p>
                  <dl className="mt-4 space-y-2">
                    {Object.entries(native.categoryScores).map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[80px_1fr_34px] items-center gap-2 text-[11px]">
                        <dt>{label}</dt>
                        <dd className="insights-score-track">
                          <span style={{ width: `${value * 100}%` }} />
                        </dd>
                        <dd className="text-right tabular-nums">{Math.round(value * 100)}%</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    Dataset categories are not clinical severity or a current safety assessment.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="insights-main-value capitalize">{latest.distressBand}</p>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                      {latest.distressConfidence === null
                        ? "Unavailable"
                        : `${Math.round(latest.distressConfidence * 100)}% confidence`}
                    </span>
                  </div>
                  <div className="mt-5 flex h-2 gap-1" aria-label={`Distress band: ${latest.distressBand}`}>
                    {["low", "mild", "moderate", "high", "severe"].map((band) => (
                      <span
                        key={band}
                        className={`flex-1 rounded-full ${band === latest.distressBand ? "bg-primary" : "bg-secondary"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    Used to guide supportive wording. It does not predict harm or replace professional assessment.
                  </p>
                </>
              )}
            </Panel>
            <Panel id="facial-analysis" delay={460} className="md:col-span-2 p-5 xl:col-span-4">
              <FacialSummary
                insights={insights}
                legacy={latest.schemaVersion === "echo-journal-analysis-v1" ? latest : null}
              />
            </Panel>
          </section>
        </>
      ) : null}
      {insights && (
        <div className="insights-report-actions flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-card/65 px-5 py-3">
          <p className="text-xs text-muted-foreground">Explore the dates and details behind these signals.</p>
          <div className="flex gap-3">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setDetail("history")}
              className="echo-button-secondary"
            >
              View analysis history
            </button>
            {native && (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setDetail("report")}
                className="echo-button-secondary"
              >
                Full model report
              </button>
            )}
          </div>
        </div>
      )}
      <EchoDialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail === "history" ? "Saved analysis history" : "Full model report"}
        description="Dated model outputs from the selected analysis period."
        size="large"
        className="dashboard-detail-dialog insights-detail-dialog"
      >
        {detail === "history" && insights ? (
          <AnalysisHistory insights={insights} />
        ) : native ? (
          <NativeAnalysis result={native} insights={insights ?? undefined} showHistory={false} />
        ) : null}
      </EchoDialog>
      <p className="flex items-center gap-2 px-1 text-[10px] leading-4 text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Private analysis is loaded only for your authenticated account. Only saved, non-simulated model results are
        shown in your account.
      </p>
    </div>
  );
  return preview ? dashboard : <VerifiedFeatureGate featureName="AI insights" loadingFallback={<div aria-busy="true" className="echo-insights-dashboard insights-premium mx-auto max-w-[1600px] space-y-4 pb-5">{hero}<LoadingState /></div>}>{dashboard}</VerifiedFeatureGate>;
}

function ScreeningSummary({ result }: { result: JournalAnalysisResult }) {
  const [open, setOpen] = useState(false);
  if (result.schemaVersion === "echo-journal-analysis-v1")
    return (
      <>
        <p className="insights-main-value mt-6">
          {result.depressiveSymptomRange.lower}–{result.depressiveSymptomRange.upper}
          <span className="ml-2 text-sm text-muted-foreground">of 24</span>
        </p>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          A model-estimated range from reflection text. This is not a completed PHQ-8 assessment or diagnosis.
        </p>
      </>
    );
  const screening = result.schemaVersion === "echo-journal-analysis-v3" ? result.journalScreening : null;
  const available = screening?.status === "available";
  return (
    <>
      <p className="insights-main-value mt-5">
        {available
          ? screening.coverage === 8
            ? screening.total
            : screening.coverage
              ? screening.subtotal
              : "Unscored"
          : "Unavailable"}
        {available && screening.coverage === 8 && <span className="ml-2 text-sm text-muted-foreground">/ 24</span>}
      </p>
      <p className="mt-2 text-sm font-semibold">
        {available
          ? screening.coverage === 8
            ? "Complete model estimate"
            : screening.coverage === 0
              ? "No criteria evidenced in this entry"
              : `Partial subtotal · ${screening.coverage}/8 criteria evidenced`
          : "No saved journal PHQ-8 estimate"}
      </p>
      <div
        className="mt-4 grid grid-cols-8 gap-1.5"
        aria-label={available ? `${screening.coverage} of 8 criteria evidenced` : "No estimate available"}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full ${available && i < screening.coverage ? "bg-primary" : "bg-secondary"}`}
          />
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Missing evidence stays unscored. Partial subtotals are not complete totals. Experimental estimate, separate from
        questionnaire scores.
      </p>
      {available && (
        <button
          type="button"
          className="mt-3 min-h-10 text-xs font-semibold text-primary underline underline-offset-4"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          View criteria
        </button>
      )}
      <EchoDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Journal PHQ-8 criteria"
        description="Experimental frequency estimates from this saved reflection."
        size="large"
        className="dashboard-detail-dialog insights-detail-dialog"
      >
        <dl className="grid grid-cols-2 gap-3">
          {screening?.items &&
            Object.entries(screening.items).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-border p-4">
                <dt className="text-xs capitalize text-muted-foreground">{key.replaceAll("_", " ")}</dt>
                <dd className="mt-2 font-semibold">{value === null ? "Not evidenced" : value}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          0 = not at all; 1 = several days; 2 = more than half the days; 3 = nearly every day. Only eight evidenced
          criteria produce a total. This is not a diagnosis or completed questionnaire.
        </p>
      </EchoDialog>
    </>
  );
}

function FacialSummary({
  insights,
  legacy,
}: {
  insights: DashboardInsights;
  legacy: Extract<JournalAnalysisResult, { schemaVersion: "echo-journal-analysis-v1" }> | null;
}) {
  const saved = [...(insights.facialResults ?? [])].sort(
    (a, b) => Date.parse(b.result.generatedAt ?? "") - Date.parse(a.result.generatedAt ?? ""),
  )[0];
  const face = saved?.result.status === "available" ? saved.result : null;
  const fallback = legacy?.facialExpressionAnalysis;
  const scores = face
    ? Object.entries(face.classProbabilities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : fallback?.emotionDistribution.map((item) => [item.emotion, item.value] as const).slice(0, 4);
  return (
    <>
      <PanelHeading
        icon={ScanFace}
        eyebrow="Facial expression analysis"
        title={
          face
            ? `${titleCase(face.prediction)} expression`
            : fallback
              ? `${titleCase(fallback.detectedEmotion)} signal`
              : "Model output unavailable"
        }
      />
      {scores?.length ? (
        <>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {face ? "Latest saved facial result, separate from the text analysis." : "Saved facial expression signals."}
          </p>
          <dl className="mt-4 space-y-3">
            {scores.map(([name, value]) => (
              <div key={name} className="grid grid-cols-[76px_1fr_34px] items-center gap-2 text-[11px]">
                <dt className="capitalize">{name}</dt>
                <dd className="insights-score-track">
                  <span style={{ width: `${value * 100}%` }} />
                </dd>
                <dd className="text-right tabular-nums">{Math.round(value * 100)}%</dd>
              </div>
            ))}
          </dl>
          {saved && (
            <Link
              className="mt-4 inline-block min-h-9 text-xs font-semibold text-primary underline"
              href={`/journal/${saved.journalId}`}
            >
              View saved reflection
            </Link>
          )}
          {face && (
            <time className="block text-[10px] text-muted-foreground" dateTime={face.generatedAt}>
              {new Date(face.generatedAt).toLocaleString()}
            </time>
          )}
        </>
      ) : (
        <div className="mt-4">
          <EmptyCopy
            text={
              saved?.result.status === "unavailable"
                ? "No usable face result was saved for this capture."
                : facialStatusCopy[insights.facialStatus ?? "not_requested"]
            }
          />
        </div>
      )}
      <p className="mt-4 flex gap-2 text-[10px] leading-5 text-muted-foreground">
        <LockKeyhole className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />
        Expression scores are uncalibrated model outputs. They do not establish how you feel. No face preview is shown.
      </p>
    </>
  );
}
