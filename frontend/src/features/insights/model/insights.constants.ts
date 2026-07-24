export const TIME_RANGE_LABELS: Record<string, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "custom": "Custom range",
};

export const RISK_COLORS: Record<string, string> = {
  low: "hsl(var(--success))",
  medium: "hsl(var(--warning))",
  high: "hsl(var(--danger))",
  critical: "hsl(var(--critical))",
};

export const MOOD_COLORS: Record<string, string> = {
  awful: "hsl(0, 60%, 55%)",
  bad: "hsl(20, 50%, 55%)",
  okay: "hsl(45, 40%, 55%)",
  good: "hsl(120, 35%, 50%)",
  great: "hsl(150, 40%, 50%)",
  unknown: "hsl(210, 10%, 65%)",
};
