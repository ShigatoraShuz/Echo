"use client";

import Image from "next/image";
import Link from "next/link";
import { MotionConfig, motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

interface HeroStat {
  value: string;
  label: string;
  icon: ReactNode;
}

interface HeroAction {
  text: string;
  href: string;
  variant?: ButtonProps["variant"];
  className?: string;
}

interface HeroImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface HeroSectionProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle: string;
  actions: HeroAction[];
  stats: HeroStat[];
  images: HeroImage[];
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.08, staggerChildren: 0.09 },
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

const imageContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.22, staggerChildren: 0.11 },
  },
};

const imageVariants: Variants = {
  hidden: {
    opacity: 0,
    clipPath: "inset(0 0 100% 0 round 1.75rem)",
    transform: "scale(0.97) translateY(18px)",
  },
  visible: {
    opacity: 1,
    clipPath: "inset(0 0 0% 0 round 1.75rem)",
    transform: "scale(1) translateY(0px)",
    transition: { duration: 0.78, ease: [0.23, 1, 0.32, 1] },
  },
};

const imageDepthVariants: Variants = {
  hidden: { transform: "scale(1.07)" },
  visible: {
    transform: "scale(1)",
    transition: { duration: 1.05, ease: [0.23, 1, 0.32, 1] },
  },
};

const decorationVariants: Variants = {
  hidden: { opacity: 0, transform: "scale(0.9)" },
  visible: {
    opacity: 1,
    transform: "scale(1)",
    transition: { duration: 0.7, delay: 0.12, ease: [0.23, 1, 0.32, 1] },
  },
};

export default function HeroSection({
  eyebrow,
  title,
  subtitle,
  actions,
  stats,
  images,
  className,
}: HeroSectionProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
    <section className={cn("relative w-full overflow-hidden bg-background", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,hsl(var(--primary)/0.14),transparent_30%),radial-gradient(circle_at_12%_78%,hsl(var(--secondary)/0.8),transparent_32%)]" />

      <div className="relative mx-auto grid min-h-[680px] max-w-[1440px] grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:px-8 lg:py-24 xl:px-10">
        <motion.div
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {eyebrow ? (
            <motion.p
              className="mb-5 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary"
              variants={itemVariants}
            >
              {eyebrow}
            </motion.p>
          ) : null}

          <motion.div className="overflow-hidden pb-1" variants={itemVariants}>
            <motion.h1
              className="max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-7xl"
              variants={titleVariants}
            >
              {title}
            </motion.h1>
          </motion.div>

          <motion.p
            className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row lg:justify-start"
            variants={itemVariants}
          >
            {actions.map((action) => (
              <Button key={action.href} asChild variant={action.variant} size="lg" className={action.className}>
                <Link href={action.href}>{action.text}</Link>
              </Button>
            ))}
          </motion.div>

          <motion.div
            className="mt-10 grid w-full grid-cols-1 gap-4 border-t border-border/70 pt-6 sm:grid-cols-3"
            variants={itemVariants}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="flex items-center justify-center gap-3 lg:justify-start"
                initial={{ opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.4, delay: 0.55 + index * 0.06, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  {stat.icon}
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative mx-auto h-[410px] w-full max-w-[650px] sm:h-[520px]"
          variants={imageContainerVariants}
          initial="hidden"
          animate="visible"
          aria-label="Calm spaces for private reflection"
        >
          <motion.div className="absolute left-[8%] top-[7%] h-28 w-28 rounded-full bg-primary/10 sm:h-36 sm:w-36" variants={decorationVariants} />
          <motion.div className="absolute bottom-[6%] right-[8%] h-24 w-24 rounded-[2rem] bg-secondary sm:h-32 sm:w-32" variants={decorationVariants} />

          <div className="absolute left-1/2 top-0 z-10 w-[54%] -translate-x-1/2">
            <motion.div
              className="overflow-hidden rounded-[2rem] border-4 border-card bg-card p-1 shadow-soft"
              variants={imageVariants}
            >
              <motion.div variants={imageDepthVariants}>
                <Image
                  src={images[0].src}
                  alt={images[0].alt}
                  width={images[0].width}
                  height={images[0].height}
                  className="aspect-[4/5] h-full w-full rounded-[1.6rem] object-cover"
                  sizes="(min-width: 1024px) 28vw, 54vw"
                  priority
                />
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            className="absolute right-0 top-[35%] z-20 w-[43%] overflow-hidden rounded-[1.7rem] border-4 border-card bg-card p-1 shadow-soft"
            variants={imageVariants}
          >
            <motion.div variants={imageDepthVariants}>
              <Image
                src={images[1].src}
                alt={images[1].alt}
                width={images[1].width}
                height={images[1].height}
                className="aspect-square h-full w-full rounded-[1.35rem] object-cover"
                sizes="(min-width: 1024px) 22vw, 43vw"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute bottom-0 left-0 z-20 w-[39%] overflow-hidden rounded-[1.5rem] border-4 border-card bg-card p-1 shadow-soft"
            variants={imageVariants}
          >
            <motion.div variants={imageDepthVariants}>
              <Image
                src={images[2].src}
                alt={images[2].alt}
                width={images[2].width}
                height={images[2].height}
                className="aspect-[4/3] h-full w-full rounded-[1.15rem] object-cover"
                sizes="(min-width: 1024px) 20vw, 39vw"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
    </MotionConfig>
  );
}
