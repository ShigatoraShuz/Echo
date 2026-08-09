"use client";
import type { EmotionDistribution } from "../model/insights.model";

interface EmotionWheelProps {
  distributions: EmotionDistribution[];
  size?: number;
}

export function EmotionDistributionWheel({ distributions, size = 180 }: EmotionWheelProps) {
  let cursor = 0;
  const segments = distributions.map((d) => {
    const start = cursor;
    cursor += d.value * 3.6;
    return `${d.color} ${start}deg ${cursor}deg`;
  });

const background = segments.length > 0
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(hsl(var(--secondary)) 0deg 360deg)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="rounded-full shadow-subtle"
        style={{ width: size, height: size, background }}
        role="img"
        aria-label="Emotion distribution wheel"
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {distributions.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium text-foreground">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
