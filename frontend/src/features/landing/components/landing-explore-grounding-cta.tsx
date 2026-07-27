"use client";
import { Wind, ArrowRight } from "lucide-react";
import Link from "next/link";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { EchoBreathingVisual } from "@/shared/components/react-bits/echo-breathing-visual";

export function LandingExploreGroundingCTA() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] border border-border bg-card p-8 shadow-card sm:p-12">
        <div className="flex flex-col items-center gap-8 lg:flex-row">
          <div className="shrink-0">
            <EchoBreathingVisual label="Breathe" />
          </div>
          <div className="flex-1 text-center lg:text-left">
            <h2 className="font-serif text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">Explore grounding tools</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Simple, evidence-based exercises to help you return to the present moment. Box breathing, sensory awareness, and gentle paced breathing.</p>
            <Link href="/tools/grounding" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Try grounding <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </EchoReveal>
  );
}
