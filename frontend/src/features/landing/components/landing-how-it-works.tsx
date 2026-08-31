"use client";
import { PenLine, BarChart3, MessageCircle, Heart } from "lucide-react";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const STEPS = [
  { icon: PenLine, title: "Journal", description: "Write freely about your thoughts and feelings in a private, encrypted space." },
  { icon: BarChart3, title: "Discover patterns", description: "View gentle insights about your emotional trends over time." },
  { icon: MessageCircle, title: "Talk to Buddy", description: "Reflect with a compassionate AI companion that helps you process." },
  { icon: Heart, title: "Stay grounded", description: "Use breathing exercises and grounding tools when you need them." },
];

export function LandingHowItWorks() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] border border-border bg-card p-8 shadow-card sm:p-12">
        <div className="text-center">
          <h2 className="font-serif text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">How ECHO works</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">A gentle, four-step practice for everyday wellbeing.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 text-2xl font-serif text-foreground">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </EchoReveal>
  );
}
