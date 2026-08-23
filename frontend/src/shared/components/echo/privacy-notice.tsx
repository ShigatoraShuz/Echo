import { Shield } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface PrivacyNoticeProps {
  compact?: boolean;
}

export function PrivacyNotice({ compact = false }: PrivacyNoticeProps) {
  return (
    <div className={cn(compact ? "p-0" : "rounded-2xl border border-border/70 bg-secondary/40 p-4 sm:p-5")}>
      <div className={cn("flex gap-3", compact && "gap-2")}>
        <Shield className={cn("mt-0.5 h-5 w-5 shrink-0 text-primary", compact && "h-4 w-4")} aria-hidden="true" />
        <p className={cn("text-sm leading-6 text-muted-foreground", compact && "text-xs leading-4")}>
          ECHO is private by design and is not a diagnostic tool. Mood and distress signals are reflective summaries,
          not medical conclusions.
        </p>
      </div>
    </div>
  );
}
