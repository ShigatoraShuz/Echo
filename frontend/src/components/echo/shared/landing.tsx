import type { ReactNode } from "react";

export function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="echo-compact-card">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

export function BreathingCircle({ label = "Breathe" }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-border/70 bg-background p-8">
      <div className="echo-breathing-circle grid h-48 w-48 place-items-center rounded-full border border-primary/30 bg-secondary text-primary shadow-soft">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-card text-center shadow-subtle">
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}
