"use client";

import {
  Activity,
  Bot,
  Brain,
  Check,
  ClipboardList,
  HeartHandshake,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { JournalAnalysis } from "../model/journal.model";

interface JournalAnalysisPanelProps {
  analysis: JournalAnalysis | null;
  isLoading?: boolean;
}

const recommendationLabels: Record<string, string> = {
  paced_breathing: "Paced breathing",
  grounding: "Grounding exercise",
  behavioral_activation: "One supportive action",
  thought_reframing: "Gentle thought reframing",
  support_connection: "Connect with support",
};

/** Map emotion names → semantic CSS color tokens */
const emotionColorMap: Record<string, string> = {
  calm: "hsl(var(--calm))",
  joy: "hsl(var(--happy))",
  hope: "hsl(var(--happy))",
  neutral: "hsl(var(--neutral))",
  sadness: "hsl(var(--sad))",
  anxiety: "hsl(var(--anxious))",
  anger: "hsl(var(--angry))",
};

const distressBandMeta: Record<
  string,
  { colorClass: string; bgClass: string; borderClass: string }
> = {
  low: {
    colorClass: "text-[hsl(var(--risk-low-foreground))]",
    bgClass: "bg-[hsl(var(--risk-low-soft))]",
    borderClass: "border-[hsl(var(--risk-low)/0.35)]",
  },
  mild: {
    colorClass: "text-[hsl(var(--risk-mild-foreground))]",
    bgClass: "bg-[hsl(var(--risk-mild-soft))]",
    borderClass: "border-[hsl(var(--risk-mild)/0.35)]",
  },
  moderate: {
    colorClass: "text-[hsl(var(--risk-moderate-foreground))]",
    bgClass: "bg-[hsl(var(--risk-moderate-soft))]",
    borderClass: "border-[hsl(var(--risk-moderate)/0.38)]",
  },
  high: {
    colorClass: "text-[hsl(var(--risk-high-foreground))]",
    bgClass: "bg-[hsl(var(--risk-high-soft))]",
    borderClass: "border-[hsl(var(--risk-high)/0.4)]",
  },
  severe: {
    colorClass: "text-[hsl(var(--risk-severe-foreground))]",
    bgClass: "bg-[hsl(var(--risk-severe-soft))]",
    borderClass: "border-[hsl(var(--risk-severe)/0.42)]",
  },
};

/* ─── Skeleton loading state ──────────────────────────────────────────────── */
function AnalysisSkeleton() {
  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-primary/10 shadow-[0_22px_65px_rgba(16,42,36,.09)]"
      style={{ background: "linear-gradient(145deg,rgba(255,253,247,.96),rgba(230,239,224,.82))" }}
      aria-busy="true"
      aria-label="Analysis loading"
    >
      <header className="border-b border-primary/10 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-primary/15" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2.5 w-28 animate-pulse rounded-full bg-primary/15" />
            <div className="h-6 w-48 animate-pulse rounded-lg bg-primary/10" />
            <div className="h-2 w-64 animate-pulse rounded-full bg-muted/60" />
          </div>
        </div>
        <div className="mt-5 h-16 animate-pulse rounded-2xl bg-card/60" />
      </header>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`animate-pulse rounded-2xl bg-card/70 p-4 ${i === 1 ? "sm:col-span-2" : ""}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-3 h-4 w-32 rounded-full bg-muted/50" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-muted/40" />
              <div className="h-3 w-3/4 rounded-full bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Animated emotion bar ────────────────────────────────────────────────── */
function EmotionBar({ emotion, value, index }: { emotion: string; value: number; index: number }) {
  const pct = Math.round(value * 100);
  const color = emotionColorMap[emotion.toLowerCase()] ?? "hsl(var(--primary))";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium capitalize text-foreground/80">{emotion}</span>
        <span className="tabular-nums text-[11px] font-semibold text-muted-foreground">{pct}%</span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full"
        style={{ background: "hsl(var(--secondary))" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${emotion}: ${pct}%`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            opacity: 0.85,
            animation: `echo-bar-grow 600ms cubic-bezier(0.23,1,0.32,1) ${index * 45}ms both`,
          }}
        />
      </div>
    </div>
  );
}

/* ─── PHQ-8 gauge ─────────────────────────────────────────────────────────── */
function Phq8Gauge({ lower, upper }: { lower: number; upper: number }) {
  const max = 24;
  const midPct = Math.round(((lower + upper) / 2 / max) * 100);
  const rangeColor =
    midPct < 25 ? "hsl(var(--risk-low))"
    : midPct < 42 ? "hsl(var(--risk-mild))"
    : midPct < 63 ? "hsl(var(--risk-moderate))"
    : "hsl(var(--risk-high))";
  return (
    <div className="mt-3 space-y-3">
      <p className="font-[family-name:var(--font-echo-display)] text-3xl font-semibold tabular-nums text-foreground">
        {lower}–{upper}
        <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">/ 24</span>
      </p>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ background: "hsl(var(--secondary))" }}
        aria-hidden="true"
      >
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${Math.round((lower / max) * 100)}%`,
            width: `${Math.round(((upper - lower) / max) * 100)}%`,
            background: rangeColor,
            opacity: 0.75,
            animation: "echo-bar-grow 700ms cubic-bezier(0.23,1,0.32,1) 160ms both",
          }}
        />
      </div>
      <p className="sr-only">AI-estimated depressive-symptom range: {lower}–{upper} out of 24.</p>
      <p className="text-[11px] leading-5 text-muted-foreground">Not a diagnosis or completed PHQ-8 assessment.</p>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export function JournalAnalysisPanel({ analysis, isLoading }: JournalAnalysisPanelProps) {
  if (isLoading) return <AnalysisSkeleton />;

  const panelBg = "linear-gradient(145deg,rgba(255,253,247,.96),rgba(230,239,224,.82))";

  if (!analysis) {
    return (
      <div className="rounded-[2rem] border border-primary/10 p-6 sm:p-7" style={{ background: panelBg }}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Private journal analysis</p>
            <h2 className="mt-1 font-[family-name:var(--font-echo-display)] text-2xl font-semibold text-foreground">ECHO perspective</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Analysis will appear here when available. ECHO is not a diagnostic tool.</p>
          </div>
        </div>
      </div>
    );
  }

  const result = analysis.result;
  if (!result) {
    return (
      <div className="rounded-[2rem] border border-primary/10 p-6 sm:p-7" style={{ background: panelBg }}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Private journal analysis</p>
            <h2 className="mt-1 font-[family-name:var(--font-echo-display)] text-2xl font-semibold text-foreground">ECHO perspective</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{analysis.perspective}</p>
          </div>
        </div>
      </div>
    );
  }

  const facialStatus =
    analysis.facialStatus ?? (result.facialExpressionAnalysis ? "completed" : "not_requested");
  const facialDetail =
    facialStatus === "completed"
      ? `${result.facialExpressionAnalysis?.detectedEmotion ?? "Expression"} signal ready`
      : facialStatus === "captured_pending_provider"
        ? "Mesh captured — analysis provider not connected"
        : facialStatus === "not_captured"
          ? "No valid face mesh was captured"
          : facialStatus === "not_requested"
            ? "Not requested for this reflection"
            : "Facial analysis is not available yet";
  const facialIsReady = facialStatus === "completed";
  const distressMeta = distressBandMeta[result.distressBand?.toLowerCase() ?? "low"] ?? distressBandMeta.low;

  return (
    <>
      {/* Off-main-thread CSS animation for bars */}
      <style>{`
        @keyframes echo-bar-grow {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }
        @media (prefers-reduced-motion: reduce) {
          .echo-bar-animated { animation: none !important; }
        }
      `}</style>

      <section
        className="overflow-hidden rounded-[2rem] border border-primary/10 shadow-[0_22px_65px_rgba(16,42,36,.09)]"
        style={{ background: panelBg }}
        aria-labelledby="echo-analysis-heading"
      >
        {/* ── Header ── */}
        <header className="border-b border-primary/10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(16,42,36,.18)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Private journal analysis</p>
                <h2 id="echo-analysis-heading" className="mt-1 font-[family-name:var(--font-echo-display)] text-2xl font-semibold text-foreground">
                  ECHO perspective
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Reflective signals to help you notice patterns—not clinical interpretation.</p>
              </div>
            </div>
            {analysis.isDemoData && (
              <span className="rounded-full border border-amber-700/15 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-amber-900">
                Simulated data
              </span>
            )}
          </div>
          <blockquote className="mt-5 flex gap-3 rounded-2xl border border-primary/10 bg-card/70 p-4">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted-foreground">{analysis.perspective}</p>
          </blockquote>
        </header>

        {/* ── Data cards ── */}
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
          {/* 1. Emotion distribution – full width */}
          <article className="rounded-2xl border border-primary/10 bg-card/80 p-5 sm:col-span-2" style={{ backdropFilter: "blur(8px)" }}>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Brain className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">Emotion analysis</h3>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-700/20 bg-emerald-50/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <Check className="h-3 w-3" /> Ready
              </span>
            </div>
            <p className="sr-only">Emotion distribution</p>
            <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {result.emotionDistribution.map((em, i) => (
                <EmotionBar key={em.emotion} emotion={em.emotion} value={em.value} index={i} />
              ))}
            </div>
          </article>

          {/* 2. Journal distress */}
          <article
            className={`rounded-2xl border p-5 ${distressMeta.bgClass} ${distressMeta.borderClass}`}
            style={{ backdropFilter: "blur(8px)" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/40 text-foreground/80">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">Journal distress</h3>
            </div>
            <p className={`mt-3 font-[family-name:var(--font-echo-display)] text-3xl font-semibold capitalize ${distressMeta.colorClass}`}>
              {result.distressBand}
            </p>
            <p className="mt-1 text-[11px] text-foreground/60">
              Estimated with {Math.round(result.distressConfidence * 100)}% model confidence.
            </p>
          </article>

          {/* 3. PHQ-8 */}
          <article className="rounded-2xl border border-primary/10 bg-card/80 p-5" style={{ backdropFilter: "blur(8px)" }}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">PHQ-8 symptom estimate</h3>
            </div>
            <Phq8Gauge lower={result.depressiveSymptomRange.lower} upper={result.depressiveSymptomRange.upper} />
          </article>

          {/* 4. Safety check */}
          <article className="rounded-2xl border border-emerald-700/20 bg-emerald-50/60 p-5" style={{ backdropFilter: "blur(8px)" }}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">Safety and crisis-sign check</h3>
            </div>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Safety check complete
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              This check cannot rule out every support need. Reach out whenever you feel unsafe.
            </p>
          </article>

          {/* 5. Facial expression */}
          <article
            className={`rounded-2xl border p-5 ${facialIsReady ? "border-primary/10 bg-card/80" : "border-border/60 bg-card/50"}`}
            style={{ backdropFilter: "blur(8px)" }}
          >
            <div className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-primary ${facialIsReady ? "bg-primary/10" : "bg-muted/50"}`}>
                <ScanFace className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-foreground">Facial expression analysis</h3>
            </div>
            {facialIsReady && result.facialExpressionAnalysis ? (
              <>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {result.facialExpressionAnalysis.detectedEmotion} signal ready
                </p>
                <div className="mt-2.5 space-y-2">
                  {result.facialExpressionAnalysis.emotionDistribution.slice(0, 3).map((fe, i) => (
                    <div key={fe.emotion}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="capitalize text-foreground/80">{fe.emotion}</span>
                        <span className="font-semibold text-muted-foreground">{Math.round(fe.value * 100)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "hsl(var(--secondary))" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(fe.value * 100)}%`,
                            background: emotionColorMap[fe.emotion.toLowerCase()] ?? "hsl(var(--primary))",
                            opacity: 0.8,
                            animation: `echo-bar-grow 600ms cubic-bezier(0.23,1,0.32,1) ${200 + i * 50}ms both`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-foreground/80">{facialDetail}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  No facial photo or video is stored with this journal.
                </p>
              </>
            )}
          </article>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-primary/10 bg-card/40 p-5 sm:p-7">
          <h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Gentle next steps</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.recommendationFeatures.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-primary/15 bg-primary/[.06] px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary/10"
              >
                {recommendationLabels[feature] ?? feature.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            These private AI-generated estimates are for reflection only. They do not diagnose, treat, or replace professional care.
          </p>
        </footer>
      </section>
    </>
  );
}
