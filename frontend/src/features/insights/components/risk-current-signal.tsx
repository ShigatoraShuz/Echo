"use client";
import type { RiskBand } from "../model/insights.model";
import { RISK_COLORS } from "../model/insights.constants";
import { EchoRiskIndicator } from "@/shared/components/data-display/echo-risk-indicator";

interface RiskCurrentSignalProps {
  score: number;
  band: RiskBand;
  label: string;
}

export function RiskCurrentSignal({ score, band, label }: RiskCurrentSignalProps) {
  const color = RISK_COLORS[band] ?? "hsl(var(--muted-foreground))";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Current risk signal</p>
      <div className="mt-4 flex items-center gap-6">
        <div
          className="h-24 w-24 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(${color} ${score * 3.6}deg, hsl(var(--secondary)) 0deg)`,
          }}
          role="img"
          aria-label={`Risk score ${score} out of 100, ${label} risk`}
        />
        <div>
          <p className="text-3xl font-bold text-foreground">{score}</p>
          <EchoRiskIndicator level={band} label={label} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Lower scores indicate lower risk signals based on your recent entries.</p>
        </div>
      </div>
    </div>
  );
}
