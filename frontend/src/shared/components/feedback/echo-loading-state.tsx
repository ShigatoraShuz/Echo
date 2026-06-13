import { cn } from "@/lib/utils";
import { EchoSkeletonGroup } from "../ui/echo-skeleton";

interface EchoLoadingStateProps {
  label?: string;
  variant?: "spinner" | "skeleton";
  count?: number;
  className?: string;
}

export function EchoLoadingState({ label, variant = "skeleton", count = 4, className }: EchoLoadingStateProps) {
  return (
    <div className={cn("py-6", className)} aria-live="polite" aria-busy="true">
      {variant === "spinner" ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
          {label && <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <EchoSkeletonGroup count={count} />
        </div>
      )}
    </div>
  );
}
