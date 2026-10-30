"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { RiskBadge } from "@/shared/components/data-display";
import { EchoCard, PageHeader } from "@/shared/components/layout";
import { VerifiedFeatureGate } from "@/features/verification";

function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`));
}

export function RiskInsightsView() {
  const vm = useInsightsViewModel();
  const latest = vm.overview?.latest;
  const history = vm.overview?.distressTrend ?? [];

  return (
    <div className="space-y-6">
      <VerifiedFeatureGate featureName="Distress signal analysis">
        <PageHeader
          label="Insights"
          title="Distress signal history"
          description="These bands come from completed, optional journal analysis. They are support cues, not a diagnosis or emergency assessment."
        />

        {vm.error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-crisis-soft p-4 text-sm text-foreground">
            <span>{vm.error}</span>
            <button type="button" onClick={() => void vm.retry()} className="min-h-10 font-semibold text-primary underline underline-offset-4">Retry</button>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          <EchoCard title="Latest reported band" description="From your latest completed journal analysis.">
            {latest ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {latest.schemaVersion !== "echo-journal-analysis-v1" ? <span>{latest.distressCategory} category · clinical severity unavailable</span> : <RiskBadge band={latest.distressBand} />}
                  {latest.isSimulated ? <span className="text-xs font-semibold text-muted-foreground">Simulated development result</span> : null}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {latest.isSimulated
                    ? "This example does not describe your wellbeing."
                    : "This is a category reported by the analysis provider, not a measured 0–100 risk score."}
                </p>
                <p className="text-xs text-muted-foreground">Source: {latest.providerName} · {latest.modelVersion}</p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">{vm.isLoading ? "Loading analysis…" : "No completed analysis is available. A missing result does not mean low distress."}</p>
            )}
          </EchoCard>

          <EchoCard title="What this means" description="Read the result in context.">
            <p className="text-sm leading-6 text-muted-foreground">A band summarizes one optional reflection analysis. It cannot measure your current safety or replace your own experience.</p>
            <Link href="/journal" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">View your reflections</Link>
          </EchoCard>
        </div>

        <EchoCard title="Earlier reported bands" description="The history shows categories from completed analyses, without inventing a numerical score.">
          {history.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {history.map((point, index) => (
                <li key={`${point.date}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background p-4">
                  <time dateTime={point.date} className="text-sm font-semibold text-foreground">{formatDay(point.date)}</time>
                  <span className="flex flex-wrap items-center gap-2">
                    <RiskBadge band={point.band} />
                    {point.isSimulated ? <span className="text-xs text-muted-foreground">Simulated</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">{vm.isLoading ? "Loading history…" : "No completed analysis history is available yet."}</p>
          )}
        </EchoCard>

        <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-5">
          <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            If distress feels urgent, use <Link href="/crisis" className="font-semibold text-primary underline underline-offset-4">crisis support</Link> now. ECHO does not diagnose or monitor emergencies.
          </p>
        </div>
      </VerifiedFeatureGate>
    </div>
  );
}
