"use client";

import { Activity, ChevronDown, HeartPulse, Radar } from "lucide-react";
import type { DashboardInsights, JournalAnalysisResult } from "@echo/contracts";
import { AnalysisBuddyAction } from "./analysis-buddy-action";

export function AnalysisInsightsDashboard({ insights }: { insights?: DashboardInsights }) {
  if (!insights?.latest)
    return (
      <section className="echo-compact-card min-w-0 xl:col-span-3 xl:p-4" aria-labelledby="analysis-empty-title">
        <h2 id="analysis-empty-title" className="text-sm font-semibold text-foreground">
          Journal analysis
        </h2>
        <p className="mt-1 text-lg font-semibold text-foreground">No completed analysis yet</p>
        <p className="mt-1 text-xs leading-5 text-[var(--landing-muted)]">
          Choose analysis when saving a reflection. ECHO will not invent a trend before enough data exists.
        </p>
      </section>
    );
  const result = insights.latest;
  const realTrend = insights.emotionTrend.filter((point) => !point.isSimulated);
  return (
    <details className="echo-compact-card group min-w-0 open:lg:col-span-2 xl:col-span-3 xl:p-4 open:xl:col-span-12" aria-labelledby="analysis-insights-title">
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/20 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 id="analysis-insights-title" className="text-sm font-semibold text-foreground">Journal analysis</h2>
          <p className="mt-1 text-lg font-semibold capitalize text-foreground">
            {result.dominantEmotion} emotion · {result.distressBand} distress
          </p>
          <p className="mt-1 text-xs text-[var(--landing-muted)]">Reflective estimate, not a diagnosis.</p>
          {result.isSimulated ? (
            <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
              Simulated analysis
            </span>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <span>Details</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <article className="border-t border-border/70 pt-4 lg:col-span-5">
          <div className="flex items-center gap-3">
            <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">Emotion distribution</h3>
          </div>
          <EmotionRadar result={result} />
        </article>
        <article className="border-t border-border/70 pt-4 lg:col-span-3">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">Distress classification</h3>
          </div>
          <p className="mt-5 font-[family-name:var(--font-echo-display)] text-4xl font-semibold capitalize">
            {result.distressBand}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Confidence {Math.round(result.distressConfidence * 100)}%
          </p>
        </article>
        <article className="border-t border-border/70 pt-4 lg:col-span-4">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">AI-estimated depressive-symptom range</h3>
          </div>
          <p className="mt-5 font-[family-name:var(--font-echo-display)] text-4xl font-semibold">
            {result.depressiveSymptomRange.lower}–{result.depressiveSymptomRange.upper}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This AI-generated estimate is not a diagnosis or completed PHQ-8 assessment.
          </p>
        </article>
        <article className="border-t border-border/70 pt-4 lg:col-span-7">
          <h3 className="font-semibold">Thirty-day emotion and distress mapping</h3>
          {insights.emotionTrend.length < 2 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              There is not enough dated analysis to describe a trend yet.
            </p>
          ) : (
            <TrendBars insights={insights} />
          )}
          {realTrend.length === 0 && insights.emotionTrend.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Only simulated points are shown; they are excluded from production aggregates.
            </p>
          ) : null}
        </article>
        <article className="border-t border-border/70 pt-4 lg:col-span-5">
          <h3 className="font-semibold">Reviewed CBT-informed recommendation</h3>
          {insights.recommendation ? (
            <>
              <p className="mt-4 text-lg font-semibold">{insights.recommendation.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{insights.recommendation.description}</p>
              <AnalysisBuddyAction resultId={insights.latestResultId} />
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No reviewed recommendation is available.</p>
          )}
        </article>
      </div>
    </details>
  );
}

function EmotionRadar({ result }: { result: JournalAnalysisResult }) {
  const center = 90,
    radius = 62;
  const points = result.emotionDistribution
    .map((item, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 3;
      const r = radius * item.value;
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    })
    .join(" ");
  return (
    <div className="mt-3 grid items-center gap-3 sm:grid-cols-[180px_1fr]">
      <svg
        key={result.emotionDistribution.map((item) => `${item.emotion}:${item.value}`).join("|")}
        viewBox="0 0 180 180"
        role="img"
        aria-label={`Dominant emotion ${result.dominantEmotion}`}
        className="echo-chart-wheel-reveal mx-auto h-44 w-44"
      >
        <polygon
          points="90,28 143.7,59 143.7,121 90,152 36.3,121 36.3,59"
          fill="none"
          stroke="currentColor"
          className="text-border"
        />
        <polygon points={points} fill="hsl(var(--primary)/.2)" stroke="hsl(var(--primary))" strokeWidth="2" />
      </svg>
      <ul className="space-y-1 text-sm">
        {result.emotionDistribution.map((item) => (
          <li key={item.emotion} className="flex justify-between gap-4">
            <span className="capitalize text-muted-foreground">{item.emotion}</span>
            <span className="font-semibold">{Math.round(item.value * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function TrendBars({ insights }: { insights: DashboardInsights }) {
  const colors = ["#285b48", "#5778a5", "#815a8e", "#a46734", "#9c4759", "#657334"];
  const emotions = ["joy", "calm", "sadness", "anxiety", "anger", "hope"];
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">Latest completed result per day. Missing days are not filled in.</p>
      <svg
        key={insights.emotionTrend.map((point) => `${point.date}:${Object.values(point.values).join(",")}`).join("|")}
        viewBox="0 0 420 150"
        role="img"
        aria-label="Dated emotion distributions, from zero to one hundred percent"
        className="echo-chart-line-reveal w-full"
      >
        <path d="M20 10V130H400" fill="none" stroke="currentColor" className="text-border" />
        {emotions.map((emotion, index) => (
          <polyline
            key={emotion}
            points={insights.emotionTrend
              .map(
                (point, i) =>
                  `${20 + (i * 380) / Math.max(1, insights.emotionTrend.length - 1)},${130 - (point.values[emotion] ?? 0) * 120}`,
              )
              .join(" ")}
            fill="none"
            stroke={colors[index]}
            strokeWidth="2"
          />
        ))}
      </svg>
      <ul className="flex flex-wrap gap-3 text-xs">
        {emotions.map((emotion, index) => (
          <li key={emotion} className="capitalize">
            <span aria-hidden="true" style={{ color: colors[index] }}>
              ●{" "}
            </span>
            {emotion}
          </li>
        ))}
      </ul>
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Daily emotion and distress mapping</caption>
        <thead>
          <tr>
            <th className="py-2">Date</th>
            <th>Strongest emotion</th>
            <th>Distress band</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {insights.distressTrend.map((point) => {
            const distribution = insights.emotionTrend.find((entry) => entry.date === point.date)?.values ?? {};
            const dominant = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unavailable";
            return (
              <tr key={point.date} className="border-t border-border/60">
                <td className="py-2">{point.date}</td>
                <td className="capitalize">{dominant}</td>
                <td className="capitalize">{point.band}</td>
                <td>{point.isSimulated ? "Simulated" : "Analysis"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
