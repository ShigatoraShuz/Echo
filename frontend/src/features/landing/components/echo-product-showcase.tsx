"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import { BookOpen, CalendarDays, LayoutDashboard, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { ContainerScroll } from "@/shared/components/ui/container-scroll-animation";

interface ShowcaseImage {
  src: string;
  alt: string;
  label: string;
  icon: LucideIcon;
}

const showcaseImages: ShowcaseImage[] = [
  {
    src: "/landing/showcase/echo-dashboard-preview.png",
    alt: "ECHO dashboard screen with reflection cards and wellbeing signals.",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    src: "/landing/showcase/echo-journal-preview.png",
    alt: "ECHO journal screen with photo memories and reflection editor.",
    label: "Journal",
    icon: BookOpen,
  },
  {
    src: "/landing/showcase/echo-calendar-preview.png",
    alt: "ECHO reflection calendar modal over the journal screen.",
    label: "Calendar",
    icon: CalendarDays,
  },
  {
    src: "/landing/showcase/echo-privacy-preview.png",
    alt: "ECHO privacy settings screen with safety controls.",
    label: "Privacy",
    icon: ShieldCheck,
  },
];

const summaryItems = [
  ["Journal", "Write or speak what's on your mind."],
  ["AI Insights", "Discover emotional patterns and depression severity estimates from your reflections."],
  ["ECHO Buddy", "Receive supportive, CBT-informed conversational guidance."],
  ["Privacy", "Built with privacy and responsible AI at the center."],
];

export function EchoProductShowcase() {
  return (
    <section className="landing-product-showcase-gradient relative text-[var(--landing-ink)]">
      <ContainerScroll
        className="bg-transparent"
        titleComponent={
          <EchoReveal variant="text" direction="none">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--landing-primary)]">
              Explore ECHO
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl font-[family-name:var(--font-echo-display)] text-3xl font-medium leading-tight text-[var(--landing-primary)] sm:text-4xl lg:text-5xl">
              Everything you need to understand your reflections.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--landing-ink-75)] sm:text-base">
              Write, speak, reflect, and discover patterns in one private space designed to support your mental well-being.
            </p>
          </EchoReveal>
        }
      >
        {(scrollYProgress) => <ShowcaseImageDeck scrollYProgress={scrollYProgress} />}
      </ContainerScroll>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 pt-6 sm:px-6 md:pt-10 lg:grid-cols-3 lg:px-8">
        <EchoReveal variant="card" className="h-full lg:col-span-1">
          <div className="h-full rounded-[1.4rem] border border-[var(--landing-primary-10)] bg-[var(--landing-cream-95)] p-5 shadow-[0_18px_44px_rgba(23,45,37,0.08)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--landing-primary-10)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--landing-primary)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private by design
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-echo-display)] text-2xl text-[var(--landing-primary)]">
              One space. Multiple ways to reflect.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--landing-ink-75)]">
              Designed around privacy-first and edge-based processing, with non-diagnostic language throughout the experience.
            </p>
          </div>
        </EchoReveal>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {summaryItems.map(([title, description], index) => (
            <EchoReveal key={title} variant="card" delay={index * 65} className="h-full">
              <article className="h-full rounded-[1.25rem] border border-[var(--landing-primary-10)] bg-white/60 p-4 shadow-[0_12px_30px_rgba(23,45,37,0.06)]">
                <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--landing-primary)]">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--landing-ink-75)]">{description}</p>
              </article>
            </EchoReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseImageDeck({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  return (
    <div className="relative h-full overflow-hidden bg-[#eef5ea] text-left">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(143,200,154,0.26),transparent_28rem),radial-gradient(circle_at_88%_14%,rgba(251,247,238,0.72),transparent_30rem)]" />

      <div className="relative h-full p-3 sm:p-4 lg:p-5">
        <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-[#536733]/14 bg-[#fcfaf6] shadow-[0_22px_65px_rgba(23,45,37,0.14)]">
          {showcaseImages.map((image, index) => (
            <ShowcaseSlide
              key={image.src}
              image={image}
              index={index}
              scrollYProgress={scrollYProgress}
              priority={index === 0}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(13,33,26,0.22))]" />
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-[#fffaf0]/82 px-2.5 py-2 shadow-[0_10px_28px_rgba(23,45,37,0.12)] backdrop-blur-md">
            {showcaseImages.map((image, index) => (
              <ShowcaseProgressPill
                key={image.label}
                image={image}
                index={index}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseProgressPill({
  image,
  index,
  scrollYProgress,
}: {
  image: ShowcaseImage;
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  const Icon = image.icon;
  const opacity = useTransform(
    scrollYProgress,
    [0, index * 0.2 + 0.1, index * 0.2 + 0.2, 1],
    index === 0 ? [1, 1, 0.42, 0.42] : [0.42, 0.42, 1, index === showcaseImages.length - 1 ? 1 : 0.42],
  );

  return (
    <motion.span
      style={{ opacity }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-black text-[#536733]"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {image.label}
    </motion.span>
  );
}

function ShowcaseSlide({
  image,
  index,
  scrollYProgress,
  priority,
}: {
  image: ShowcaseImage;
  index: number;
  scrollYProgress: MotionValue<number>;
  priority?: boolean;
}) {
  const Icon = image.icon;
  const start = index * 0.2;
  const activeStart = start + 0.1;
  const activeEnd = activeStart + 0.16;
  const fadeEnd = activeEnd + 0.1;
  const opacity = useTransform(
    scrollYProgress,
    [Math.max(0, start - 0.04), activeStart, activeEnd, Math.min(1, fadeEnd)],
    index === 0 ? [1, 1, 0, 0] : [0, 1, 1, index === showcaseImages.length - 1 ? 1 : 0],
  );
  const scale = useTransform(scrollYProgress, [start, activeEnd], [1.035, 1]);
  const y = useTransform(scrollYProgress, [start, activeEnd], [24, 0]);

  return (
    <motion.article
      style={{ opacity, scale, y }}
      className="absolute inset-0"
      aria-hidden={index > 0 ? true : undefined}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        className="object-cover object-left-top"
        sizes="(min-width: 1024px) 980px, 100vw"
      />
      <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-[#fffaf0]/88 px-3 py-2 text-xs font-bold text-[#536733] shadow-[0_10px_28px_rgba(23,45,37,0.12)] backdrop-blur-md">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {image.label}
      </span>
    </motion.article>
  );
}
