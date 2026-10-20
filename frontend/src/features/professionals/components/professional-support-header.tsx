import type { ReactNode } from "react";

export function ProfessionalSupportHeader({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {label ? <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary">{label}</p> : null}
        <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.25rem)] leading-tight [font-family:var(--font-echo-display)]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}
