"use client";
import { EchoCard } from "@/shared/components/ui/echo-card";

interface MostFrequentEmotionsProps {
  emotions: Array<{ emotion: string; count: number }>;
}

export function MostFrequentEmotions({ emotions }: MostFrequentEmotionsProps) {
  const maxCount = Math.max(...emotions.map((e) => e.count), 1);

  return (
    <EchoCard title="Most frequent emotions" description="Emotions you have identified most often">
      <div className="space-y-3">
        {emotions.map((item) => (
          <div key={item.emotion} className="flex items-center gap-3">
            <span className="w-24 text-sm font-medium text-foreground truncate">{item.emotion}</span>
            <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: ${(item.count / maxCount) * 100}% }} />
            </div>
            <span className="text-sm text-muted-foreground min-w-[3ch] text-right">{item.count}</span>
          </div>
        ))}
      </div>
    </EchoCard>
  );
}
