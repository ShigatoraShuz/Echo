"use client";
import type { EmotionInsightSummary } from "../model/insights.model";
import { EchoCard } from "@/shared/components/ui/echo-card";

interface EmotionOverviewCardProps {
  summary: EmotionInsightSummary;
}

export function EmotionOverviewCard({ summary }: EmotionOverviewCardProps) {
  const cursor = 0;
  const segments = summary.emotionWheel.map((emotion) => {
    const degrees = emotion.value * 3.6;
    return ${emotion.color} deg deg;
  }).join(", ");

  return (
    <EchoCard title="Emotion overview" description="Your emotional landscape over this period">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="h-36 w-36 shrink-0 rounded-full shadow-subtle"
          style={{ background: conic-gradient() }}
          role="img"
          aria-label="Emotion distribution chart"
        />
        <div className="space-y-2">
          {summary.emotionWheel.map((emotion) => (
            <div key={emotion.label} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: emotion.color }} />
              <span className="text-muted-foreground">{emotion.label}</span>
              <span className="font-semibold text-foreground">{emotion.value}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{summary.summary}</p>
    </EchoCard>
  );
}
