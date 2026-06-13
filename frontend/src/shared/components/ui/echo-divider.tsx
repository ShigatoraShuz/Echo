import { cn } from "@/lib/utils";

interface EchoDividerProps {
  label?: string;
  className?: string;
}

export function EchoDivider({ label, className }: EchoDividerProps) {
  if (!label) {
    return <hr className={cn("my-2 border-t border-border/50", className)} role="separator" />;
  }

  return (
    <div className={cn("flex items-center gap-3 my-2", className)} role="separator" aria-orientation="horizontal">
      <span className="h-px flex-1 bg-border/50" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border/50" />
    </div>
  );
}
