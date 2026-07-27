"use client";
import { Lock, Eye, ShieldCheck, Server, ArrowRight } from "lucide-react";
import Link from "next/link";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const badgeES = [
  { icon: Lock, label: "End-to-end encrypted", description: "Your journal entries are encrypted before they leave your device." },
  { icon: Eye, label: "You are in control", description: "Choose what to share for analysis. Your data stays yours." },
  { icon: ShieldCheck, label: "No diagnostic claims", description: "ECHO is a reflective tool, not a clinical or diagnostic service." },
  { icon: Server, label: "Minimal data collection", description: "We only collect what is needed to provide the service." },
];

export function LandingPrivacySection() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/[0.02] to-card p-8 shadow-card sm:p-12">
        <div className="text-center">
          <h2 className="font-serif text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">Privacy you can trust</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">ECHO is built with privacy as a foundation, not an afterthought.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {badgeES.map((badgee) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className="rounded-xl border border-border bg-card p-5">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">{badge.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{badge.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link href="/privacy-policy" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80">
            Read our privacy policy <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </EchoReveal>
  );
}
