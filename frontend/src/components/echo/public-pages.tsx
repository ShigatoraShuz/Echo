"use client";

import { type ReactNode } from "react";
import { Shield } from "lucide-react";
import { EchoCard, EchoImage, PrivacyNotice } from "@/components/echo/shared";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import type { EchoImageKey } from "@/lib/unsplash-images";

export function PublicTextPage({
  title,
  description,
  imageKey,
  children,
}: {
  title: string;
  description: string;
  imageKey: EchoImageKey;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <EchoReveal direction="up" className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
          </div>
          <PrivacyNotice />
          <EchoImage imageKey={imageKey} className="aspect-[4/3]" priority />
        </EchoReveal>

        <EchoReveal direction="up" delay={150}>
          <EchoCard>{children}</EchoCard>
        </EchoReveal>
      </div>
    </div>
  );
}

export function PolicyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-background p-5">
      <div className="flex gap-3">
        <Shield className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  );
}
