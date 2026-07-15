import type { TrendPoint } from "@/types";
import { EchoCard } from "@/components/echo/shared/card";

export function DataChartCard({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
}) {
  return (
    <EchoCard title={title} description={description}>
      <div className="chart-card-grid flex h-56 items-end gap-3 rounded-xl border border-border/70 bg-background p-4">
        {points.map((point, index) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-xl shadow-subtle"
              style={{
                height: `${Math.max(point.value, 8)}%`,
                background: `hsl(var(--chart-${(index % 5) + 1}))`,
              }}
            />
            <span className="truncate text-xs font-medium text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
    </EchoCard>
  );
}
