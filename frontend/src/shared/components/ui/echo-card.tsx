import { cn } from "@/lib/utils";

interface EchoCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  as?: "section" | "article" | "div";
}

export function EchoCard({
  title,
  description,
  action,
  children,
  className,
  compact = false,
  as: Component = "section",
}: EchoCardProps) {
  return (
    <Component className={cn(
      compact
        ? "rounded-2xl border border-border/70 bg-card p-4 text-card-foreground shadow-subtle sm:p-5"
        : "rounded-2xl border border-border/70 bg-card p-5 text-card-foreground shadow-card sm:p-6 lg:p-7",
      "min-w-0",
      className
    )}>
      {(title || description || action) && (
        <div className={cn("flex items-start justify-between gap-4", children ? "mb-5" : undefined)}>
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>}
            {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Component>
  );
}
