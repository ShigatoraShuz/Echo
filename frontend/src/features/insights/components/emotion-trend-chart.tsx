"use client";
import type { MoodTrendPoint } from "../model/insights.model";
import { EchoCard } from "@/shared/components/ui/echo-card";

interface EmotionTrendChartProps {
  points: MoodTrendPoint[];
  timeRange: string;
}

export function EmotionTrendChart({ points, timeRange }: EmotionTrendChartProps) {
  const maxValue = Math.max(...points.map((p) => p.value), 1);

  return (
    <EchoCard title="Emotion trend" description={Mood pattern over }>
      <div className="flex h-48 items-end gap-2 rounded-xl border border-border/70 bg-background p-4">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-lg bg-primary/60 transition-all"
              style={{ height: ${(point.value / maxValue) * 100}% }}
            />
            <span className="truncate text-[10px] text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
    </EchoCard>
  );
}
