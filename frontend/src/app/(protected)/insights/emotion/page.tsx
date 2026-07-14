import { Scale } from "lucide-react";
import { DataChartCard, EchoCard, MoodBadge, PageHeader, PrivacyNotice } from "@/components/echo/shared";
import { AppShell } from "@/components/echo/shells";
import { emotionWheel, moodTrend } from "@/lib/mock-data";
import { moodDotStyles } from "@/lib/theme";

export default function EmotionInsightsPage() {
  return (
    <AppShell>
      <PageHeader
        label="Insights"
        title="Emotion patterns"
        description="A reflective view of recurring emotions. ECHO is not a diagnostic tool."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <EchoCard title="Emotion wheel" description="Radial view of sample emotion distribution.">
          <div className="grid place-items-center rounded-2xl border border-border/70 bg-background p-8">
            <div
              className="grid h-64 w-64 place-items-center rounded-full shadow-soft"
              style={{
                background:
                  "conic-gradient(hsl(var(--calm)) 0 108deg, hsl(var(--happy)) 108deg 173deg, hsl(var(--neutral)) 173deg 231deg, hsl(var(--anxious)) 231deg 281deg, hsl(var(--sad)) 281deg 324deg, hsl(var(--angry)) 324deg 360deg)",
              }}
            >
              <div className="grid h-36 w-36 place-items-center rounded-full bg-card text-center shadow-subtle">
                <span className="px-4 text-sm font-semibold leading-5 text-foreground">Mostly calm signals</span>
              </div>
            </div>
          </div>
        </EchoCard>

        <div className="space-y-6">
          <DataChartCard title="Emotion trends" description="Mood signal movement across the week." points={moodTrend} />
          <div className="grid gap-5 lg:grid-cols-2">
            <EchoCard title="Top emotions" description="Sample frequency list from recent entries.">
              <div className="space-y-3">
                {emotionWheel.map((emotion) => (
                  <div key={emotion.label} className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${moodDotStyles[emotion.mood]}`} />
                    <span className="flex-1 text-sm font-medium text-foreground">{emotion.label}</span>
                    <span className="text-sm text-muted-foreground">{emotion.value}%</span>
                  </div>
                ))}
              </div>
            </EchoCard>
            <EchoCard title="Emotional balance" description="A supportive summary, not a diagnosis.">
              <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Calm and hopeful language appears more often than high-intensity language this week.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MoodBadge mood="calm" />
                <MoodBadge mood="happy" />
                <MoodBadge mood="neutral" />
              </div>
            </EchoCard>
          </div>
          <PrivacyNotice />
        </div>
      </div>
    </AppShell>
  );
}
