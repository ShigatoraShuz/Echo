import type { ReactNode } from "react";
import { AlertTriangle, HeartHandshake, Loader2 } from "lucide-react";

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
        {icon ?? <HeartHandshake className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingState({ label = "Loading ECHO" }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-subtle">
      <Loader2 className="mb-4 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-6">
      <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
