import { type ReactNode } from "react";
import { Leaf, ShieldCheck, type LucideIcon } from "lucide-react";
import { PrivacyNotice } from "@/shared/components/echo";
import { EchoImage } from "@/shared/components/ui";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import type { EchoImageKey } from "@/shared/lib/unsplash-images";

export function PublicTextPage({
  eyebrow,
  title,
  description,
  imageKey,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  imageKey: EchoImageKey;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-32 xl:px-10">
      <EchoReveal
        direction="up"
        className="mb-8 grid gap-6 border-b border-border/70 pb-8 lg:mb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-end lg:gap-12 lg:pb-10"
      >
        <div className="space-y-4">
          {eyebrow ? (
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-primary">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="max-w-4xl text-5xl font-medium leading-[0.95] tracking-[-0.055em] text-foreground [font-family:var(--font-echo-display)] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {description}
          </p>
        </div>
        <PrivacyNotice />
      </EchoReveal>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-10 xl:gap-14">
        <EchoReveal direction="up">
          <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background p-2 shadow-[0_18px_50px_rgba(37,52,40,0.08)] lg:sticky lg:top-28">
            <EchoImage
              imageKey={imageKey}
              className="aspect-[16/11] rounded-[1.35rem] sm:aspect-[16/10] lg:aspect-[4/5]"
              priority
              sizes="(min-width: 1280px) 38vw, (min-width: 1024px) 42vw, 100vw"
            />
          </div>
        </EchoReveal>

        <EchoReveal direction="up" delay={120} className="space-y-4">
          {children}
        </EchoReveal>
      </div>
    </div>
  );
}

export function PolicyBlock({
  title,
  children,
  icon: Icon = ShieldCheck,
}: {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="group rounded-2xl border border-border/70 bg-background/90 p-5 shadow-[0_10px_30px_rgba(37,52,40,0.04)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_38px_rgba(37,52,40,0.08)] sm:p-6">
      <div className="flex gap-4 sm:gap-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-lg font-semibold tracking-[-0.025em] text-foreground sm:text-xl">{title}</h2>
          <div className="mt-2 text-sm leading-7 text-muted-foreground sm:text-[15px]">{children}</div>
        </div>
      </div>
    </section>
  );
}
