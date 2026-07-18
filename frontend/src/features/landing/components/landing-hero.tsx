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
