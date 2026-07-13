"use client";

import { cn } from "@/lib/utils";

interface EchoBreathingVisualProps {
  label?: string;
  className?: string;
}

export function EchoBreathingVisual({ label = "Breathe", className }: EchoBreathingVisualProps) {
  return (
    <div className={cn("grid place-items-center rounded-2xl border border-border/70 bg-background p-8", className)}>
      <div
        className="grid h-48 w-48 place-items-center rounded-full border border-primary/30 bg-secondary text-primary shadow-soft motion-reduce:animate-none"
        aria-label={`${label} — breathing exercise`}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-card text-center shadow-subtle">
          <span className="text-sm font-semibold text-foreground motion-reduce:animate-none">{label}</span>
        </div>
      </div>
    </div>
  );
}
