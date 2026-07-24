"use client";
import type { RiskBand } from "../model/insights.model";
import { EchoRiskIndicator } from "@/shared/components/data-display/echo-risk-indicator";

interface RiskBandHistoryProps {
  history: Array<{ date: string; score: number; band: RiskBand }>;
}

export function RiskBandHistory({ history }: RiskBandHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Risk history</p>
        <p className="mt-4 text-sm text-muted-foreground">No historical risk data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Risk band history</p>
      <div className="mt-4 space-y-3">
        {history.map((entry, index) => (
          <div key={index} className="flex items-center justify-between rounded-xl bg-secondary/20 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{entry.date}</p>
              <p className="text-xs text-muted-foreground">Score: {entry.score}</p>
            </div>
            <EchoRiskIndicator level={entry.band} />
          </div>
        ))}
      </div>
    </div>
  );
}
