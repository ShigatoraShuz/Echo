import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";
type BadgeSize = "small" | "medium";

interface EchoBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const sizeClasses: Record<BadgeSize, string> = {
  small: "px-2 py-0.5 text-[10px]",
  medium: "px-3 py-1 text-xs",
};

export function EchoBadge({ children, variant = "default", size = "medium", className }: EchoBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border font-semibold capitalize",
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {children}
    </span>
  );
}
