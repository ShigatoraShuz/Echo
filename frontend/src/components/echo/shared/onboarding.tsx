import { CheckCircle2 } from "lucide-react";

export function ConsentCard({
  title,
  description,
  checked = false,
}: {
  title: string;
  description: string;
  checked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-4 rounded-2xl border border-border/70 bg-background p-4 shadow-subtle">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        {checked ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : null}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
