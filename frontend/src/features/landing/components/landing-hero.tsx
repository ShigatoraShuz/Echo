"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";
import { ShieldCheck, Sparkles, Wind, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import heroBackground from "../../../../assets/aac2846f-fae0-4ae0-a910-a48a0627440f (1).png";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import type { LandingHeroContent, LandingStatIcon } from "../model";

interface LandingHeroProps {
  content: LandingHeroContent;
  className?: string;
}

const statIcons: Record<LandingStatIcon, LucideIcon> = {
  privacy: ShieldCheck,
  moods: Sparkles,
  grounding: Wind,
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.08, staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

const titleVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(105%)" },
  visible: {
    opacity: 1,
    transform: "translateY(0%)",
    transition: { duration: 0.72, ease: [0.23, 1, 0.32, 1] },
  },
};

export function LandingHero({
  content: { eyebrow, title, subtitle, actions, stats },
  className,
}: LandingHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
      <section
        className={cn(
          "relative flex h-svh min-h-[760px] w-full overflow-hidden bg-[var(--landing-mist)] text-[var(--landing-ink)]",
          className,
        )}
      >
        <Image
          src={heroBackground}
          alt=""
          fill
          priority
          aria-hidden="true"
          sizes="100vw"
          className="pointer-events-none object-cover object-center"
        />

        <motion.div
          className="relative z-10 mx-auto flex h-full w-full max-w-[1440px] flex-col items-center px-5 pb-8 pt-36 text-center [font-family:var(--font-echo-sans)] sm:px-8 sm:pt-40 lg:px-12 lg:pt-[12.5rem]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {eyebrow ? (
            <motion.p
              className="inline-flex rounded-full bg-[var(--landing-primary)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--landing-inverse)] shadow-sm sm:text-xs"
              variants={itemVariants}
            >
              {eyebrow}
            </motion.p>
          ) : null}

          <motion.div className="mt-2 w-full overflow-hidden pb-2" variants={itemVariants}>
            <motion.h1
              className="mx-auto max-w-[1220px] text-[clamp(3.5rem,8vw,8.4rem)] font-medium leading-[0.84] tracking-[-0.055em] text-[var(--landing-primary)] [font-family:var(--font-echo-display)] [text-wrap:balance]"
              variants={titleVariants}
            >
              {title}
            </motion.h1>
          </motion.div>

          <motion.p
            className="mt-5 max-w-2xl text-sm font-medium leading-6 text-[var(--landing-ink)] sm:text-[15px] sm:leading-6"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          <motion.div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row" variants={itemVariants}>
            {actions.map((action) => {
              const primary = action.variant === "primary";

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "inline-flex min-h-12 min-w-48 items-center justify-center rounded-full px-6 text-sm font-bold outline-none transition-[transform,background-color,border-color] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97]",
                    primary
                      ? "bg-[var(--landing-primary)] text-[var(--landing-inverse)] hover:bg-[var(--landing-primary-hover)]"
                      : "border border-[var(--landing-primary-45)] bg-[var(--landing-cream-35)] text-[var(--landing-primary)] backdrop-blur-sm hover:bg-[var(--landing-cream-65)]",
                  )}
                >
                  {action.text}
                </Link>
              );
            })}
          </motion.div>

          <motion.div className="mt-11 w-full max-w-xl text-left" variants={itemVariants}>
            <p className="inline-flex rounded-full bg-[var(--landing-inverse-85)] px-3 py-1.5 text-xs font-bold text-[var(--landing-ink)] shadow-sm backdrop-blur-sm">
              What makes ECHO different?
            </p>
            <div
              data-testid="hero-stats-panel"
              className="mt-3 grid gap-2.5 rounded-[var(--landing-panel-radius)] border border-white/35 bg-[#f8f2e6]/90 p-3 shadow-[0_12px_36px_rgba(41,49,27,0.14)] backdrop-blur-md sm:grid-cols-3 sm:gap-3 sm:p-4"
            >
              {stats.map((stat) => {
                const Icon = statIcons[stat.icon];

                return (
                  <div key={stat.label} className="flex items-center gap-2.5 text-[var(--landing-ink)]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--landing-inverse)] text-[var(--landing-primary)] shadow-sm [&_svg]:h-4 [&_svg]:w-4">
                      <Icon aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xs font-extrabold leading-4">{stat.value}</span>
                      <span className="block text-[10px] font-semibold leading-4 text-[var(--landing-ink-80)]">{stat.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
