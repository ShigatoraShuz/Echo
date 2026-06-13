import { cn } from "@/lib/utils";

interface EchoSectionHeadingProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EchoSectionHeading({ title, description, action, className }: EchoSectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="space-y-1 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
