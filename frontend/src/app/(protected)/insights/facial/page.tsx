import { Camera, EyeOff, Shield } from "lucide-react";
import { DataChartCard, EchoCard, PageHeader, PrivacyNotice } from "@/shared/components/legacy";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { facialTrend } from "@/lib/mock-data";

const aggregates = [
  { label: "Relaxed expression", value: "58%", description: "Average from opted-in sessions" },
  { label: "Tension cues", value: "18%", description: "Shown only as aggregate trend" },
  { label: "Sessions", value: "4", description: "Started manually this week" },
];

export default function FacialInsightsPage() {
  return (
    <AppShell>
      <PageHeader
        label="Insights"
        title="Facial trend privacy"
        description="Optional facial analysis should be manual, aggregated, and clearly non-diagnostic."
      />

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/70 bg-secondary/40 p-5">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted-foreground">
              Facial analysis is optional and should never run silently. It can summarize broad trends, but ECHO is not a diagnostic tool.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <EchoCard title="Camera placeholder" description="The user starts camera access intentionally.">
            <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-border bg-background">
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary">
                  <Camera className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Camera off</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a session manually</p>
                <button type="button" className="mt-4 echo-button-secondary">
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  Keep off
                </button>
              </div>
            </div>
          </EchoCard>

          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              {aggregates.map((item) => (
                <EchoCard key={item.label} compact>
                  <p className="text-3xl font-semibold text-foreground">{item.value}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </EchoCard>
              ))}
            </div>
            <DataChartCard title="Aggregated facial trends" description="Mock trend cards for opted-in sessions only." points={facialTrend} />
            <PrivacyNotice />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
