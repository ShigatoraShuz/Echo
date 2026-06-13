import { cn } from "@/lib/utils";

interface EchoProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: "small" | "medium";
  variant?: "default" | "success" | "warning";
  className?: string;
}

export function EchoProgress({
  value,
  max = 100,
  label,
  showValue = false,
  size = "medium",
  variant = "default",
  className,
}: EchoProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const roundedPct = Math.round(pct);

  const trackHeight = size === "small" ? "h-1.5" : "h-2.5";
  const variantStyles = {
    default: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {label && <span>{label}</span>}
          {showValue && <span aria-live="polite">{roundedPct}%</span>}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-muted", trackHeight)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${roundedPct}%`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", variantStyles[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
