"use client";
import type { JournalSourceBreakdown } from "../model/insights.model";
import { EchoCard } from "@/shared/components/ui/echo-card";

interface SourceBreakdownProps {
  sources: JournalSourceBreakdown[];
}

export function JournalSourceBreakdownChart({ sources }: SourceBreakdownProps) {
  if (sources.length === 0) {
    return (
      <EchoCard title="Journal source breakdown" description="How your entries are distributed">
        <p className="py-8 text-center text-sm text-muted-foreground">No journal data available for this period.</p>
      </EchoCard>
    );
  }

  return (
    <EchoCard title="Journal source breakdown" description="How your entries are distributed">
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.source} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">{source.source}</span>
              <span className="font-medium text-muted-foreground">{source.count} ({source.percentage}%)</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: ${source.percentage}% }}
              />
            </div>
          </div>
        ))}
      </div>
    </EchoCard>
  );
}
