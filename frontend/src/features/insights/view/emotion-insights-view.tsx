"use client";

import { useMemo } from "react";
import {
  Leaf, Scale, Sparkles, Activity, TrendingUp, Heart, BookOpen,
} from "lucide-react";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { PrivacyNotice } from "@/shared/components/echo";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EmotionTrendChart } from "../components/emotion-trend-chart";

// ─── Emotion colour that matches the mood score semantics ─────────────────────
function moodScoreColor(positive: number, difficult: number) {
  const ratio = positive / (positive + difficult || 1);
  if (ratio > 0.7) return "#536733";
  if (ratio > 0.4) return "#8fc89a";
  return "#c98483";
}

// ─── Conic gradient builder (correct cursor accumulation) ─────────────────────
function buildConic(segments: Array<{ value: number; color: string }>) {
  if (segments.every((s) => s.value === 0))
    return "conic-gradient(var(--landing-sage-soft) 0 360deg)";
  let cursor = 0;
  const stops = segments.map((s) => {
    const start = cursor;
    cursor += s.value * 3.6;
    return `${s.color} ${start}deg ${cursor}deg`;
  });
  if (cursor < 360) stops.push(`var(--landing-sage-soft) ${cursor}deg 360deg`);
  return `conic-gradient(${stops.join(", ")})`;
}

// ─── Stat badge helper ────────────────────────────────────────────────────────
function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--landing-surface)] px-3 py-2.5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-xl"
        style={{ background: color ?? "var(--landing-primary-10)", color: color ? "white" : "var(--landing-primary)" }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-wider text-[var(--landing-muted)]">{label}</p>
        <p className="text-sm font-bold text-[var(--landing-ink)]">{value}</p>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-[var(--landing-sage-soft)]/40 ${className}`} />
  );
}

export function EmotionInsightsView() {
  const vm = useInsightsViewModel();
  const insights = vm.emotionSummary;

  const wheelGradient = useMemo(
    () => buildConic(insights?.emotionWheel ?? []),
    [insights]
  );

  const posRatio = insights
    ? Math.round(
        (insights.positiveVsDifficult.positive /
          Math.max(
            insights.positiveVsDifficult.positive + insights.positiveVsDifficult.difficult,
            1
          )) * 100
      )
    : 0;

  const topEmotion = insights?.emotionWheel.reduce(
    (max, e) => (e.value > max.value ? e : max),
    { label: "–", value: 0, color: "", mood: "okay" as const }
  );

  return (
    <EchoReveal direction="up" className="mx-auto max-w-7xl space-y-8 pb-20">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 border-b border-[var(--landing-sage-soft)] pb-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--landing-primary)] text-white">
            <Leaf className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-primary)]">
            Reflective Insights
          </p>
        </div>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.04em] text-[var(--landing-ink)] [font-family:var(--font-echo-display)]">
          Emotion patterns
        </h1>
        <p className="max-w-xl text-sm leading-6 text-[var(--landing-muted)]">
          A private, reflective view built from your saved journal moods. This is a supportive
          tool for self-discovery, not a clinical diagnosis.
        </p>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {vm.error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <Activity className="h-4 w-4 shrink-0" />
          {vm.error}
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">

        {/* ── LEFT: Wheel + stats ──────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Wheel card */}
          <div className="overflow-hidden rounded-3xl border border-[var(--landing-sage-soft)] bg-white shadow-[0_8px_32px_rgba(47,53,39,0.07)]">
            <div className="border-b border-[var(--landing-sage-soft)] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-primary)]">Emotion Wheel</p>
              <p className="mt-0.5 text-xs text-[var(--landing-muted)]">Your emotional distribution across saved reflections</p>
            </div>

            {/* Donut */}
            <div className="flex justify-center py-8">
              {vm.isLoading ? (
                <Skeleton className="h-56 w-56 rounded-full" />
              ) : (
                <div className="relative">
                  <div
                    className="h-56 w-56 rounded-full shadow-[0_16px_40px_rgba(47,53,39,0.12)] transition-[background] duration-700"
                    style={{ background: wheelGradient }}
                    role="img"
                    aria-label="Emotion distribution wheel"
                  />
                  {/* Inner ring */}
                  <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-xl">
                    <div className="text-center">
                      <span className="block text-2xl font-black leading-none text-[var(--landing-ink)]">
                        {insights?.emotionWheel.reduce((s, e) => s + e.value, 0) ?? 0}%
                      </span>
                      <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-widest text-[var(--landing-muted)]">
                        Captured
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Legend list */}
            <div className="border-t border-[var(--landing-sage-soft)] px-6 py-4 space-y-3">
              {vm.isLoading
                ? [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-6" />)
                : (insights?.emotionWheel ?? []).map((emotion) => (
                    <div key={emotion.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: emotion.color }}
                          />
                          <span className="text-[var(--landing-ink)]">{emotion.label}</span>
                        </div>
                        <span className="text-[var(--landing-muted)]">{emotion.value}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--landing-sage-soft)]/40">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ backgroundColor: emotion.color, width: `${emotion.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
              {!vm.isLoading && insights?.emotionWheel.every((e) => e.value === 0) && (
                <div className="flex flex-col items-center py-6 text-center">
                  <BookOpen className="mb-2 h-7 w-7 text-[var(--landing-sage)]" />
                  <p className="text-xs text-[var(--landing-muted)]">
                    Save a journal reflection to see your emotional patterns.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-2 gap-3">
            {vm.isLoading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : (
              <>
                <StatPill
                  icon={Heart}
                  label="Dominant mood"
                  value={topEmotion?.label ?? "–"}
                  color={topEmotion?.color}
                />
                <StatPill
                  icon={TrendingUp}
                  label="Positive ratio"
                  value={`${posRatio}%`}
                  color={moodScoreColor(
                    insights?.positiveVsDifficult.positive ?? 0,
                    insights?.positiveVsDifficult.difficult ?? 0
                  )}
                />
              </>
            )}
          </div>

          <PrivacyNotice />
        </div>

        {/* ── RIGHT: Trend + Sanctuary ──────────────────────────────────── */}
        <div className="space-y-6">

          {/* Emotion trends card */}
          <div className="overflow-hidden rounded-3xl border border-[var(--landing-sage-soft)] bg-white shadow-[0_8px_32px_rgba(47,53,39,0.07)]">
            <div className="border-b border-[var(--landing-sage-soft)] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-primary)]">
                Emotion Trends
              </p>
              <p className="mt-0.5 text-xs text-[var(--landing-muted)]">
                Rolling mood score from your saved journal reflections
              </p>
            </div>
            <div className="p-6">
              {vm.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <EmotionTrendChart points={insights?.moodTrend ?? []} />
              )}
            </div>
          </div>

          {/* Most frequent emotions */}
          <div className="overflow-hidden rounded-3xl border border-[var(--landing-sage-soft)] bg-white shadow-[0_8px_32px_rgba(47,53,39,0.07)]">
            <div className="border-b border-[var(--landing-sage-soft)] px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-primary)]">
                Frequency Analysis
              </p>
              <p className="mt-0.5 text-xs text-[var(--landing-muted)]">Emotions you have recorded most often</p>
            </div>
            <div className="p-6 space-y-3.5">
              {vm.isLoading
                ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)
                : (insights?.mostFrequentEmotions ?? []).map((item, i) => {
                    const maxCount = Math.max(...(insights?.mostFrequentEmotions ?? []).map((e) => e.count), 1);
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <div key={item.emotion} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="grid h-5 w-5 place-items-center rounded-lg bg-[var(--landing-primary-10)] text-[8px] font-black text-[var(--landing-primary)]">
                              {i + 1}
                            </span>
                            <span className="text-[var(--landing-ink)]">{item.emotion}</span>
                          </div>
                          <span className="text-[var(--landing-muted)]">{item.count}×</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--landing-sage-soft)]/40">
                          <div
                            className="h-full rounded-full bg-[var(--landing-primary)] transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%`, opacity: 0.6 + 0.4 * (pct / 100) }}
                          />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Sanctuary perspective */}
          <div className="overflow-hidden rounded-3xl border border-[var(--landing-sage-soft)] bg-gradient-to-br from-[var(--landing-surface)] to-[var(--landing-cream)] shadow-[0_8px_32px_rgba(83,103,51,0.06)]">
            <div className="border-b border-[var(--landing-sage-soft)] px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--landing-primary-10)] text-[var(--landing-primary)]">
                  <Scale className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-primary)]">
                  Sanctuary Perspective
                </p>
              </div>
            </div>
            <div className="relative p-6">
              <Sparkles className="absolute right-6 top-6 h-4 w-4 text-[var(--landing-sage)]" aria-hidden="true" />
              {vm.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ) : (
                <p className="text-sm leading-[1.85] text-[var(--landing-muted)] italic">
                  {insights?.summary ??
                    "Reading your private reflection rhythm and preparing a supportive summary…"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </EchoReveal>
  );
}