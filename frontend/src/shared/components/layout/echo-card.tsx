import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function EchoCard({
  title,
  description,
  action,
  children,
  className,
  compact = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn(compact ? "echo-compact-card" : "echo-card", "min-w-0", className)}>
      {title || description || action ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title ? <h2 className="text-xl font-semibold tracking-[-0.035em] text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 lg:mb-9 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {label ? <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-primary">{label}</p> : null}
        <h1 className="text-4xl font-medium leading-[0.95] tracking-[-0.055em] text-foreground [font-family:var(--font-echo-display)] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
