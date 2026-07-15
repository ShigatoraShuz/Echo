"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import { ArrowRight, Leaf, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import styles from "./hero-3.module.css";

interface AnimatedMarqueeHeroProps {
  tagline: string;
  title: ReactNode;
  description: string;
  ctaText: string;
  images: string[];
  ctaHref?: string;
  className?: string;
}

const contentVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(18px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.58, ease: [0.23, 1, 0.32, 1] },
  },
};

function MarqueeRow({ images, reverse = false, paused = false }: { images: string[]; reverse?: boolean; paused?: boolean }) {
  const repeatedGroups = [images, images];

  return (
    <div className={styles.marqueeViewport}>
      <div className={cn(styles.marqueeTrack, reverse && styles.marqueeTrackReverse, paused && styles.marqueePaused)}>
        {repeatedGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={styles.marqueeGroup} aria-hidden={groupIndex === 1 || undefined}>
            {group.map((src, index) => (
              <div key={`${groupIndex}-${src}-${index}`} className={cn(styles.imageCard, reverse && styles.imageCardSmall)}>
                <Image
                  src={src}
                  alt={groupIndex === 0 ? "A calm space supporting reflection and emotional wellbeing." : ""}
                  fill
                  className="object-cover"
                  sizes={reverse ? "(min-width: 1024px) 15rem, 10rem" : "(min-width: 1024px) 19rem, 12rem"}
                  priority={src.includes("photo-1513694203232-719a280e022f")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b2114]/30 to-transparent" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnimatedMarqueeHero({
  tagline,
  title,
  description,
  ctaText,
  images,
  ctaHref = "/signup",
  className,
}: AnimatedMarqueeHeroProps) {
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const firstRow = images.filter((_, index) => index % 2 === 0);
  const secondRow = images.filter((_, index) => index % 2 === 1);

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
      <section className={cn("relative overflow-hidden bg-[#102b1b] py-16 text-[#f4f8f4] sm:py-20 lg:py-24", className)}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(113,168,124,0.24),transparent_38%),linear-gradient(180deg,transparent,rgba(4,18,10,0.28))]" />

        <motion.div
          className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6"
          variants={contentVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.55 }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b8d8bf] backdrop-blur-sm">
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            {tagline}
          </p>
          <h2 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
            {description}
          </p>
          <Link
            href={ctaHref}
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f4f8f4] px-6 text-sm font-semibold text-[#102b1b] shadow-soft transition-[transform,background-color] duration-150 ease-out hover:bg-white focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97]"
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </motion.div>

        <div className="relative z-10 mx-auto mt-10 flex max-w-[1440px] justify-end px-4 sm:px-6 lg:px-8 xl:px-10">
          <button
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white/75 backdrop-blur-sm transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/15 hover:text-white focus-visible:ring-4 focus-visible:ring-white/25 active:scale-[0.97]"
            aria-pressed={isPaused}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            {isPaused ? "Play image carousel" : "Pause image carousel"}
          </button>
        </div>

        <div className="relative z-10 mt-4 space-y-4" aria-label="ECHO wellness image carousel">
          <MarqueeRow images={firstRow} paused={isPaused} />
          <MarqueeRow images={secondRow} reverse paused={isPaused} />
        </div>

        <p className="relative z-10 mx-auto mt-8 max-w-2xl px-6 text-center text-xs leading-5 text-white/45">
          ECHO supports reflection and wellbeing organization. It is not a diagnostic tool or emergency service.
        </p>
      </section>
    </MotionConfig>
  );
}
