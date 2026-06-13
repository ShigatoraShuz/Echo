import { cn } from "@/lib/utils";

interface EchoPageHeadingProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EchoPageHeading({ title, description, badge, action, className }: EchoPageHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
