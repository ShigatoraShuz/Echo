"use client";
import {LocalFaceResult} from "./local-face-result";
import { Brain, Activity, ClipboardList, ChevronDown, LockKeyhole } from "lucide-react";
import { analysisSummary } from "../model/analysis-summary";
import { useState } from "react";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import { env } from "@/config/environment";
import type { JournalAnalysisResult, DashboardInsights } from "@echo/contracts";
import { AnalysisBuddyAction } from "@/features/dashboard/components/analysis-buddy-action";

const criterionLabels: Record<string, string> = {
  anhedonia: "Interest and enjoyment",
  depressed_mood: "Feeling down",
  sleep: "Sleep",
  fatigue: "Energy",
  appetite: "Appetite",
  worthlessness_guilt: "Self-worth",
  concentration: "Concentration",
  psychomotor: "Movement or restlessness",
};
type NativeResult = Extract<JournalAnalysisResult, { schemaVersion: "echo-journal-analysis-v2" | "echo-journal-analysis-v3" }>;
export function NativeAnalysis({
  result,
  insights,
  entryId,
  showHistory = true,
}: {
  result: NativeResult;
  insights?: DashboardInsights;
  entryId?: string;
  showHistory?: boolean;
}) {
  const [retryMessage, setRetryMessage] = useState(""),
    [retrying, setRetrying] = useState(false);
  async function retry() {
    if (!entryId) return;
    setRetrying(true);
    try {
      await createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider }).post(
        "/journals/" + entryId + "/screening/retry",
        {},
        { timeout: 315000 },
      );
      setRetryMessage("Screening updated.");
      window.dispatchEvent(new CustomEvent("echo:analysis-completed", { detail: { journalId: entryId } }));
    } catch {
      setRetryMessage("Screening retry is unavailable. Other results remain saved.");
    } finally {
      setRetrying(false);
    }
  }
  if (result.isSimulated) return <section aria-label="Journal model analysis" className="rounded-3xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">No saved AI result</h2><p className="mt-2 text-sm text-muted-foreground">Development examples are not shown as your analysis.</p></section>;
  const summary = analysisSummary(result);
  const rankedEmotions = [...result.emotionDistribution].sort((a, b) => b.value - a.value);
  return (
    <section className="min-w-0 space-y-5 overflow-hidden rounded-[2rem] border border-primary/15 bg-card p-4 text-foreground shadow-[0_18px_48px_rgba(24,48,37,0.07)] sm:p-7" aria-label="Journal model analysis">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-secondary/70 to-background p-5 sm:p-6">
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Private analysis</p>
          <h2 className="mt-2 font-[family-name:var(--font-echo-display)] text-2xl font-semibold tracking-tight sm:text-3xl">Your reflection patterns</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/75">Model categories support reflection. They are not diagnoses or measures of your safety.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">{summary.status === "partial" ? "Partial analysis" : "Complete analysis"}</span>
      </header>
      {entryId && <LocalFaceResult entryId={entryId}/>}
      <div className="min-w-0 rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-semibold"><Brain className="h-4 w-4 text-primary" aria-hidden="true" />Emotion patterns</h3>
        <p className="mt-2 text-lg font-semibold capitalize">Strongest signal: {result.dominantEmotion}</p>
        <p className="mt-1 text-xs text-foreground/75">Relative model scores, not a measure of how strongly you feel.</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          {rankedEmotions.map(({ emotion, value }) => (
            <div key={emotion} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 bg-card p-3">
              <dt className="break-words text-xs capitalize sm:text-sm">{emotion}</dt>
              <dd className="text-right text-sm tabular-nums">{Math.round(value * 100)}%</dd>
              <dd aria-hidden="true" className="col-span-2 h-2 overflow-hidden rounded bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${value * 100}%` }} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary" aria-hidden="true" />Journal category: {result.distressCategory}</h3>
        <p className="text-sm text-foreground/75">
          These are the classifier’s dataset labels, not clinical severity.
        </p>
        {result.schemaVersion === "echo-journal-analysis-v3" && result.distressEstimate && (
          <p className="mt-2 text-sm">Experimental distress estimate: <strong className="capitalize">{result.distressEstimate.status === "available" ? result.distressEstimate.band : "Not estimated"}</strong>. From the journal text; not a clinical assessment or safety rating.</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(result.categoryScores).map(([name, value]) => (
            <div key={name} className="min-w-0 rounded-xl border border-border bg-card p-3">
              <dt className="break-words text-xs text-muted-foreground">{name}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(value * 100)}%</dd>
            </div>
          ))}
        </dl>
      </div>
      {result.schemaVersion === "echo-journal-analysis-v3" && (
        <section className="min-w-0 rounded-2xl border border-primary/15 bg-secondary/25 p-4 sm:p-5" aria-label="Journal screening estimate">
          <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Experimental journal PHQ-8 estimate</h3>
          <p className="text-xs text-foreground/75">
            {result.journalScreening.generatedAt
              ? `${result.journalScreening.status === "available" ? "Estimated" : "Attempted"} on ${new Date(result.journalScreening.generatedAt).toLocaleString()}`
              : "Estimate date unavailable for this saved result."}
          </p>
          {result.journalScreening.status !== "available" ? (
            <p className="mt-3 text-sm font-medium">{result.journalScreening.status === "failed" ? "Journal estimate failed." : "Journal estimate unavailable."} Other results remain available.</p>
          ) : (
            <>
              <p className="mt-4 text-lg font-semibold tabular-nums">
                {result.journalScreening.coverage === 8
                  ? `Complete model estimate: ${result.journalScreening.total}`
                  : result.journalScreening.coverage === 0
                    ? "No criteria evidenced in this entry"
                    : `Partial subtotal: ${result.journalScreening.subtotal}  -  ${result.journalScreening.coverage} of 8 criteria estimated`}
              </p>
              <p className="mt-1 text-xs text-foreground/75">Only eight evidenced criteria produce a complete total. Missing evidence is never scored as zero.</p>
              <dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">
                {Object.entries(result.journalScreening.items!).map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-xl border border-border bg-card p-3">
                    <dt className="text-xs font-medium text-foreground/75">{criterionLabels[key] ?? key}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">{value === null ? "Not evidenced in this journal" : value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {entryId && result.journalScreening.status === "failed" && (
            <button type="button" className="echo-button-secondary mt-3 disabled:opacity-60" disabled={retrying} onClick={() => void retry()}>
              {retrying ? "Retrying screening..." : "Retry screening only"}
            </button>
          )}
          <p role="status" className="mt-2 text-sm text-foreground/75">{retryMessage}</p>
          {result.journalScreening.truncated && <p>This estimate used a shortened version of this long entry.</p>}
          <p className="mt-3 text-xs leading-5 text-foreground/75">
            This experimental estimate is separate from questionnaire scoring. Numeric values estimate frequency: 0 =
            not at all, 1 = several days, 2 = more than half the days, 3 = nearly every day. Missing evidence stays
            null.
          </p>
        </section>
      )}
      <details className="group min-w-0 rounded-2xl border border-border p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/20 [&::-webkit-details-marker]:hidden">Additional emotion signals<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
        <p className="mt-2 text-xs text-foreground/75">
          These 27 signals are independent and do not add up to 100%.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(result.goEmotions).map(([name, value]) => (
            <div key={name}>
              <dt className="capitalize">{name}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(value * 100)}%</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="text-sm text-foreground/75">
        {!entryId ? "Facial analysis is unavailable. " : ""}Questionnaire check-ins are recorded separately from journal model estimates.
      </p>
      {result.supportReviewRequired ? (
        <p role="status" className="text-sm font-semibold">
          This reflection included a support flag. Support options are available.
        </p>
      ) : null}
      <details className="min-w-0 rounded-2xl border border-border p-4">
        <summary className="min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/20">Model provenance</summary>
        <p className="mt-2 break-words text-xs leading-5 text-foreground/75">{result.providerName} · {result.modelVersion} · {result.schemaVersion}</p>
        <p className="mt-1 break-words text-xs leading-5 text-foreground/75">Emotion: {result.models.e4.modelVersion} · Categories: {result.models.xlmr.modelVersion}</p>
      </details>
      {insights && showHistory ? (
        <div>
          <h3 className="font-semibold">Recent emotion patterns</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {insights.emotionTrend
              .filter(
                (p) => p.schemaVersion === "echo-journal-analysis-v2" || p.schemaVersion === "echo-journal-analysis-v3",
              )
              .map((p) => (
                <li key={p.date}>
                  {p.date}: {Object.entries(p.values).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unavailable"}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-foreground/75">
            Earlier analyses use a different model format and remain in your journal history.
          </p>
        </div>
      ) : null}
      {showHistory && insights?.journalScreeningTrend?.length ? (
        <section aria-label="Experimental journal estimate history">
          <h3>Experimental journal estimates</h3>
          <p>Separate from questionnaire scores. Partial subtotals are not complete PHQ-8 totals.</p>
          <ul>
            {insights.journalScreeningTrend.map((p, i) => (
              <li key={p.date + ":" + i}>
                {p.date}:{" "}
                {p.status !== "available"
                  ? "Unavailable"
                  : p.coverage === 8
                    ? `Model total ${p.total}`
                    : p.coverage === 0
                      ? "No criteria evidenced"
                      : `Partial subtotal ${p.subtotal} (${p.coverage}/8 criteria)`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {insights?.recommendation ? (
        <div>
          <h3 className="font-semibold">{insights.recommendation.title}</h3>
          <p className="text-sm">{insights.recommendation.description}</p>
          <AnalysisBuddyAction resultId={insights.latestResultId} />
        </div>
      ) : null}
    </section>
  );
}
