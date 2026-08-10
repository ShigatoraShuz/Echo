import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading ECHO" }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-subtle">
      <Loader2 className="mb-4 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}