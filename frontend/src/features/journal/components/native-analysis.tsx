"use client";
import {LocalFaceResult} from "./local-face-result";
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
type NativeResult = Exclude<JournalAnalysisResult, { schemaVersion: "echo-journal-analysis-v1" }>;
export function NativeAnalysis({
  result,
  insights,
  entryId,
}: {
  result: NativeResult;
  insights?: DashboardInsights;
  entryId?: string;
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
  return (
    <section className="echo-compact-card space-y-5 p-5" aria-label="Journal model analysis">
      <div>
        <h2 className="text-xl font-semibold">Your reflection patterns</h2>
        <p className="text-sm text-muted-foreground">
          Model categories support reflection. They are not diagnoses or measures of your safety.
        </p>
      </div>
      {entryId && <LocalFaceResult entryId={entryId}/>}
      {result.schemaVersion === "echo-journal-analysis-v3" && (
        <div>
          <h3>Experimental journal PHQ-8 estimate</h3>
          <p className="text-xs text-muted-foreground">
            {result.journalScreening.generatedAt
              ? `${result.journalScreening.status === "available" ? "Estimated" : "Attempted"} on ${new Date(result.journalScreening.generatedAt).toLocaleString()}`
              : "Estimate date unavailable for this saved result."}
          </p>
          {result.journalScreening.status !== "available" ? (
            <p>Journal estimate unavailable. Other results remain available.</p>
          ) : (
            <>
              <p>
                {result.journalScreening.coverage === 8
                  ? `Complete model estimate: ${result.journalScreening.total}`
                  : result.journalScreening.coverage === 0
                    ? "No criteria evidenced in this entry"
                    : `Partial subtotal: ${result.journalScreening.subtotal}  -  ${result.journalScreening.coverage} of 8 criteria estimated`}
              </p>
              <dl>
                {Object.entries(result.journalScreening.items!).map(([key, value]) => (
                  <div key={key}>
                    <dt>{criterionLabels[key] ?? key}</dt>
                    <dd>{value === null ? "Not evidenced in this journal" : value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {entryId && result.journalScreening.status !== "available" && (
            <button disabled={retrying} onClick={() => void retry()}>
              {retrying ? "Retrying screening..." : "Retry screening only"}
            </button>
          )}
          <p role="status">{retryMessage}</p>
          {result.journalScreening.truncated && <p>This estimate used a shortened version of this long entry.</p>}
          <p>
            This experimental estimate is separate from questionnaire scoring. Numeric values estimate frequency: 0 =
            not at all, 1 = several days, 2 = more than half the days, 3 = nearly every day. Missing evidence stays
            null.
          </p>
        </div>
      )}
      <div>
        <h3 className="font-semibold">Emotion patterns</h3>
        <p className="capitalize">Strongest signal: {result.dominantEmotion}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {result.emotionDistribution.map(({ emotion, value }) => (
            <div key={emotion}>
              <div className="flex justify-between text-sm">
                <dt className="capitalize">{emotion}</dt>
                <dd>{Math.round(value * 100)}%</dd>
              </div>
              <div className="h-2 overflow-hidden rounded bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${value * 100}%` }} />
              </div>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="font-semibold">Journal category: {result.distressCategory}</h3>
        <p className="text-sm text-muted-foreground">
          These are the classifier’s dataset labels, not clinical severity.
        </p>
        <dl className="mt-2 flex flex-wrap gap-4 text-sm">
          {Object.entries(result.categoryScores).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{Math.round(value * 100)}%</dd>
            </div>
          ))}
        </dl>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Additional emotion signals</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          These 27 signals are independent and do not add up to 100%.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(result.goEmotions).map(([name, value]) => (
            <div key={name}>
              <dt className="capitalize">{name}</dt>
              <dd>{Math.round(value * 100)}%</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="text-sm text-muted-foreground">
        Facial analysis is unavailable. Questionnaire check-ins are recorded separately from journal model estimates.
      </p>
      {result.supportReviewRequired ? (
        <p role="status" className="text-sm font-semibold">
          This reflection included a support flag. Support options are available.
        </p>
      ) : null}
      {insights ? (
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
          <p className="mt-2 text-xs text-muted-foreground">
            Earlier analyses use a different model format and remain in your journal history.
          </p>
        </div>
      ) : null}
      {insights?.journalScreeningTrend?.length ? (
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
