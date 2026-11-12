"use client";

import Link from "next/link";
import {SavedFaceResults} from "@/features/journal/components/saved-face-results";
import { useId, useState } from "react";
import type { DashboardInsights } from "@echo/contracts";
import { EchoCard } from "@/shared/components/layout/echo-card";

type EmotionPoint = DashboardInsights["emotionTrend"][number];

function EmotionHistory({ points, identity }: { points: EmotionPoint[]; identity: string }) {
  const id = useId();
  const labels = [...new Set(points.flatMap(p => Object.keys(p.values)))];
  const [selected, setSelected] = useState(labels[0]);
  const emotion = labels.includes(selected) ? selected : labels[0];
  const start = Date.parse(points[0].date), end = Date.parse(points.at(-1)!.date);
  // Missing days keep their temporal spacing; missing scores break the path rather than becoming zero.
  let drawing = false;
  const path = points.map(p => {
    const value = p.values[emotion];
    if (value === undefined) { drawing = false; return ""; }
    const x = end === start ? 250 : 14 + (Date.parse(p.date) - start) / (end - start) * 472;
    const next = `${drawing ? "L" : "M"}${x},${106 - value * 92}`;
    drawing = true;
    return next;
  }).join(" ");
  return <div className="min-w-0 space-y-3 rounded-2xl border border-border p-4">
    <label htmlFor={id} className="block text-xs font-semibold">Emotion signal</label>
    <select id={id} value={emotion} onChange={e => setSelected(e.target.value)} className="min-h-11 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm capitalize text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20">
      {labels.map(label => <option key={label} value={label}>{label}</option>)}
    </select>
    {points.length >= 2 ? <svg viewBox="0 0 500 120" role="img" aria-label={`${emotion} model scores over time; full dated values below`} className="h-28 w-full text-primary">
      <path d="M14 14V106H486" fill="none" stroke="currentColor" opacity="0.2" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg> : <p className="text-sm text-muted-foreground">One dated result is available. A trend needs at least two analysis days from the same model.</p>}
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {points.map((p, i) => <div key={`${p.date}:${i}`} className="flex min-w-0 flex-wrap justify-between gap-2 border-b border-border/60 py-2">
        <dt><time dateTime={p.date}>{p.date}</time></dt>
        <dd className="tabular-nums">{p.values[emotion] === undefined ? "Unavailable" : `${(p.values[emotion] * 100).toFixed(1)}%`}</dd>
      </div>)}
    </dl>
    <details className="rounded-xl border border-border/60 px-3"><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-foreground">About this analysis source</summary><p className="break-words pb-3 text-xs leading-5 text-muted-foreground">Source: {identity}. Latest completed result per UTC day. Scores from different model identities are kept separate.</p></details>
  </div>;
}

export function AnalysisHistory({ insights }: { insights: DashboardInsights }) {
  const groups = new Map<string, EmotionPoint[]>();
  for (const point of [...insights.emotionTrend].filter(p => !p.isSimulated).sort((a, b) => a.date.localeCompare(b.date))) {
    const key = point.modelIdentity ?? point.schemaVersion ?? "Historical analysis";
    const rows = groups.get(key) ?? []; rows.push(point); groups.set(key, rows);
  }
  const screening = insights.journalScreeningTrend ?? [];
  return <div className="space-y-3"><SavedFaceResults insights={insights}/>
    {insights.period?.historyTruncated ? <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm">Showing the latest 1,000 saved outputs from this period. Choose a shorter date range to review earlier history.</p> : null}
    {insights.savedReports?.length ? (
      <EchoCard className="[background:hsl(var(--card))]" title="Saved journal reports">
        <ul className="space-y-2 text-sm">
          {insights.savedReports.map(report => (
            <li key={report.resultId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <time dateTime={report.analyzedAt}>{new Date(report.analyzedAt).toLocaleString()}</time>
              <Link prefetch={false} href={`/journal/${report.journalId}`} className="font-semibold text-primary underline">Open journal report</Link>
            </li>
          ))}
        </ul>
      </EchoCard>
    ) : null}
    {insights.distressTrend.some(point => !point.isSimulated) ? (
      <EchoCard className="[background:hsl(var(--card))]" title="Historical distress bands">
        <ul className="space-y-2 text-sm">
          {insights.distressTrend.filter(point => !point.isSimulated).map((point, index) => (
            <li key={`${point.date}:${index}`} className="flex justify-between gap-2">
              <time dateTime={point.date}>{point.date}</time><span className="capitalize">{point.band}</span>
            </li>
          ))}
        </ul>
      </EchoCard>
    ) : null}
    <EchoCard className="[background:hsl(var(--card))]" title="Emotion history" description="Dated, persisted model outputs in the selected period. Missing days and values are not filled in.">
      {groups.size ? <div className="grid min-w-0 gap-3 lg:grid-cols-2">{[...groups].map(([identity, points]) => <EmotionHistory key={identity} identity={identity} points={points} />)}</div>
        : <p className="text-sm text-muted-foreground">No analysis data yet for this period.</p>}
    </EchoCard>
    <EchoCard className="[background:hsl(var(--card))]" title="Journal category history" description="Dataset categories are not clinical severity or a numerical risk score.">
      {insights.categoryTrend?.length ? <ul className="grid gap-2 sm:grid-cols-2">{insights.categoryTrend.map((p, i) => <li key={`${p.date}:${i}`} className="min-w-0 rounded-xl border border-border p-3">
        <time dateTime={p.date} className="text-xs text-muted-foreground">{p.date}</time><p className="mt-1 font-semibold">{p.label}</p><details className="mt-2"><summary className="min-h-10 cursor-pointer py-2 text-xs font-semibold text-primary">Model source</summary><p className="break-words text-xs text-muted-foreground">{p.modelIdentity}</p></details>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No category data yet for this period.</p>}
    </EchoCard>
    {screening.length ? <EchoCard className="[background:hsl(var(--card))]" title="Experimental journal estimates" description="Separate from questionnaire scores. Partial subtotals are not complete PHQ-8 totals.">
      <ul className="space-y-2 text-sm">{screening.map((p, i) => <li key={`${p.date}:${i}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border p-3">
        <time dateTime={p.date}>{p.date}</time><span>{p.status !== "available" ? p.status === "failed" ? "Estimate failed" : "Unavailable"
          : p.coverage === 8 && p.total !== null ? `Model total ${p.total}` : p.coverage === 0 ? "No criteria evidenced" : `Partial subtotal ${p.subtotal} (${p.coverage}/8 criteria)`}</span>
      </li>)}</ul>
    </EchoCard> : null}
  </div>;
}
