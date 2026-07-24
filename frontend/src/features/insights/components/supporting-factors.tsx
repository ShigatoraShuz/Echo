"use client";
import { HeartHandshake } from "lucide-react";

interface SupportingFactorsProps {
  factors: string[];
}

export function SupportingFactors({ factors }: SupportingFactorsProps) {
  if (factors.length === 0) {
    return (
      <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">Supporting factors</p>
        <p className="mt-3 text-sm text-muted-foreground">Positive patterns will appear here as you continue journaling.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-6">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-primary" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">Supporting factors</p>
      </div>
      <ul className="mt-4 space-y-2">
        {factors.map((factor, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
            {factor}
          </li>
        ))}
      </ul>
    </div>
  );
}
