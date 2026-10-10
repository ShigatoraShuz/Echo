"use client";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

export function LandingFinalCta() {
  return (
    <section className="bg-[var(--landing-cream)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <EchoReveal variant="card">
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[var(--landing-card-radius)] bg-[var(--landing-footer)] px-6 py-14 text-center text-[var(--landing-inverse)] shadow-[0_28px_80px_rgba(16,39,24,0.18)] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(207,221,167,0.18),transparent_30%),radial-gradient(circle_at_82%_78%,rgba(169,184,154,0.16),transparent_32%)]" aria-hidden="true" />
          <div className="relative">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/10 text-[#cfdda7]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mx-auto mt-6 max-w-3xl text-[clamp(2.8rem,5.6vw,5.75rem)] font-medium leading-[0.9] tracking-[-0.05em] [font-family:var(--font-echo-display)]">
              Make room for what you are feeling.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              Begin with one private check-in. You decide what to write, what to save, and which optional tools to use.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--landing-inverse)] px-7 text-sm font-bold text-[var(--landing-primary)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25">
                Start privately <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/[0.06] px-7 text-sm font-bold text-white transition-colors duration-200 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </EchoReveal>
    </section>
  );
}
