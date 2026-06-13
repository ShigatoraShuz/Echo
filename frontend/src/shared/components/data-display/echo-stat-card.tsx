import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface EchoStatCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EchoStatCard({ label, value, trend, trendLabel, icon, className }: EchoStatCardProps) {
  const trendColors = {
    up: "text-success",
    down: "text-danger",
    neutral: "text-muted-foreground",
  };

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-subtle", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {trend && (
        <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", trendColors[trend])}>
          {trend === "up" && <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
          {trend === "down" && <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
          {trendLabel && <span>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
