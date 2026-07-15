import { AlertTriangle, ListChecks, ShieldCheck } from "lucide-react";
import { DataChartCard, EchoCard, PageHeader, RiskBadge, RiskScoreRing } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { riskTrend } from "@/lib/mock-data";

const signals = [
  "Sleep disruption mentioned in two entries",
  "Work stress appeared in one higher-intensity entry",
  "Grounding and walking were associated with lower end-of-entry intensity",
];

export default function RiskInsightsPage() {
  return (
    <AppShell>
      <PageHeader
        label="Insights"
        title="Distress signal history"
        description="Risk bands are support cues only. They are not diagnosis, prediction, or clinical triage."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <DataChartCard title="Rolling score chart" description="Seven-day distress signal trend from mock data." points={riskTrend} />
          <EchoCard title="Risk band history" description="Bands help route support copy and should not be treated as diagnosis.">
            <div className="grid gap-3">
              {riskTrend.map((point) => (
                <div key={point.label} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background p-4">
                  <span className="text-sm font-semibold text-foreground">{point.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{point.value}/100</span>
                    {point.band ? <RiskBadge band={point.band} /> : null}
                  </div>
                </div>
              ))}
            </div>
          </EchoCard>
        </div>

        <aside className="space-y-6">
          <EchoCard title="Current band" description="Latest support signal.">
            <RiskScoreRing score={25} band="low" />
          </EchoCard>
          <EchoCard title="Contributing signals" description="Plain-language observations from entries.">
            <div className="space-y-3">
              {signals.map((signal) => (
                <div key={signal} className="flex gap-3 rounded-2xl border border-border/70 bg-background p-4">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm leading-6 text-muted-foreground">{signal}</p>
                </div>
              ))}
            </div>
          </EchoCard>
          <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-5">
            <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              If distress feels urgent, use crisis support now. ECHO does not diagnose or monitor emergencies.
            </p>
          </div>
          <EchoCard compact>
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="text-sm leading-6 text-muted-foreground">Future backend scoring should remain explainable and user-controlled.</p>
            </div>
          </EchoCard>
        </aside>
      </div>
    </AppShell>
  );
}
