"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Bot,
  CalendarDays,
  Database,
  LayoutDashboard,
  LockKeyhole,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
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

      <div className="relative isolate overflow-hidden bg-[#f6f5e9] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgba(218,238,182,0.72),transparent_70%)]" />
        <div className="pointer-events-none absolute -left-40 top-72 -z-10 h-96 w-96 rounded-full bg-[#e0ecd0]/55 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-20 -z-10 h-96 w-96 rounded-full bg-[#fff7ce]/60 blur-3xl" />

        <div className="mx-auto max-w-7xl">
          <EchoReveal variant="text" direction="none" className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-primary-15)] bg-[#fffdf5]/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--landing-primary)] shadow-[0_8px_24px_rgba(45,67,31,0.05)] backdrop-blur-sm sm:text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private by design
            </div>
            <h3 className="mt-7 font-[family-name:var(--font-echo-display)] text-[clamp(2.6rem,5vw,5.1rem)] font-medium leading-[0.98] tracking-[-0.035em] text-[var(--landing-primary)] [text-wrap:balance]">
              Reflect in the way that feels natural.
            </h3>
            <p className="mx-auto mt-6 max-w-2xl text-sm font-medium leading-7 text-[var(--landing-ink-75)] sm:text-base">
              Write, speak, notice patterns, or talk things through. ECHO supports reflection with privacy-conscious technology and language designed to inform—not diagnose.
            </p>
          </EchoReveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-12 lg:gap-5">
            <EchoReveal variant="card" className="h-full lg:col-span-7">
              <JournalFeatureCard />
            </EchoReveal>
            <EchoReveal variant="card" delay={65} className="h-full lg:col-span-5">
              <InsightsFeatureCard />
            </EchoReveal>
            <EchoReveal variant="card" delay={65} className="h-full lg:col-span-5">
              <BuddyFeatureCard />
            </EchoReveal>
            <EchoReveal variant="card" delay={130} className="h-full lg:col-span-7">
              <PrivacyFeatureCard />
            </EchoReveal>
          </div>

          <EchoReveal variant="text" delay={130}>
            <div className="mt-8 flex justify-center">
              <Link
                href="/privacy-policy"
                className="group inline-flex min-h-11 items-center gap-2 border-b border-[var(--landing-primary-25)] px-1 text-sm font-bold text-[var(--landing-primary)] outline-none transition-[border-color,color,transform] duration-150 ease-out hover:border-[var(--landing-primary)] hover:text-[var(--landing-primary-hover)] focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97]"
              >
                See how ECHO protects your reflections
                <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </EchoReveal>
        </div>
      </div>
    </section>
  );
}

function FeatureHeading({ number, title, inverse = false }: { number: string; title: string; inverse?: boolean }) {
  return (
    <h4 className={`flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.18em] ${inverse ? "text-[#fffaf0]" : "text-[var(--landing-primary)]"}`}>
      <span className={`font-[family-name:var(--font-echo-display)] text-base font-semibold tracking-normal ${inverse ? "text-[#cfe0a9]" : "text-[#76934e]"}`}>
        {number}
      </span>
      {title}
    </h4>
  );
}

function JournalFeatureCard() {
  const waveform = [12, 22, 15, 32, 18, 27, 12, 38, 19, 29, 15, 24, 11, 31, 18, 25, 13, 20];

  return (
    <article className="group relative h-full min-h-[360px] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[rgba(252,251,244,0.86)] p-6 shadow-[0_18px_50px_rgba(49,67,35,0.09)] sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_35%,rgba(220,235,207,0.58),transparent_45%)]" />
      <div className="relative grid h-full gap-8 md:grid-cols-[0.78fr_1.5fr] md:items-center">
        <div className="flex h-full flex-col">
          <FeatureHeading number="01" title="Journal" />
          <p className="mt-5 max-w-[15rem] text-base font-medium leading-7 text-[var(--landing-ink-82)]">
            Capture what&apos;s on your mind through writing or voice, at your own pace.
          </p>
          <div className="mt-auto flex items-center gap-3 pt-9" aria-hidden="true">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[5px] border-[#fffdf7] bg-[var(--landing-primary)] text-white shadow-[0_8px_20px_rgba(42,66,31,0.2)]">
              <Mic className="h-5 w-5" />
            </span>
            <div className="flex h-10 flex-1 items-center gap-[3px] overflow-hidden">
              {waveform.map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-[2px] shrink-0 rounded-full bg-[#8da46d] opacity-80"
                  style={{ height }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-[#fffdf8]/95 shadow-[0_14px_34px_rgba(44,62,32,0.1)] transition-transform duration-200 ease-out group-hover:-translate-y-1">
          <div className="flex items-center justify-between border-b border-[var(--landing-primary-10)] px-5 py-4 text-[10px] font-semibold text-[var(--landing-muted)] sm:text-xs">
            <span>May 14, 2025&nbsp; · &nbsp;9:24 AM</span>
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Private</span>
          </div>
          <div className="grid grid-cols-[1fr_78px] gap-4 p-5 sm:grid-cols-[1fr_92px]">
            <div>
              <p className="text-xs font-medium leading-6 text-[var(--landing-ink-80)]">
                I felt overwhelmed this morning, but a short walk helped me reset. Grateful for small moments of calm.
              </p>
              <div className="mt-4 space-y-3" aria-hidden="true">
                <span className="block h-1.5 w-full rounded-full bg-[var(--landing-primary-10)]" />
                <span className="block h-1.5 w-[86%] rounded-full bg-[var(--landing-primary-10)]" />
                <span className="block h-1.5 w-[62%] rounded-full bg-[var(--landing-primary-10)]" />
              </div>
            </div>
            <div className="relative min-h-32 overflow-hidden rounded-[1rem] bg-[linear-gradient(145deg,#eef4e6,#b5c8a1)]">
              <div className="absolute -bottom-5 -right-5 h-24 w-24 rounded-full bg-[#6e8d55]/45 blur-xl" />
              <div className="absolute bottom-0 left-0 h-20 w-full bg-[linear-gradient(145deg,transparent,#63804d)] opacity-55 [clip-path:polygon(0_75%,28%_42%,46%_63%,72%_24%,100%_55%,100%_100%,0_100%)]" />
              <Sparkles className="absolute right-3 top-3 h-4 w-4 text-white/85" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function InsightsFeatureCard() {
  return (
    <article className="group h-full min-h-[360px] overflow-hidden rounded-[1.75rem] border border-white/75 bg-[linear-gradient(145deg,rgba(234,242,216,0.96),rgba(244,247,229,0.9))] p-6 shadow-[0_18px_50px_rgba(49,67,35,0.09)] sm:p-8">
      <FeatureHeading number="02" title="AI insights" />
      <p className="mt-5 max-w-sm text-base font-medium leading-7 text-[var(--landing-ink-82)]">
        Notice recurring emotions, themes, and changes across your reflections.
      </p>
      <div className="mt-8 rounded-[1.25rem] border border-white/70 bg-white/[0.28] p-4 transition-transform duration-200 ease-out group-hover:-translate-y-1 sm:p-5">
        <div className="grid grid-cols-[44px_1fr] gap-3">
          <div className="flex flex-col justify-between py-1 text-[9px] font-semibold text-[var(--landing-muted)]">
            <span>Calm</span><span>Neutral</span><span>Tense</span><span>Heavy</span>
          </div>
          <svg viewBox="0 0 360 126" className="h-32 w-full overflow-visible" role="img" aria-label="A sample chart showing emotional patterns changing over time">
            <path d="M4 24 C48 24 48 56 92 54 S150 58 184 35 S240 30 268 42 S322 49 356 47" fill="none" stroke="#496b2b" strokeWidth="2" />
            <path d="M4 55 C38 59 61 82 101 76 S158 74 192 61 S247 57 280 67 S323 76 356 78" fill="none" stroke="#8ea86d" strokeWidth="2" />
            <path d="M4 88 C38 93 65 112 108 108 S157 105 196 91 S248 91 281 101 S326 102 356 98" fill="none" stroke="#dfbd64" strokeWidth="2" />
            {[[4,24],[92,54],[184,35],[268,42],[356,47]].map(([cx, cy]) => <circle key={`calm-${cx}`} cx={cx} cy={cy} r="4" fill="#496b2b" />)}
            {[[4,55],[101,76],[192,61],[280,67],[356,78]].map(([cx, cy]) => <circle key={`neutral-${cx}`} cx={cx} cy={cy} r="4" fill="#8ea86d" />)}
            {[[4,88],[108,108],[196,91],[281,101],[356,98]].map(([cx, cy]) => <circle key={`heavy-${cx}`} cx={cx} cy={cy} r="4" fill="#dfbd64" />)}
          </svg>
        </div>
        <div className="ml-14 mt-2 flex justify-between text-[9px] font-medium text-[var(--landing-muted)]">
          <span>May 8</span><span>May 15</span><span>May 22</span><span>May 29</span><span>Jun 5</span>
        </div>
      </div>
    </article>
  );
}

function BuddyFeatureCard() {
  return (
    <article className="group relative h-full min-h-[300px] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[rgba(250,249,239,0.9)] p-6 shadow-[0_18px_50px_rgba(49,67,35,0.09)] sm:p-8">
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-[#e8efd9] blur-3xl" />
      <div className="relative grid h-full gap-6 sm:grid-cols-[0.9fr_1.15fr] sm:items-center">
        <div>
          <FeatureHeading number="03" title="ECHO Buddy" />
          <p className="mt-5 text-base font-medium leading-7 text-[var(--landing-ink-82)]">
            Gentle, CBT-informed prompts for reflection and practical next steps.
          </p>
          <Bot className="mt-8 h-8 w-8 text-[#71924b]" aria-hidden="true" />
        </div>
        <div className="space-y-3 transition-transform duration-200 ease-out group-hover:-translate-y-1" aria-label="Example supportive conversation">
          <div className="ml-auto max-w-[15rem] rounded-[1.15rem_1.15rem_0.35rem_1.15rem] bg-[#e8f0c9] px-4 py-3 text-xs font-medium leading-5 text-[var(--landing-ink-80)] shadow-[0_8px_20px_rgba(49,67,35,0.07)]">
            What&apos;s one small step I could take for myself today?
          </div>
          <div className="mr-auto max-w-[15rem] rounded-[1.15rem_1.15rem_1.15rem_0.35rem] bg-[#fffaf0] px-4 py-3 text-xs font-medium leading-5 text-[var(--landing-ink-80)] shadow-[0_8px_20px_rgba(49,67,35,0.08)]">
            Maybe a 10-minute break, or saying no to one thing.
          </div>
          <div className="flex justify-end gap-2 text-[#88a263]" aria-hidden="true">
            <AudioLines className="h-5 w-5" /><Sparkles className="h-4 w-4" />
          </div>
        </div>
      </div>
    </article>
  );
}

function PrivacyFeatureCard() {
  const safeguards = [
    { label: "Local-first", icon: Database },
    { label: "Your consent", icon: UserRoundCheck },
    { label: "In your control", icon: SlidersHorizontal },
  ];

  return (
    <article className="group relative h-full min-h-[300px] overflow-hidden rounded-[1.75rem] border border-[#6d8751]/40 bg-[#173f28] p-6 text-[#fffaf0] shadow-[0_24px_60px_rgba(18,52,32,0.2)] sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(113,146,75,0.24),transparent_38%),radial-gradient(circle_at_86%_100%,rgba(143,171,99,0.18),transparent_40%)]" />
      <LockKeyhole className="pointer-events-none absolute -bottom-12 right-2 h-64 w-64 text-white/[0.08] transition-transform duration-200 ease-out group-hover:-translate-y-1" strokeWidth={0.7} aria-hidden="true" />
      <div className="relative">
        <FeatureHeading number="04" title="Your privacy" inverse />
        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          <span className="grid h-16 w-16 place-items-center rounded-[1.35rem] border border-[#cfe0b3]/35 bg-white/[0.06] text-[#e3efca]">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-base font-medium leading-7 text-[#f6f2e8]/88">
            Clear consent, transparent processing, and settings that keep you in control.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {safeguards.map(({ label, icon: Icon }) => (
            <div key={label} className="flex min-h-[4rem] items-center gap-3 rounded-[1rem] border border-white/[0.06] bg-white/[0.07] px-4 text-sm font-semibold text-[#fffaf0] backdrop-blur-sm">
              <Icon className="h-5 w-5 shrink-0 text-[#dce9be]" aria-hidden="true" />
              {label}
              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#e6cf55]" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </article>
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
