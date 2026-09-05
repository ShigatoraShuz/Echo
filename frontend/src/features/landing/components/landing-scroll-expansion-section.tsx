"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, HeartPulse, LockKeyhole, MessageCircle } from "lucide-react";

import reflectionParkImage from "../../../../assets/landing-page/554afe1d63edf77309bac1f7a33302f6 (1).jpg";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { ScrollExpandMedia } from "@/shared/components/ui/scroll-expansion-hero";

const reflectionModes = [
  {
    title: "Journal",
    description: "Capture private thoughts in a space that feels quiet and familiar.",
    icon: BookOpen,
  },
  {
    title: "Insights",
    description: "Review emotional patterns and non-diagnostic wellbeing signals.",
    icon: HeartPulse,
  },
  {
    title: "Buddy",
    description: "Talk through the next step with CBT-informed AI-assisted support.",
    icon: MessageCircle,
  },
  {
    title: "Privacy",
    description: "Keep reflection personal with privacy-first product choices.",
    icon: LockKeyhole,
  },
];

export function LandingScrollExpansionSection() {
  return (
    <ScrollExpandMedia
      eyebrow="Inside ECHO"
      title="A calmer way to return to yourself."
      scrollToExpand="Scroll through a focused preview of how ECHO turns everyday reflection into gentle, usable insight."
      mediaSrc={reflectionParkImage}
    >
      <div className="grid gap-6 rounded-[2rem] border border-[#315b38]/10 bg-[#fffdf7]/62 p-5 shadow-[0_24px_70px_rgba(38,72,54,0.08)] backdrop-blur-sm sm:p-7 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <EchoReveal variant="text" direction="right">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#536733]">Built for regular reflection</p>
          <h3 className="mt-3 max-w-xl font-[family-name:var(--font-echo-display)] text-3xl font-medium leading-tight tracking-[-0.035em] text-[#2f3527] sm:text-4xl">
            Move from a moment, to a pattern, to one grounded next step.
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#5f6857]">
            ECHO keeps the experience human: journaling first, AI-assisted insight second, and private choice at the center.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#536733] px-6 text-sm font-bold text-[#fffaf0] outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-[#46592b] focus-visible:ring-4 focus-visible:ring-[#536733]/25 active:scale-[0.97]"
          >
            Start privately
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </EchoReveal>

        <div className="grid gap-3 sm:grid-cols-2">
          {reflectionModes.map((mode, index) => {
            const Icon = mode.icon;
            return (
              <EchoReveal
                key={mode.title}
                variant="card"
                delay={index * 65}
                className="h-full"
              >
                <article className="h-full rounded-[1.5rem] border border-[#536733]/12 bg-white/88 p-4 shadow-[0_14px_34px_rgba(23,45,37,0.07)]">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dce8d6] text-[#536733]">
                    <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                  </span>
                  <h4 className="mt-4 text-sm font-black text-[#2f3527]">{mode.title}</h4>
                  <p className="mt-2 text-xs leading-5 text-[#5f6857]">{mode.description}</p>
                </article>
              </EchoReveal>
            );
          })}
        </div>
      </div>
    </ScrollExpandMedia>
  );
}
