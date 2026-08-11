"use client";
import { ArrowRight, Shield } from "lucide-react";
import Link from "next/link";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

export function LandingFinalCta() {
  return (
    <EchoReveal>
      <section className="rounded-[2rem] bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground shadow-card sm:p-12">
        <Shield className="mx-auto h-10 w-10 text-primary-foreground/80" />
        <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] sm:text-4xl">Start your private practice</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-primary-foreground/80">ECHO is free, private, and always will be. No ads, no data selling, no hidden agendas.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-primary hover:bg-white/90">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/about" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20">
            Learn more
          </Link>
        </div>
      </section>
    </EchoReveal>
  );
}
