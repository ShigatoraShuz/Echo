import { cn } from "@/lib/utils";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface EchoRiskIndicatorProps {
  level: RiskLevel;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const config: Record<RiskLevel, { dot: string; bg: string; text: string }> = {
  low: { dot: "bg-success", bg: "bg-success/10", text: "text-success" },
  medium: { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning" },
  high: { dot: "bg-danger", bg: "bg-danger/10", text: "text-danger" },
  critical: { dot: "bg-danger", bg: "bg-danger/15", text: "text-danger" },
};

export function EchoRiskIndicator({ level, label, showDot = true, className }: EchoRiskIndicatorProps) {
  const { dot, bg, text } = config[level];

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold capitalize", bg, text, className)}>
      {showDot && <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden="true" />}
      {label || level}
    </span>
  );
}
