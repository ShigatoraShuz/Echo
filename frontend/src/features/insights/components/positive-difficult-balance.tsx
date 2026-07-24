"use client";
import { EchoCard } from "@/shared/components/ui/echo-card";

interface BalanceProps {
  positive: number;
  difficult: number;
}

export function PositiveDifficultBalance({ positive, difficult }: BalanceProps) {
  const total = positive + difficult;
  const positivePct = total > 0 ? (positive / total) * 100 : 50;
  const difficultPct = total > 0 ? (difficult / total) * 100 : 50;

  return (
    <EchoCard title="Positive vs. difficult" description="Balance of emotional experiences">
      <div className="space-y-4">
        <div className="flex h-6 rounded-full overflow-hidden bg-secondary/50">
          <div className="bg-success/70 transition-all" style={{ width: ${positivePct}% }} />
          <div className="bg-danger/50 transition-all" style={{ width: ${difficultPct}% }} />
        </div>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            <span className="text-foreground">Positive moments</span>
            <span className="font-medium text-muted-foreground">{positive}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
            <span className="text-foreground">Difficult moments</span>
            <span className="font-medium text-muted-foreground">{difficult}</span>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {positivePct >= 60
            ? "You have identified more positive emotions in this period. That is a meaningful sign of wellbeing."
            : difficultPct >= 60
              ? "Difficult emotions have been more present. This is normal and part of the human experience."
              : "Your emotional landscape shows a balanced mix of experiences."}
        </p>
      </div>
    </EchoCard>
  );
}
