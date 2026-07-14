import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-secondary/40 p-4", !compact && "sm:p-5")}>
      <div className="flex gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-6 text-muted-foreground">
          ECHO is private by design and is not a diagnostic tool. Mood and distress signals are reflective summaries,
          not medical conclusions.
        </p>
      </div>
    </div>
  );
}
