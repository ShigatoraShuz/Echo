"use client";
import { NativeAnalysis } from "@/features/journal/components/native-analysis";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import type { DashboardInsights, JournalAnalysisResult } from "@echo/contracts";
import { VerifiedFeatureGate } from "@/features/verification";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";

const emotionColors: Record<string, string> = {
  joy: "#e6b955",
  calm: "#6fad8a",
  sadness: "#7181a7",
  anxiety: "#8e79ad",
  anger: "#c06f68",
  hope: "#9ba947",
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
      className={`overflow-hidden rounded-[1.1rem] border border-primary/10 bg-card/90 shadow-[0_14px_34px_rgba(24,48,37,0.07)] sm:rounded-[1.35rem] ${className}`}
    >
      {children}
    </EchoMotionSurface>
  );
}

function PanelHeading({ icon: Icon, eyebrow, title, aside }: {
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

function Metric({ icon: Icon, label, value, detail, delay }: {
  icon: typeof Brain;
  label: string;
  value: string;
  detail: string;
  delay: number;
}) {
  return (
    <Panel delay={delay} className="p-3 sm:p-3.5">
      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eaf2e6] text-primary sm:h-9 sm:w-9">
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase leading-3 tracking-[0.1em] text-muted-foreground sm:tracking-[0.13em]">{label}</p>
          <p className="text-[1.25rem] font-semibold leading-5 text-foreground [font-family:var(--font-echo-display)]">{value}</p>
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
    confidence: result.emotionConfidence,
  };
  const gradient = useMemo(() => {
    let cursor = 0;
    return `conic-gradient(${output.emotionDistribution.map((item) => {
      const start = cursor;
      cursor += item.value * 100;
      return `${emotionColors[item.emotion]} ${start}% ${cursor}%`;
    }).join(", ")})`;
  }, [output.emotionDistribution]);

  return (
    <div className="grid min-h-0 grid-cols-[104px_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <div className="relative mx-auto h-24 w-24 sm:h-32 sm:w-32">
        <div key={gradient} className="echo-chart-wheel-reveal h-full w-full rounded-full" style={{ background: gradient }} role="img" aria-label="Emotion distribution chart" />
        <div className="absolute inset-[22%] grid place-items-center rounded-full border border-primary/10 bg-card text-center shadow-inner">
          <div>
            <p className="text-[7px] font-bold uppercase leading-[1.1] tracking-[0.09em] text-muted-foreground sm:text-[8px]">Most present</p>
            <p className="mt-0.5 text-[13px] font-bold text-foreground sm:text-sm">{titleCase(output.dominantEmotion)}</p>
            <p className="text-[8px] leading-tight text-muted-foreground sm:text-[9px]">{Math.round(output.confidence * 100)}% confidence</p>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-1.5">
        {output.emotionDistribution.map((item, index) => (
          <div key={item.emotion} className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_30px] items-center gap-1.5 text-[10px] sm:grid-cols-[64px_minmax(0,1fr)_34px] sm:gap-2">
            <span className="truncate capitalize text-muted-foreground">{item.emotion}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <span
                className="echo-insights-bar block h-full origin-left rounded-full"
                style={{ width: `${item.value * 100}%`, background: emotionColors[item.emotion], animationDelay: `${260 + index * 45}ms` }}
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
  const points = insights.emotionTrend.map((point) => ({
    date: point.date,
    value: Math.max(0, ...Object.values(point.values)) * 100,
  }));
  const width = 500;
  const height = 112;
  const pad = 14;
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2),
    y: height - pad - (point.value / 100) * (height - pad * 2),
    ...point,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = coords.length > 1 ? `M${coords[0].x},${height - pad} L${line.replaceAll(" ", " L")} L${coords.at(-1)?.x},${height - pad} Z` : "";

  if (points.length === 0) return <EmptyCopy text="No dated analysis results are available in this period." />;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="echo-chart-line-reveal h-16 w-full sm:h-[112px]" role="img" aria-label="Dominant emotion signal strength over time">
        {[25, 50, 75].map((value) => <line key={value} x1={pad} x2={width - pad} y1={height - pad - value * 0.84} y2={height - pad - value * 0.84} stroke="hsl(var(--border))" strokeWidth="1" />)}
        {area ? <path d={area} fill="rgba(111,173,138,0.14)" /> : null}
        {coords.length > 1 ? <polyline points={line} fill="none" stroke="#536733" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {coords.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="#fbf7ee" stroke="#536733" strokeWidth="2" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] font-semibold uppercase text-muted-foreground">
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points.at(-1)?.date ?? points[0].date)}</span>
      </div>
    </div>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-primary/15 bg-secondary/25 px-4 text-center text-xs leading-5 text-muted-foreground">{text}</div>;
}

function LoadingState() {
  return (
    <div aria-label="Loading AI insights" className="grid gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => <div key={index} className={`animate-pulse rounded-[1.35rem] bg-card/75 motion-reduce:animate-none ${index > 3 ? "h-56" : "h-20"}`} />)}
    </div>
  );
}

function EmptyState({ retry }: { retry: () => void }) {
  return (
    <div className="grid min-h-[430px] place-items-center rounded-[1.5rem] border border-primary/10 bg-card/85 p-8 text-center shadow-card">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary"><Brain className="h-6 w-6" aria-hidden="true" /></span>
        <h2 className="mt-5 text-3xl font-semibold text-foreground [font-family:var(--font-echo-display)]">No completed analysis yet</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose optional analysis when saving a reflection. ECHO will show only completed, consented outputs and will not invent missing model results.</p>
        <button type="button" onClick={retry} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-primary/15 bg-background px-4 text-sm font-semibold text-primary"><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</button>
      </div>
    </div>
  );
}

export function EmotionInsightsView({ preview = false, previewWhenEmpty = false }: { preview?: boolean; previewWhenEmpty?: boolean }) {
  const vm = useInsightsViewModel(preview);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const insights = vm.overview;
  const latest = insights?.latest?.schemaVersion === "echo-journal-analysis-v1" ? insights.latest : null;
  const native = insights?.latest && insights.latest.schemaVersion !== "echo-journal-analysis-v1" ? insights.latest : null;
  const period = insights?.period;
  const distressStart = insights?.distressTrend[0]?.value;
  const distressEnd = insights?.distressTrend.at(-1)?.value;
  const direction = distressStart === undefined || distressEnd === undefined || distressStart === distressEnd
    ? "Steady"
    : distressEnd < distressStart ? "Easing" : "Rising";
  const DirectionIcon = direction === "Easing" ? TrendingDown : direction === "Rising" ? TrendingUp : Minus;

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customFrom || !customTo || customFrom > customTo) {
      setCustomError("Choose a valid start and end date.");
      return;
    }
    setCustomError(null);
    vm.applyCustomRange(customFrom, customTo);
  }

  if (previewWhenEmpty && process.env.NODE_ENV === "development" && !vm.isLoading && !vm.error && !latest) {
    return <VerifiedFeatureGate featureName="AI insights"><EmotionInsightsView preview /></VerifiedFeatureGate>;
  }

  if (native) return <VerifiedFeatureGate featureName="AI insights"><NativeAnalysis result={native} insights={insights ?? undefined} /></VerifiedFeatureGate>;
  const dashboard = (
    <div className="echo-insights-dashboard mx-auto max-w-[1440px] space-y-2.5 pb-4 sm:space-y-3">
        <header className="relative overflow-visible rounded-[1.35rem] border border-primary/10 bg-[rgba(251,247,238,0.88)] px-4 py-4 shadow-[0_14px_34px_rgba(24,48,37,0.06)] sm:rounded-[1.5rem] sm:px-5">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] overflow-hidden lg:w-[44%]" aria-hidden="true">
            <Leaf className="absolute right-9 top-4 h-14 w-14 rotate-12 text-[#b9d1ac]/55 lg:right-16 lg:h-20 lg:w-20" strokeWidth={1} />
            <Leaf className="absolute right-0 top-11 h-20 w-20 -rotate-12 text-[#d9c981]/25 lg:right-2 lg:top-10 lg:h-28 lg:w-28" strokeWidth={0.8} />
          </div>
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[16.5rem] sm:max-w-2xl">
              <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-primary"><Leaf className="h-3.5 w-3.5" aria-hidden="true" />Reflective insights</p>
              <h1 className="mt-1 text-[clamp(1.9rem,3vw,3.2rem)] font-medium leading-[0.95] text-foreground [font-family:var(--font-echo-display)]">Your emotional patterns</h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">A private view of optional journal analysis. Model outputs support reflection and are not diagnosis, emergency monitoring, or clinical decisions.</p>
              {preview ? <p className="mt-2 text-xs font-semibold text-primary">Preview mode — simulated examples, not your results.</p> : null}
            </div>
            <div className="relative z-10 grid w-full grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
              <div className="grid min-w-0 grid-cols-3 rounded-full border border-primary/10 bg-background p-1 shadow-subtle" role="group" aria-label="Analysis period">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button key={range} type="button" onClick={() => vm.setTimeRange(range)} aria-pressed={vm.timeRange === range} className={`h-10 rounded-full px-1 text-[11px] font-bold transition-colors sm:px-3 ${vm.timeRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}</button>
                ))}
              </div>
              <details className="group relative min-w-0">
                <summary className={`inline-flex h-12 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-bold shadow-subtle sm:gap-2 sm:px-3 ${vm.timeRange === "custom" ? "border-primary bg-secondary text-primary" : "border-primary/10 bg-background text-muted-foreground"}`}><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Custom</summary>
                <form onSubmit={applyCustom} className="absolute right-0 top-14 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-primary/10 bg-card p-4 shadow-2xl sm:w-72">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0 text-[10px] font-bold text-muted-foreground">From<input required type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-1 text-xs text-foreground sm:px-2" /></label>
                    <label className="min-w-0 text-[10px] font-bold text-muted-foreground">To<input required type="date" min={customFrom || undefined} value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-border bg-background px-1 text-xs text-foreground sm:px-2" /></label>
                  </div>
                  {customError ? <p role="alert" className="mt-2 text-[10px] text-danger">{customError}</p> : null}
                  <button type="submit" className="mt-3 h-11 w-full rounded-full bg-primary text-xs font-bold text-primary-foreground">Apply range</button>
                </form>
              </details>
            </div>
          </div>
        </header>

        {vm.error ? <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger/20 bg-crisis-soft px-4 py-3 text-sm text-foreground"><span>{vm.error}</span><button type="button" onClick={vm.retry} className="font-bold text-primary">Retry</button></div> : null}
        {vm.isLoading && !insights ? <LoadingState /> : !latest || !insights ? <EmptyState retry={vm.retry} /> : (
          <>
            <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4" aria-label="Analysis summary">
              <Metric icon={HeartPulse} label="Dominant emotion" value={titleCase((latest.combinedEmotionAnalysis ?? latest).dominantEmotion)} detail="Most present model signal" delay={60} />
              <Metric icon={Activity} label="Text confidence" value={`${Math.round(latest.emotionConfidence * 100)}%`} detail="Latest completed text analysis" delay={110} />
              <Metric icon={FileText} label="Reflection count" value={`${period?.analyzedReflectionCount ?? insights.emotionTrend.length}`} detail="Completed analyses in this period" delay={160} />
              <Metric icon={DirectionIcon} label="Distress direction" value={direction} detail="Compared across this period" delay={210} />
            </section>

            <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-12" aria-label="AI analysis outcomes">
              <Panel id="emotion-analysis" delay={260} className="col-span-2 p-3.5 sm:p-4 xl:col-span-7">
                <PanelHeading icon={Brain} eyebrow="Emotion analysis" title="Textual and facial signals" aside={<span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-bold text-primary">{latest.combinedEmotionAnalysis ? "Multimodal" : "Text model"}</span>} />
                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <EmotionDonut result={latest} />
                  <div className="border-t border-border/70 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Dominant signal strength</p>
                    <TrendChart insights={insights} />
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold">
                      <span className="rounded-full bg-[#eaf2e6] px-2 py-1 text-primary">Text output ready</span>
                      <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{facialStatusCopy[insights.facialStatus ?? "not_requested"]}</span>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel id="sanctuary-perspective" delay={310} className="relative col-span-2 p-3.5 sm:p-4 xl:col-span-5">
                <PanelHeading icon={Sparkles} eyebrow="Sanctuary perspective" title="A kinder view of the whole pattern" aside={latest.sanctuaryPerspective ? <span className="rounded-full bg-[#eaf2e6] px-2.5 py-1 text-[9px] font-bold text-primary">AI perspective</span> : <span className="rounded-full bg-secondary px-2.5 py-1 text-[9px] font-bold text-muted-foreground">Provider pending</span>} />
                {latest.sanctuaryPerspective ? (
                  <div className="mt-4 flex gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#e8f0df] text-primary"><Leaf className="h-7 w-7" aria-hidden="true" /></span>
                    <div><h3 className="text-xl font-semibold text-foreground [font-family:var(--font-echo-display)]">{latest.sanctuaryPerspective.headline}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{latest.sanctuaryPerspective.narrative}</p></div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-primary/20 bg-secondary/25 p-4">
                    <p className="text-sm font-bold text-foreground">Perspective model is not connected yet</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">This space is ready for the validated LLM output. ECHO will not turn scores into an invented narrative while that provider is unfinished.</p>
                  </div>
                )}
                {insights.recommendation ? <div className="mt-3 border-t border-border/70 pt-3"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">Reviewed next step</p><p className="mt-1 text-sm font-bold text-foreground">{insights.recommendation.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{insights.recommendation.description}</p></div> : null}
              </Panel>

              <Panel id="depression-severity" delay={360} className="p-3.5 max-[359px]:col-span-2 sm:p-4 xl:col-span-4">
                <PanelHeading icon={FileText} eyebrow="Depression severity" title="Journal-derived symptom estimate" />
                <div className="mt-3 flex flex-wrap items-end gap-1 sm:mt-4 sm:gap-2"><span className="text-4xl font-medium tabular-nums text-foreground [font-family:var(--font-echo-display)] sm:text-5xl">{latest.depressiveSymptomRange.lower}–{latest.depressiveSymptomRange.upper}</span><span className="pb-1 text-xs text-muted-foreground">of 24</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><span className="echo-insights-bar block h-full rounded-full bg-[#7fa06b]" style={{ width: `${(latest.depressiveSymptomRange.upper / 24) * 100}%`, animationDelay: "430ms" }} /></div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">A model-estimated range from reflection text. It is not a completed PHQ-8 assessment or a diagnosis.</p>
              </Panel>

              <Panel id="distress-classification" delay={410} className="p-3.5 max-[359px]:col-span-2 sm:p-4 xl:col-span-4">
                <PanelHeading icon={Activity} eyebrow="Distress classification" title="Current support signal" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1 sm:mt-4 sm:gap-4"><p className="text-3xl font-medium capitalize text-foreground [font-family:var(--font-echo-display)] sm:text-4xl">{latest.distressBand}</p><span className="rounded-full bg-[#eaf2e6] px-2 py-1 text-[9px] font-bold text-primary sm:px-3 sm:py-1.5 sm:text-[10px]">{Math.round(latest.distressConfidence * 100)}% confidence</span></div>
                <div className="mt-4 flex h-2 gap-1" aria-label={`Distress band: ${latest.distressBand}`}>{["low", "mild", "moderate", "high", "severe"].map((band) => <span key={band} className={`flex-1 rounded-full ${band === latest.distressBand ? "bg-primary" : "bg-secondary"}`} />)}</div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Used to guide supportive wording. It does not predict harm or replace professional assessment.</p>
              </Panel>

              <Panel id="facial-analysis" delay={460} className="col-span-2 p-3.5 sm:p-4 xl:col-span-4">
                <PanelHeading icon={ScanFace} eyebrow="Facial expression analysis" title={latest.facialExpressionAnalysis ? `${titleCase(latest.facialExpressionAnalysis.detectedEmotion)} signal` : "Model output unavailable"} />
                {latest.facialExpressionAnalysis ? <div className="mt-4 space-y-2">{latest.facialExpressionAnalysis.emotionDistribution.slice(0, 4).map((item, index) => <div key={item.emotion} className="grid grid-cols-[72px_1fr_34px] items-center gap-2 text-[10px]"><span className="truncate capitalize text-muted-foreground">{item.emotion}</span><span className="h-1.5 rounded-full bg-secondary"><span className="echo-insights-bar block h-full rounded-full bg-primary" style={{ width: `${item.value * 100}%`, animationDelay: `${500 + index * 45}ms` }} /></span><span className="text-right font-bold tabular-nums">{Math.round(item.value * 100)}%</span></div>)}</div> : <EmptyCopy text={facialStatusCopy[insights.facialStatus ?? "not_requested"]} />}
                <p className="mt-3 flex items-center gap-2 text-[10px] leading-4 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />Only an explicitly consented facial mesh is processed; no photo or video is stored with the reflection.</p>
              </Panel>
            </section>
          </>
        )}
        <p className="flex items-center gap-2 px-1 text-[10px] leading-4 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Private analysis is loaded only for your authenticated account. Simulated outputs remain labelled and are excluded in production.</p>
    </div>
  );
  return preview ? dashboard : <VerifiedFeatureGate featureName="AI insights">{dashboard}</VerifiedFeatureGate>;
}
