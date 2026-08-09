"use client";
import { useMemo } from "react";
import { Scale } from "lucide-react";
import { useInsightsViewModel } from "../view-model/use-insights-view-model";
import { PrivacyNotice } from "@/shared/components/echo";
import { DataChartCard } from "@/shared/components/data-display";
import { EchoCard, PageHeader } from "@/shared/components/layout";

export function EmotionInsightsView() {
  const vm = useInsightsViewModel();
  const insights = vm.emotionSummary;

  const wheelBackground = useMemo(() => {
    if (!insights) return "conic-gradient(hsl(var(--secondary)) 0 360deg)";
    let cursor = 0;
    const segments = insights.emotionWheel.map((emotion) => {
      const start = cursor;
      cursor += emotion.value * 3.6;
      return `${emotion.color} ${start}deg ${cursor}deg`;
    });
    if (cursor < 360) segments.push(`hsl(var(--secondary)) ${cursor}deg 360deg`);
    return `conic-gradient(${segments.join(", ")})`;
  }, [insights]);

  return (
    <div className="space-y-6">
      <PageHeader
        label="Insights"
        title="Emotion patterns"
        description="A private, reflective view built from your saved journal moods. It is not a diagnosis."
      />

      {vm.error ? (
        <div role="alert" className="mb-6 rounded-2xl border border-danger/25 bg-crisis-soft p-4 text-sm text-foreground">
          {vm.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <EchoCard title="Emotion wheel" description="Distribution across your saved reflections.">
          <div className="grid place-items-center rounded-2xl border border-border/70 bg-background p-8">
            <div
              className="grid h-64 w-64 place-items-center rounded-full shadow-soft transition-[background] duration-500"
              style={{ background: wheelBackground }}
            >
              <div className="grid h-36 w-36 place-items-center rounded-full bg-card text-center shadow-subtle">
                <span className="px-4 text-sm font-semibold leading-5 text-foreground">
                  {vm.isLoading
                    ? "Loading patterns…"
                    : insights && insights.emotionWheel.reduce((sum, item) => sum + item.value, 0) > 0
                      ? "Your recent signals"
                      : "No entries yet"}
                </span>
              </div>
            </div>
          </div>
        </EchoCard>

        <div className="space-y-6">
          <DataChartCard
            title="Emotion trends"
            description="A seven-day view calculated from saved journal moods."
            points={(insights?.moodTrend ?? []).map((point) => ({ label: point.label, value: point.value }))}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <EchoCard title="Top emotions" description="Frequency across your recent entries.">
              <div className="space-y-3">
                {(insights?.emotionWheel ?? []).map((emotion) => (
                  <div key={emotion.label} className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: emotion.color }} />
                    <span className="flex-1 text-sm font-medium text-foreground">{emotion.label}</span>
                    <span className="text-sm text-muted-foreground">{emotion.value}%</span>
                  </div>
                ))}
                {insights?.emotionWheel.every((emotion) => emotion.value === 0) ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Save a journal reflection to begin seeing patterns.
                  </p>
                ) : null}
              </div>
            </EchoCard>
            <EchoCard title="Emotional balance" description="A supportive summary, never a clinical conclusion.">
              <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {insights?.summary ?? "Reading your private reflection rhythm…"}
              </p>
            </EchoCard>
          </div>
          <PrivacyNotice />
        </div>
      </div>
    </div>
  );
}