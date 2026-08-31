"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleGauge,
  Home,
  Leaf,
  LockKeyhole,
  MessageCircle,
  PenLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { KeyboardEvent, useRef, useState } from "react";

import { ROUTES } from "@/config/routes.config";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { cn } from "@/shared/lib/utils";

type StepId = "check-in" | "journal" | "buddy" | "patterns" | "grounding";
type Step = {
  id: StepId;
  number: string;
  tab: string;
  eyebrow: string;
  heading: string;
  description: string;
  bullets: string[];
  cta: string;
  href: string;
};

const STEPS: Step[] = [
  {
    id: "check-in",
    number: "01",
    tab: "Check in",
    eyebrow: "Step 01 · Mood check-in",
    heading: "Start with how you feel.",
    description:
      "Choose the mood that feels closest, add a little context if you want, or move on without explaining. You decide what to save.",
    bullets: ["Six simple mood choices", "Optional note or intensity", "Saved to your account when you choose"],
    cta: "Try a check-in",
    href: ROUTES.journal.new,
  },
  {
    id: "journal",
    number: "02",
    tab: "Write privately",
    eyebrow: "Step 02 · Private journal",
    heading: "Write what’s on your mind.",
    description:
      "Begin with a title and an open page. Write as much or as little as you want, choose a mood if it helps, then save when you’re ready.",
    bullets: ["Title and open writing space", "Private reflection history", "Optional AI summary consent"],
    cta: "Open your journal",
    href: ROUTES.journal.new,
  },
  {
    id: "buddy",
    number: "03",
    tab: "Reflect with Buddy",
    eyebrow: "Step 03 · Reflective Buddy",
    heading: "Add another perspective.",
    description:
      "When available to your account, Buddy offers reflective prompts that can help you explore a thought without rushing to solve it.",
    bullets: [
      "Optional, verification-gated feature",
      "Reflective prompts—not clinical advice",
      "Pause or stop at any time",
    ],
    cta: "Meet Buddy",
    href: ROUTES.buddy.chat,
  },
  {
    id: "patterns",
    number: "04",
    tab: "Notice patterns",
    eyebrow: "Step 04 · Emotional insights",
    heading: "See what keeps showing up.",
    description:
      "Review the moods connected to your saved reflections and notice recurring themes over time, without turning them into a diagnosis.",
    bullets: ["Mood trends over time", "A view of recurring themes", "Insights for reflection, not diagnosis"],
    cta: "View emotional insights",
    href: ROUTES.insights.emotion,
  },
  {
    id: "grounding",
    number: "05",
    tab: "Choose a next step",
    eyebrow: "Step 05 · Grounding tools",
    heading: "Choose what helps next.",
    description:
      "Move from reflection into one small, practical reset. Pick a grounding exercise that suits the moment and go at your own pace.",
    bullets: ["Box breathing", "5-4-3-2-1 sensory exercise", "Window reset"],
    cta: "Explore grounding tools",
    href: ROUTES.tools.grounding,
  },
];

const NAV = [
  ["Home", Home],
  ["Journal", BookOpen],
  ["Buddy", MessageCircle],
  ["Patterns", BarChart3],
  ["Grounding", Wind],
] as const;
const MOODS = [
  ["Calm", Leaf],
  ["Happy", Sparkles],
  ["Neutral", CircleGauge],
  ["Sad", Wind],
  ["Anxious", Brain],
  ["Angry", SlidersHorizontal],
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2 font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#315b38] text-white">
        <Leaf className="h-4 w-4" aria-hidden="true" />
      </span>
      ECHO
    </div>
  );
}

function PreviewHeading({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-echo-display)] text-[clamp(1.7rem,3vw,2.35rem)] leading-none">
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#65746b]">{copy}</p>
    </div>
  );
}

function CheckInPreview() {
  return (
    <>
      <PreviewHeading
        title="How are you feeling right now?"
        copy="Choose what feels closest. There’s no wrong answer."
      />
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {MOODS.map(([label, Icon]) => (
          <div
            key={label}
            className={cn(
              "relative grid min-h-24 place-items-center rounded-xl border border-[#dddcd2] bg-white px-2 py-3 text-center",
              label === "Neutral" && "border-[#9eae8d] bg-[#eef1e6]",
            )}
          >
            {label === "Neutral" && (
              <Check
                className="absolute right-2 top-2 h-3.5 w-3.5 rounded-full bg-[#42632f] p-0.5 text-white"
                aria-hidden="true"
              />
            )}
            <Icon className="h-7 w-7 text-[#264c37]" aria-hidden="true" />
            <span className="text-[10px] font-semibold">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-[10px] font-semibold">
            <span>How strong is it?</span>
            <span>5 / 10</span>
          </div>
          <div className="relative mt-4 h-1 rounded-full bg-[#dddcd2]">
            <span className="absolute h-full w-1/2 rounded-full bg-[#315b38]" />
            <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#315b38]" />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold">Add a note (optional)</p>
          <div className="mt-2 h-16 rounded-lg border border-[#dddcd2] bg-white p-3 text-[10px] text-[#8a938d]">
            What’s on your mind?
          </div>
        </div>
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#17452b] px-6 py-3 text-xs font-bold text-white">Save check-in</span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#65746b]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Saved only when you choose
        </span>
      </div>
    </>
  );
}

function JournalPreview() {
  return (
    <>
      <PreviewHeading title="Write privately" copy="A clear page for whatever is on your mind." />
      <div className="mt-5 rounded-xl border border-[#dddcd2] bg-white">
        <div className="border-b border-[#e4e2da] px-4 py-3 text-sm font-semibold">A small moment I noticed</div>
        <div className="flex gap-4 border-b border-[#e4e2da] px-4 py-2 text-xs text-[#65746b]">
          <b>B</b>
          <i>I</i>
          <span>¶</span>
          <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-h-40 px-4 py-4 text-sm leading-7 text-[#51645a]">
          Today felt quieter than usual. I noticed that taking a few slow minutes before answering helped me feel less
          rushed…
        </div>
        <div className="flex justify-between border-t border-[#e4e2da] px-4 py-3 text-[10px] text-[#7b877f]">
          <span>26 words</span>
          <span>Private reflection</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#17452b] px-6 py-3 text-xs font-bold text-white">Save reflection</span>
        <span className="flex items-center gap-2 text-[10px] text-[#65746b]">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> AI summary off
        </span>
      </div>
    </>
  );
}

function BuddyPreview() {
  return (
    <>
      <PreviewHeading title="Reflect with Buddy" copy="A thoughtful second perspective, when you choose it." />
      <div className="mt-6 space-y-4 text-sm leading-6">
        <div className="mr-10 rounded-[18px_18px_18px_5px] bg-[#e7ecdf] p-4">
          What part of this moment feels most important to understand?
        </div>
        <div className="ml-10 rounded-[18px_18px_5px_18px] border border-[#dddcd2] bg-white p-4 text-[#51645a]">
          I think I’m trying to do too much at once, and I haven’t paused to decide what matters first.
        </div>
        <div className="mr-10 rounded-[18px_18px_18px_5px] bg-[#e7ecdf] p-4">
          What would one gentler priority look like today?
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between rounded-xl border border-[#dddcd2] bg-white px-4 py-3 text-xs text-[#65746b]">
        <span>Write a response…</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#17452b] text-white">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[10px] text-[#65746b]">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Optional and available to verified accounts
      </p>
    </>
  );
}

function PatternsPreview() {
  return (
    <>
      <PreviewHeading title="Notice patterns" copy="A calm view of saved moods over time." />
      <div className="mt-6 rounded-xl border border-[#dddcd2] bg-white p-5">
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-semibold">Mood over the last 7 days</p>
            <p className="mt-1 text-[10px] text-[#7b877f]">Demo preview</p>
          </div>
          <span className="h-fit rounded-full bg-[#edf1e7] px-3 py-1 text-[10px]">Weekly</span>
        </div>
        <svg
          viewBox="0 0 560 190"
          className="mt-5 w-full"
          role="img"
          aria-label="Illustrative seven-day mood trend with gentle rises and dips"
        >
          {[35, 80, 125, 170].map((y) => (
            <line key={y} x1="20" y1={y} x2="540" y2={y} stroke="#e4e2da" />
          ))}
          <path
            d="M30 118 C90 75 118 135 180 105 S280 52 340 88 S430 145 530 78"
            fill="none"
            stroke="#547541"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {[
            [30, 118],
            [115, 108],
            [200, 93],
            [285, 72],
            [370, 104],
            [450, 120],
            [530, 78],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" fill="#f8f4eb" stroke="#547541" strokeWidth="4" />
          ))}
        </svg>
        <div className="grid grid-cols-7 text-center text-[9px] text-[#7b877f]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Most logged mood" value="Calm" />
        <Stat label="Reflections saved" value="5 this week" warm />
      </div>
    </>
  );
}

function Stat({ label, value, warm = false }: { label: string; value: string; warm?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-[#e7ecdf] p-4", warm && "bg-[#f1eadb]")}>
      <p className="text-[10px] text-[#65746b]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-echo-display)] text-xl">{value}</p>
    </div>
  );
}

function GroundingPreview() {
  const tools = [
    ["Box breathing", "Follow a steady four-part breath.", Wind],
    ["5-4-3-2-1", "Reconnect through your senses.", CircleGauge],
    ["Window reset", "Pause and notice what is around you.", Leaf],
  ] as const;
  return (
    <>
      <PreviewHeading title="Choose a grounding tool" copy="Take one small step that fits this moment." />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {tools.map(([title, copy, Icon], index) => (
          <div
            key={title}
            className={cn(
              "rounded-xl border border-[#dddcd2] bg-white p-4",
              index === 0 && "border-[#9eaf8e] bg-[#eef1e8]",
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e3eadb] text-[#315b38]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-5 font-[family-name:var(--font-echo-display)] text-xl">{title}</p>
            <p className="mt-2 text-[10px] leading-5 text-[#65746b]">{copy}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-[#123526] p-5 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#cbd7bd]">Ready when you are</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-echo-display)] text-2xl">Begin with one slow breath.</p>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </>
  );
}

function Preview({ step }: { step: StepId }) {
  return (
    <div className="grid min-h-[420px] overflow-hidden rounded-2xl border border-[#d9ddd2] bg-[#fcfaf5] shadow-[0_12px_34px_rgba(23,59,43,0.08)] lg:grid-cols-[142px_minmax(0,1fr)]">
      <aside
        className="hidden border-r border-[#e2e1d8] bg-[#f7f3ea] p-4 lg:block"
        aria-label="ECHO preview navigation"
      >
        <Brand />
        <div className="mt-9 space-y-1.5">
          {NAV.map(([label, Icon], index) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#51645a]",
                index === STEPS.findIndex((item) => item.id === step) && "bg-[#e4ead9] text-[#173b2b]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 p-5 sm:p-7">
        {step === "check-in" ? (
          <CheckInPreview />
        ) : step === "journal" ? (
          <JournalPreview />
        ) : step === "buddy" ? (
          <BuddyPreview />
        ) : step === "patterns" ? (
          <PatternsPreview />
        ) : (
          <GroundingPreview />
        )}
      </div>
    </div>
  );
}

function MiniPreview({ step }: { step: Step }) {
  const Icon =
    step.id === "buddy"
      ? MessageCircle
      : step.id === "patterns"
        ? BarChart3
        : step.id === "grounding"
          ? Wind
          : step.id === "journal"
            ? PenLine
            : Leaf;
  return (
    <div className="rounded-2xl border border-[#dddcd2] bg-[#fcfaf5] p-4 shadow-[0_9px_25px_rgba(23,59,43,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-echo-display)] text-xl">{step.tab}</p>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4ead9] text-[#315b38]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-[10px] leading-5 text-[#65746b]">{step.description}</p>
      <div className="mt-4 h-1.5 rounded-full bg-[#ece9df]">
        <div className="h-full w-2/3 rounded-full bg-[#77905f]" />
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = [
    [ShieldCheck, "Private by default", "Journal data is scoped to your account."],
    [Users, "Buddy reflection is optional", "Use a second perspective only when you want."],
    [LockKeyhole, "You control optional analysis", "Choose whether selected entries are analyzed."],
  ] as const;
  return (
    <div className="mt-8 grid gap-1 rounded-[18px] border border-[#dde1d5] bg-[#e9eddf] p-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
      {items.map(([Icon, title, copy], index) => (
        <div key={title} className={cn("flex gap-4 px-4 py-4", index > 0 && "lg:border-l lg:border-[#cfd6c7]")}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fbf8f1] text-[#315b38]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-[family-name:var(--font-echo-display)] text-lg leading-tight">{title}</p>
            <p className="mt-1 text-[10px] leading-5 text-[#65746b]">{copy}</p>
          </div>
        </div>
      ))}
      <Link
        href="/#features"
        className="mx-4 mb-3 inline-flex min-h-11 items-center justify-center rounded-full border border-[#244934] px-6 text-xs font-bold transition hover:bg-[#123526] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56743b] focus-visible:ring-offset-2 lg:mb-0 lg:ml-3"
      >
        Explore all features
      </Link>
    </div>
  );
}

export function LandingHowItWorks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = STEPS[activeIndex];
  const next = STEPS[(activeIndex + 1) % STEPS.length];
  const afterNext = STEPS[(activeIndex + 2) % STEPS.length];
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target = index;
    if (event.key === "ArrowRight") target = (index + 1) % STEPS.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + STEPS.length) % STEPS.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = STEPS.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(target);
    refs.current[target]?.focus();
  };

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-echo-works-heading"
      className="relative z-30 scroll-mt-24 overflow-hidden bg-[#f7f3ea] px-5 py-20 text-[#173b2b] [font-family:var(--font-echo-sans)] sm:px-7 lg:py-24"
    >
      <div className="mx-auto max-w-[1200px]">
        <EchoReveal variant="text" direction="none" className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#315b38]">How ECHO works</p>
          <h2
            id="how-echo-works-heading"
            className="mx-auto mt-4 max-w-[1120px] font-[family-name:var(--font-echo-display)] text-[clamp(2.7rem,4.1vw,4.15rem)] font-medium leading-[0.96] tracking-[-0.045em]"
          >
            From a quick check-in to a clearer next step.
            <Leaf className="ml-1 inline h-[0.55em] w-[0.55em] rotate-12 text-[#56743b]" aria-hidden="true" />
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-[#65746b] sm:text-base">
            Move through ECHO at your own pace.
            <br className="hidden sm:block" /> Every step is private, optional, and designed to support clearer
            reflection.
          </p>
        </EchoReveal>
        <EchoReveal variant="card" delay={65}>
          <div
            className="relative mt-10 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="How ECHO works steps"
          >
            <div className="relative flex min-w-[860px] items-center justify-between gap-2 before:absolute before:left-[6%] before:right-[6%] before:top-1/2 before:h-px before:bg-[#cdd5c5]">
              {STEPS.map((step, index) => (
                <button
                  key={step.id}
                  ref={(node) => {
                    refs.current[index] = node;
                  }}
                  id={`echo-step-tab-${step.id}`}
                  type="button"
                  role="tab"
                  aria-label={`${step.number} ${step.tab}`}
                  aria-selected={index === activeIndex}
                  aria-controls={`echo-step-panel-${step.id}`}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className="echo-how-step relative z-10 inline-flex min-h-12 shrink-0 items-center gap-3 overflow-hidden rounded-full border border-[#b9c7ad] bg-[#f7f3ea] px-4 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56743b] focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  <span className="echo-how-step__number relative z-10 grid h-8 w-8 place-items-center rounded-full border border-[#cdd5c5] bg-[#fbf8f1] text-[#173b2b]">
                    {step.number}
                  </span>
                  <span className="relative z-10">{step.tab}</span>
                </button>
              ))}
            </div>
          </div>
        </EchoReveal>
        <EchoReveal variant="card" delay={130}>
          <div
            id={`echo-step-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`echo-step-tab-${active.id}`}
            className="mt-4 grid gap-7 rounded-[22px] border border-[#d9d8cc] bg-[#fbf8f1] p-5 shadow-[0_24px_64px_rgba(23,59,43,0.11),0_4px_14px_rgba(23,59,43,0.05)] sm:p-7 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8"
          >
            <div className="flex flex-col justify-center py-2 lg:py-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[#315b38]">{active.eyebrow}</p>
              <h3 className="mt-4 font-[family-name:var(--font-echo-display)] text-[clamp(2.5rem,3.5vw,3.25rem)] leading-[0.95] tracking-[-0.04em]">
                {active.heading}
              </h3>
              <p className="mt-4 text-sm leading-6 text-[#58695f]">{active.description}</p>
              <ul className="mt-4 space-y-2.5">
                {active.bullets.map((bullet, index) => (
                  <li key={bullet} className="flex items-center gap-3 text-xs">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7ecdf] text-[#315b38]">
                      {index === 0 ? (
                        <CircleGauge className="h-4 w-4" aria-hidden="true" />
                      ) : index === 1 ? (
                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
              <Link
                href={active.href}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#17452b] px-6 text-xs font-bold text-white transition hover:bg-[#0d2e20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56743b] focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                {active.cta}
              </Link>
              {activeIndex < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveIndex(activeIndex + 1);
                    refs.current[activeIndex + 1]?.focus();
                  }}
                  className="mt-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-xs font-bold text-[#315b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56743b]"
                >
                  Next: {next.tab} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <Link
                  href={ROUTES.auth.signup}
                  className="mt-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-xs font-bold text-[#315b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56743b]"
                >
                  Start privately <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <Preview step={active.id} />
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-1 xl:self-center">
                <MiniPreview step={next} />
                <MiniPreview step={afterNext} />
              </div>
            </div>
          </div>
        </EchoReveal>
        <EchoReveal variant="card" delay={195}>
          <TrustStrip />
        </EchoReveal>
      </div>
    </section>
  );
}
