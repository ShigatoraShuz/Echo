"use client";
import { Bot, ArrowRight } from "lucide-react";
import Link from "next/link";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

export function LandingMeetBuddyCTA() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] border border-primary/10 bg-gradient-to-br from-card to-primary/[0.02] p-8 shadow-card sm:p-12">
        <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Bot className="h-10 w-10" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-3xl tracking-[-0.04em] text-foreground sm:text-4xl">Meet your reflective Buddy</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">A private, non-judgmental space to talk through what feels present. Buddy listens, reflects, and helps you find steadier ground.</p>
          </div>
          <Link href="/buddy" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary/90 shrink-0">
            Start a conversation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </EchoReveal>
  );
}
