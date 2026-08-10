import type { ReactNode } from "react";
import { HeartHandshake } from "lucide-react";

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