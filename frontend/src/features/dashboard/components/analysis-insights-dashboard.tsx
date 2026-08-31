"use client";

import { Activity, HeartPulse, Radar, Sparkles } from "lucide-react";
import type { DashboardInsights, JournalAnalysisResult } from "@echo/contracts";
import { AnalysisBuddyAction } from "./analysis-buddy-action";

export function AnalysisInsightsDashboard({ insights }: { insights?: DashboardInsights }) {
  if (!insights?.latest)
    return (
      <section className="echo-card mt-6" aria-labelledby="analysis-empty-title">
        <div className="echo-feature-icon">
          <Sparkles aria-hidden="true" />
        </div>
        <h2 id="analysis-empty-title" className="text-xl font-semibold text-foreground">
          Your analysis space is ready
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose analysis when saving a reflection to see validated emotion and distress insights. ECHO will not invent
          a trend before enough data exists.
        </p>
      </section>
    );
  const result = insights.latest;
  const realTrend = insights.emotionTrend.filter((point) => !point.isSimulated);
  return (
    <section className="mt-6 space-y-4" aria-labelledby="analysis-insights-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Journal analysis</p>
          <h2 id="analysis-insights-title" className="mt-1 text-2xl font-semibold text-foreground">
            A careful view of your latest reflection
          </h2>
        </div>
        {result.isSimulated ? (
          <span className="rounded-full border border-amber-700/15 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Simulated analysis
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <article className="echo-card lg:col-span-5">
          <div className="flex items-center gap-3">
            <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold">Emotion distribution</h3>
          </div>
          <EmotionRadar result={result} />
        </article>
        <article className="echo-card lg:col-span-3">
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
        <article className="echo-card lg:col-span-4">
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
        <article className="echo-card lg:col-span-7">
          <h3 className="font-semibold">Seven-day emotion and distress mapping</h3>
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
        <article className="echo-card lg:col-span-5">
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
    </section>
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
        viewBox="0 0 180 180"
        role="img"
        aria-label={`Dominant emotion ${result.dominantEmotion}`}
        className="mx-auto h-44 w-44"
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
        viewBox="0 0 420 150"
        role="img"
        aria-label="Dated emotion distributions, from zero to one hundred percent"
        className="w-full"
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
