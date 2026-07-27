"use client";
import { BookOpen, Wind, Bot, Settings, BarChart3 } from "lucide-react";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const FEATURES = [
  { icon: BookOpen, title: "Private journaling", description: "End-to-end encrypted journal with mood tracking and emotion tagging." },
  { icon: Bot, title: "AI companion", description: "Buddy offers reflective conversation and gentle guidance." },
  { icon: BarChart3, title: "Emotion insights", description: "Visualize your emotional patterns with charts and summaries." },
  { icon: Wind, title: "Grounding tools", description: "Breathing exercises and sensory awareness for difficult moments." },
  { icon: Settings, title: "Privacy controls", description: "Granular control over your data and analysis preferences." },
];


export function LandingFeatureOverview() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] border border-border bg-card p-8 shadow-card sm:p-12">
        <div className="text-center">
          <h2 className="font-serif text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">Everything in one place</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">A comprehensive wellbeing toolkit designed for privacy and gentleness.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-xl border border-border bg-background p-5 transition-colors hover:bg-secondary/20">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </EchoReveal>
  );
}
