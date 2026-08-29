import Link from "next/link";
import {
  BookOpenText,
  Eye,
  Feather,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const trustItems: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Private by design",
    body: "Journal content is treated as sensitive private data and access is scoped to your account.",
    icon: ShieldCheck,
  },
  {
    title: "AI is always optional",
    body: "Only entries you actively select are processed for optional AI-assisted reflection.",
    icon: Sparkles,
  },
  {
    title: "Built around your choices",
    body: "Review your preferences, optional AI settings, exports, and deletion choices in settings.",
    icon: SlidersHorizontal,
  },
];

const purposeCards: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "A space to reflect",
    body: "Private journaling and thoughtful prompts help you explore what matters, at your own pace.",
    icon: BookOpenText,
  },
  {
    title: "Patterns made clearer",
    body: "Optional summaries and mood patterns can help you notice recurring themes with gentle perspective.",
    icon: Sparkles,
  },
  {
    title: "Support on your terms",
    body: "You decide what to write, which entries to analyze, and how you want reflective support to look.",
    icon: SlidersHorizontal,
  },
];

const helpStages = [
  {
    title: "Write freely",
    body: "Capture your day, your feelings, and the small moments that shape how you feel.",
  },
  {
    title: "Notice gently",
    body: "When you choose optional insights, ECHO can surface summaries and mood patterns you may have missed.",
  },
  {
    title: "Choose what comes next",
    body: "Use what you notice to set your own intentions and take steps that feel right for you.",
  },
];

function JourneyArtwork() {
  return (
    <div
      className="relative mx-auto aspect-[1/1.04] w-full max-w-[520px]"
      aria-label="A four-step reflection journey: write, notice, understand, and grow"
    >
      <svg
        viewBox="0 0 520 540"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <g stroke="#c7d896" strokeOpacity=".12">
          <circle cx="260" cy="276" r="184" />
          <circle cx="260" cy="276" r="145" />
          <circle cx="260" cy="276" r="104" />
        </g>
        <g stroke="#c8d996" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M170 106c22-15 47-24 72-28" />
          <path d="m232 72 12 5-9 10" />
          <path d="M366 129c22 14 41 34 54 57" />
          <path d="m415 176 6 12-13-1" />
          <path d="M407 357c-14 23-34 43-57 57" />
          <path d="m361 410-13 5 3-13" />
          <path d="M157 408c-22-15-40-35-52-59" />
          <path d="m110 362-6-14 14 2" />
        </g>
        <g
          transform="translate(171 197) rotate(-7 90 75)"
          stroke="#d7dfa6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M88 15C62 1 29 4 5 18v113c28-14 58-14 85 2 27-16 57-16 85-2V18c-24-14-57-17-85-3Z" fill="#143c2c" />
          <path d="M90 16v116" />
          <path d="M21 39c19-7 35-6 54 0M21 59c19-7 35-6 54 0M21 79c19-7 35-6 54 0" strokeOpacity=".26" />
          <path d="M116 103c5-25 15-45 34-62M120 84c-8-11-8-22-2-32 10 9 10 20 2 32ZM135 67c10-1 19-7 25-16-11-3-20 3-25 16ZM128 90c9 0 17 5 22 13-10 3-18-2-22-13Z" />
        </g>
        <g stroke="#aec77c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".75">
          <path d="M454 133c21-30 30-62 26-98M457 110c-18-5-28-15-32-30 17 2 28 12 32 30ZM470 83c13-9 20-22 20-38-15 6-22 19-20 38ZM448 128c16 0 29 6 38 19-17 3-30-3-38-19Z" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-[3%] w-36 -translate-x-1/2 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#bcd08c] text-[#ccdc9d]">
          <Feather className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-2 text-sm font-bold text-[#fffaf0]">Write</h3>
        <p className="mt-1 text-[10px] leading-4 text-white/65">Put your thoughts onto the page.</p>
      </div>
      <div className="absolute right-[0%] top-[38%] w-32 text-center sm:right-[2%]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#bcd08c] text-[#ccdc9d]">
          <Eye className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-2 text-sm font-bold text-[#fffaf0]">Notice</h3>
        <p className="mt-1 text-[10px] leading-4 text-white/65">Spot what&apos;s showing up.</p>
      </div>
      <div className="absolute bottom-[0%] left-1/2 w-40 -translate-x-1/2 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#bcd08c] text-[#ccdc9d]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-2 text-sm font-bold text-[#fffaf0]">Understand</h3>
        <p className="mt-1 text-[10px] leading-4 text-white/65">See patterns with kind perspective.</p>
      </div>
      <div className="absolute left-[0%] top-[38%] w-32 text-center sm:left-[2%]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#bcd08c] text-[#ccdc9d]">
          <Sprout className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-2 text-sm font-bold text-[#fffaf0]">Grow</h3>
        <p className="mt-1 text-[10px] leading-4 text-white/65">Take small steps that fit you.</p>
      </div>
    </div>
  );
}

function JournalArtwork() {
  return (
    <svg viewBox="0 0 600 440" className="h-auto w-full" fill="none" aria-hidden="true" focusable="false">
      <g stroke="#bfd08d" strokeOpacity=".15">
        <circle cx="310" cy="236" r="186" />
        <circle cx="310" cy="236" r="158" />
        <circle cx="310" cy="236" r="128" />
        <circle cx="310" cy="236" r="98" />
      </g>
      <circle cx="392" cy="173" r="104" fill="#93a263" fillOpacity=".36" />
      <g
        transform="translate(130 128) rotate(-7 150 105)"
        stroke="#5d6749"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M148 12C102-5 48 2 6 25v167c47-22 96-19 145 5 49-24 98-27 145-5V25c-42-23-96-30-148-13Z"
          fill="#f1ead7"
        />
        <path d="M151 13v183" />
        <path
          d="M27 54c34-11 65-10 96 0M27 78c34-11 65-10 96 0M27 102c34-11 65-10 96 0M27 126c34-11 65-10 96 0"
          strokeOpacity=".26"
        />
        <path d="M192 163c8-50 27-86 61-116M201 126c-15-18-16-36-5-52 17 14 19 31 5 52ZM226 94c20-2 36-12 47-28-22-4-38 6-47 28ZM212 137c18-1 33 8 43 24-20 4-34-4-43-24Z" />
      </g>
      <g transform="translate(409 247) rotate(11 70 83)" stroke="#7d816b" strokeWidth="1.5">
        <path d="M5 3h130v160H5z" fill="#f8f1df" />
        <path d="M26 35h82M26 52h82M26 69h67M26 86h75M26 103h48" strokeOpacity=".55" />
        <circle cx="99" cy="132" r="18" stroke="#b6bd89" />
        <path d="m91 132 6 6 11-14" stroke="#929f65" />
      </g>
      <g stroke="#a9c77c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M78 115c50-60 94-79 149-85M109 82c-19-2-34-11-43-27 20-2 35 7 43 27ZM143 58c-2-19 5-35 20-47 4 20-3 36-20 47Z" />
        <path d="M290 398c80 3 139-16 196-60M359 386c-3-19 4-35 19-47 5 20-2 36-19 47ZM402 373c16-10 33-12 51-5-13 15-30 17-51 5ZM450 352c6-17 18-28 35-33 0 19-12 30-35 33Z" />
      </g>
    </svg>
  );
}

function AboutCard({
  title,
  body,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
  delay?: number;
}) {
  return (
    <EchoReveal direction="up" variant="card" delay={delay} duration={540} className="h-full">
      <article className="flex h-full min-h-[205px] flex-col rounded-[18px] border border-[#d9ddd2] bg-[#fbf8f1] p-6 shadow-[0_8px_24px_rgba(35,71,53,0.035)]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#dde8d5] text-[#285d46]">
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-[1.55rem] font-medium leading-tight [font-family:var(--font-echo-display)]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#65746b]">{body}</p>
      </article>
    </EchoReveal>
  );
}

export function AboutPageView() {
  return (
    <div className="overflow-x-clip bg-[#f7f3ea] text-[#173b2b] [font-family:var(--font-echo-sans)]">
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-8 pt-28 sm:px-8 sm:pt-32 lg:px-10 lg:pt-32">
        <section
          className="grid gap-9 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-14"
          aria-labelledby="about-title"
        >
          <EchoReveal direction="up" variant="text" duration={560} className="max-w-lg lg:pt-6">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#285d46]">
              <Leaf className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              About ECHO
            </p>
            <h1
              id="about-title"
              className="mt-5 text-[3rem] font-medium leading-[0.9] tracking-[-0.055em] text-[#123526] [font-family:var(--font-echo-display)] sm:text-[4.25rem] lg:text-[4.6rem]"
            >
              A quieter place <br />
              to understand <br />
              yourself.
              <Leaf className="ml-1 inline h-8 w-8 -rotate-12 text-[#56743b]" strokeWidth={1.2} aria-hidden="true" />
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-[#65746b]">
              ECHO brings private journaling, thoughtful prompts, and optional pattern insights together—so reflection
              feels clearer, calmer, and entirely your own.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/journal/new"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#123526] px-6 text-sm font-bold text-[#fffaf0] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[#1d4934] focus-visible:ring-4 focus-visible:ring-[#123526]/20 active:scale-[0.97]"
              >
                Start reflecting
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#bfc7b9] bg-[#fbf8f1] px-6 text-sm font-bold text-[#234735] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[#eef1e8] focus-visible:ring-4 focus-visible:ring-[#123526]/15 active:scale-[0.97]"
              >
                See how it works
              </Link>
            </div>
          </EchoReveal>

          <EchoReveal
            direction="up"
            variant="card"
            delay={70}
            duration={560}
            className="relative overflow-hidden rounded-[22px] bg-[#0d2e20] px-4 pb-5 pt-6 text-[#fbf8f1] shadow-[0_18px_44px_rgba(13,46,32,0.13)] sm:px-7 sm:pt-7"
          >
            <h2 className="relative z-10 text-center text-[2rem] font-medium leading-none [font-family:var(--font-echo-display)]">
              Reflection, made gentler.
            </h2>
            <JourneyArtwork />
          </EchoReveal>
        </section>

        <EchoReveal direction="up" variant="card" duration={620}>
          <section
            className="mt-8 rounded-[18px] border border-[#d9ddd2] bg-[#fbf8f1] px-5 py-5 shadow-[0_8px_24px_rgba(35,71,53,0.035)] sm:px-7"
            aria-label="ECHO trust principles"
          >
            <div className="grid gap-5 md:grid-cols-3 md:gap-0">
              {trustItems.map(({ title, body, icon: Icon }, index) => (
                <EchoReveal key={title} direction="up" variant="card" delay={index * 65} duration={560}>
                  <article className={`flex gap-4 md:px-6 ${index ? "md:border-l md:border-[#d9ddd2]" : ""}`}>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dde8d5] text-[#285d46]">
                      <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-[1.25rem] font-medium leading-tight [font-family:var(--font-echo-display)]">
                        {title}
                      </h2>
                      <p className="mt-1.5 text-xs leading-5 text-[#65746b]">{body}</p>
                    </div>
                  </article>
                </EchoReveal>
              ))}
            </div>
          </section>
        </EchoReveal>

        <EchoReveal direction="up" variant="text" duration={560}>
          <section className="py-14 text-center sm:py-16" aria-labelledby="why-echo-title">
          <p className="flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#285d46]">
            <Leaf className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            Why ECHO exists
          </p>
          <h2
            id="why-echo-title"
            className="mx-auto mt-4 max-w-3xl text-[2.5rem] font-medium leading-[0.98] tracking-[-0.04em] [font-family:var(--font-echo-display)] sm:text-[3.25rem]"
          >
            Reflection should feel supportive,
            <br className="hidden sm:block" /> not overwhelming.
            <Leaf className="ml-1 inline h-7 w-7 -rotate-12 text-[#56743b]" strokeWidth={1.2} aria-hidden="true" />
          </h2>
          <p className="mx-auto mt-5 max-w-[680px] text-sm leading-7 text-[#65746b] sm:text-[15px]">
            We built ECHO to be a calm place to pause, write honestly, and recognize patterns over time—so you can
            understand yourself with more clarity and move forward with confidence.
          </p>
          </section>
        </EchoReveal>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Why people use ECHO">
          {purposeCards.map((card, index) => (
            <AboutCard key={card.title} {...card} delay={index * 60} />
          ))}
        </section>

        <EchoReveal direction="up" variant="card" duration={640}>
          <section
            className="relative mt-6 overflow-hidden rounded-[22px] bg-[#0d2e20] px-6 py-8 text-[#fbf8f1] shadow-[0_18px_44px_rgba(13,46,32,0.12)] sm:px-9 sm:py-10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-8 lg:px-11"
            aria-labelledby="how-echo-helps-title"
          >
          <div className="relative z-10">
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c8dc9b]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              How ECHO helps
            </p>
            <h2
              id="how-echo-helps-title"
              className="mt-4 text-[2.4rem] font-medium leading-[0.98] tracking-[-0.035em] [font-family:var(--font-echo-display)] sm:text-[3rem]"
            >
              From a passing thought <br />
              to a clearer next step.
              <Leaf className="ml-1 inline h-7 w-7 -rotate-12 text-[#b9cd8c]" strokeWidth={1.2} aria-hidden="true" />
            </h2>
            <ol className="mt-7 space-y-5">
              {helpStages.map((stage, index) => (
                <li key={stage.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#a8bf72]/50 text-sm font-bold text-[#d5e2ad]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#fffaf0]">{stage.title}</h3>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-white/65">{stage.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative mt-8 lg:mt-0">
            <JournalArtwork />
          </div>
          </section>
        </EchoReveal>

        <section className="py-12 sm:py-14" aria-labelledby="boundaries-title">
          <EchoReveal direction="up" variant="text" duration={560}>
            <h2
              id="boundaries-title"
              className="mx-auto max-w-2xl text-center text-[2.35rem] font-medium leading-[0.98] tracking-[-0.035em] [font-family:var(--font-echo-display)] sm:text-[2.8rem]"
            >
              Clear about what ECHO is—
              <br />
              and what it isn&apos;t.
            </h2>
          </EchoReveal>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <AboutCard
              title="What ECHO does"
              body="ECHO supports private reflection, journaling prompts, and optional summaries or mood patterns for entries you choose to analyze."
              icon={ShieldCheck}
              delay={0}
            />
            <AboutCard
              title="What ECHO doesn’t do"
              body="ECHO is not a diagnostic tool, treatment provider, emergency monitor, or substitute for professional care or trusted human support."
              icon={ShieldCheck}
              delay={60}
            />
          </div>
        </section>

        <EchoReveal direction="up" variant="card" duration={620}>
          <section
            className="relative overflow-hidden rounded-[20px] border border-[#ccd8c5] bg-[#dde8d5] px-6 py-7 sm:px-9 lg:grid lg:grid-cols-[1.2fr_0.9fr] lg:items-center lg:gap-10"
            aria-labelledby="about-cta-title"
          >
          <Leaf
            className="pointer-events-none absolute -bottom-8 -left-5 h-36 w-36 -rotate-12 text-[#78926b]/25"
            strokeWidth={0.7}
            aria-hidden="true"
          />
          <div className="relative">
            <h2
              id="about-cta-title"
              className="text-[2.5rem] font-medium leading-[0.95] tracking-[-0.04em] [font-family:var(--font-echo-display)] sm:text-[3rem]"
            >
              Make space for what&apos;s
              <br className="hidden sm:block" /> on your mind.
              <Leaf className="ml-1 inline h-7 w-7 -rotate-12 text-[#56743b]" strokeWidth={1.2} aria-hidden="true" />
            </h2>
          </div>
          <div className="relative mt-6 lg:mt-0">
            <p className="max-w-md text-sm leading-6 text-[#566a5f]">
              Start privately, write at your own pace, and stay in control of your experience.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#123526] px-6 text-sm font-bold text-[#fffaf0] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[#1d4934] focus-visible:ring-4 focus-visible:ring-[#123526]/20 active:scale-[0.97]"
              >
                Start privately
              </Link>
              <Link
                href="/#features"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#9fac97] px-6 text-sm font-bold text-[#234735] outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-white/35 focus-visible:ring-4 focus-visible:ring-[#123526]/15 active:scale-[0.97]"
              >
                Explore features
              </Link>
            </div>
          </div>
          </section>
        </EchoReveal>
      </div>
    </div>
  );
}
