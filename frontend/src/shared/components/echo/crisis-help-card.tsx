import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrisisHelpCardProps {
  compact?: boolean;
}

export function CrisisHelpCard({ compact = false }: CrisisHelpCardProps) {
  return (
    <div className={cn("rounded-2xl border border-danger/30 bg-crisis-soft p-5", compact && "p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crisis text-danger-foreground">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Immediate support is available</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            If you may be in danger, contact emergency services or a crisis line now. ECHO is not a diagnostic tool.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href="/crisis" className="echo-button-primary bg-crisis text-danger-foreground hover:bg-crisis/90">
          Get crisis support
        </Link>
        <Link href="/crisis-help" className="echo-button-secondary">
          View resources
        </Link>
      </div>
    </div>
  );
}
