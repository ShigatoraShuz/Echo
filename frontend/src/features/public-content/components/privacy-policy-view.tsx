"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Database,
  Download,
  Leaf,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const summaryCards: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Information we collect",
    body: "Account details, saved journal entries, check-ins, preferences, and limited security and activity records needed to operate ECHO.",
    icon: Database,
  },
  {
    title: "Optional AI analysis",
    body: "AI-assisted reflection is optional and processes an entry only when you choose it. It is not a diagnostic or clinical decision tool.",
    icon: Sparkles,
  },
  {
    title: "Your control",
    body: "Review your choices, withdraw optional AI consent, request an export, or request account deletion through ECHO settings.",
    icon: SlidersHorizontal,
  },
  {
    title: "Safety and sharing",
    body: "ECHO does not sell journal content. Crisis support is not a monitoring service or a replacement for emergency services.",
    icon: ShieldCheck,
  },
];

const trustPoints: Array<{ title: string; body: string; icon: LucideIcon }> = [
  { title: "Your entries are private", body: "Protected by account permissions and authorized service access.", icon: LockKeyhole },
  { title: "AI analysis is optional", body: "Use AI insights only if you choose to.", icon: Sparkles },
  { title: "You stay in control", body: "Review, export, or delete anytime.", icon: Settings2 },
];

const privacyActions: Array<{ title: string; body: string; href: string; icon: LucideIcon }> = [
  {
    title: "Review consent",
    body: "See and update your consent preferences.",
    href: "/settings/privacy",
    icon: ClipboardCheck,
  },
  {
    title: "Export your data",
    body: "Download a copy of your journal and data.",
    href: "/settings/export",
    icon: Download,
  },
  {
    title: "Delete your account",
    body: "Request permanent deletion of your account and data.",
    href: "/settings/privacy",
    icon: Trash2,
  },
];

const policySections = [
  {
    title: "What we collect",
    content: (
      <>
        <p>
          ECHO collects account details, your chosen display name, saved journal entries, onboarding choices,
          notification and privacy settings, trusted contacts you add, verification records where required, and limited
          security and activity logs needed to operate the app.
        </p>
        <p>
          When you continue with Google, Supabase receives the OAuth response from Google. ECHO may use the
          Google-provided email and recommended display name to create or find your account and prefill your profile.
        </p>
      </>
    ),
  },
  {
    title: "How we use information",
    content: (
      <p>
        Journal and reflection content is treated as sensitive private data. ECHO uses it to show your entries,
        dashboard summaries, grounding history, and only the optional AI features you explicitly choose to use. Limited
        operational records help ECHO run, protect, and diagnose the service.
      </p>
    ),
  },
  {
    title: "AI and your journal",
    content: (
      <p>
        AI analysis is optional. Declining it does not block journaling or grounding tools. If enabled later, only
        selected entries are processed for reflective summaries or insights. The feature is not diagnostic, emergency
        monitoring, or a clinical decision tool, and private entries are not used to train it without separate consent.
      </p>
    ),
  },
  {
    title: "Retention and deletion",
    content: (
      <p>
        You can request a data export or account deletion through ECHO settings. Some consent and security records may
        be retained when needed for accountability, service protection, and documenting your choices.
      </p>
    ),
  },
  {
    title: "Your rights",
    content: (
      <p>
        You can update your profile and preferences, change optional AI settings, review privacy and security choices,
        request a copy of your data, or request account deletion from settings.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Use the account settings area to review your privacy choices or begin an export or deletion request. ECHO does
        not publish a separate privacy contact channel in the current application.
      </p>
    ),
  },
];

function PrivacyIllustration() {
  return (
    <svg viewBox="0 0 320 260" className="h-full w-full" fill="none" aria-hidden="true" focusable="false">
      <g stroke="#bdd397" strokeOpacity=".15">
        <circle cx="156" cy="126" r="116" />
        <circle cx="156" cy="126" r="96" />
        <circle cx="156" cy="126" r="76" />
        <circle cx="156" cy="126" r="56" />
      </g>
      <path
        d="M155 54c21 15 40 20 61 22v43c0 42-22 68-61 87-39-19-61-45-61-87V76c21-2 40-7 61-22Z"
        stroke="#cadc9c"
        strokeWidth="2.2"
      />
      <path d="M132 154c10-37 27-50 53-53-2 31-19 49-53 53Z" stroke="#cadc9c" strokeWidth="2" />
      <path d="M130 177c9-35 24-53 48-65" stroke="#cadc9c" strokeWidth="2" strokeLinecap="round" />
      <g stroke="#a9c77c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M225 224c30-12 52-35 67-72" />
        <path d="M247 211c-2-16 2-28 11-38 5 15 2 28-11 38Z" />
        <path d="M260 199c14-2 25-8 32-19-15-2-26 4-32 19Z" />
        <path d="M268 184c-2-15 2-27 11-36 5 14 2 26-11 36Z" />
        <path d="M280 167c12-4 21-11 25-21-13 0-22 7-25 21Z" />
      </g>
    </svg>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-[#cfd6c7]" />
      <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#264f3d]">{children}</p>
      <span className="h-px flex-1 bg-[#cfd6c7]" />
    </div>
  );
}

function PolicyAccordion({ title, children, index }: { title: string; children: ReactNode; index: number }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const buttonId = `policy-trigger-${uid}`;
  const panelId = `policy-panel-${uid}`;

  return (
    <div className="border-b border-[#d9ddd2] last:border-b-0">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="group flex min-h-12 w-full items-center justify-between gap-4 rounded-lg px-5 py-3 text-left text-sm font-bold text-[#234735] outline-none transition-colors duration-150 hover:bg-[#eef1e8] focus-visible:ring-2 focus-visible:ring-[#56743b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea]"
        >
          <span className="flex items-center gap-3">
            <span className="text-[10px] font-extrabold tabular-nums text-[#7b8a7e]" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {title}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#56743b] transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-12 pb-5 pr-6 text-sm leading-6 text-[#65746b]">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyView() {
  return (
    <div className="overflow-x-clip bg-[#f7f3ea] text-[#173b2b] [font-family:var(--font-echo-sans)]">
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-14 pt-28 sm:px-8 sm:pt-32 lg:px-10 lg:pb-16 lg:pt-32">
        <section
          className="grid gap-9 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-14"
          aria-labelledby="privacy-title"
        >
          <EchoReveal direction="up" variant="text" duration={560} className="max-w-xl">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#285d46]">
              <Leaf className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              ECHO privacy
            </p>
            <h1
              id="privacy-title"
              className="mt-4 text-[3rem] font-medium leading-[0.88] tracking-[-0.055em] text-[#123526] [font-family:var(--font-echo-display)] sm:text-[4.25rem] lg:text-[4.65rem]"
            >
              Your thoughts
              <br />
              stay yours.
              <Leaf className="ml-1 inline h-8 w-8 -rotate-12 text-[#56743b]" strokeWidth={1.2} aria-hidden="true" />
            </h1>
            <p className="mt-5 max-w-[34rem] text-[15px] leading-6 text-[#65746b] sm:text-base sm:leading-7">
              A plain-language guide to how ECHO collects, protects, and gives you control over your information.
            </p>
            <p className="mt-5 flex items-center gap-2 text-xs font-medium text-[#65746b]">
              <CalendarDays className="h-4 w-4 text-[#56743b]" strokeWidth={1.8} aria-hidden="true" />
              <time dateTime="2026-07-25">Last updated July 25, 2026</time>
            </p>
          </EchoReveal>

          <EchoReveal
            direction="up"
            variant="card"
            delay={70}
            duration={560}
            className="relative min-h-[285px] overflow-hidden rounded-[22px] bg-[#0d2e20] px-6 py-7 text-[#fbf8f1] shadow-[0_18px_44px_rgba(13,46,32,0.13)] sm:px-8 sm:py-8"
          >
            <div className="relative z-10 max-w-[22rem]">
              <h2 className="text-[2rem] font-medium leading-none [font-family:var(--font-echo-display)]">
                Private by design
              </h2>
              <ul className="mt-6 space-y-4">
                {trustPoints.map(({ title, body, icon: Icon }) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#b8cd88]/25 bg-white/[0.06] text-[#c8dc9b]">
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="pt-0.5">
                      <h3 className="text-sm font-bold text-[#fffaf0]">{title}</h3>
                      <p className="mt-0.5 text-xs leading-5 text-white/65">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] sm:block">
              <PrivacyIllustration />
            </div>
          </EchoReveal>
        </section>

        <section className="mt-8 sm:mt-10" aria-labelledby="glance-heading">
          <h2 id="glance-heading" className="sr-only">
            Privacy at a glance
          </h2>
          <EchoReveal direction="up" variant="text" duration={520}>
            <SectionLabel>Privacy at a glance</SectionLabel>
          </EchoReveal>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ title, body, icon: Icon }, index) => (
              <EchoReveal key={title} direction="up" variant="card" delay={index * 65} duration={600} className="h-full">
                <article className="flex h-full min-h-[210px] flex-col rounded-[18px] border border-[#d9ddd2] bg-[#fbf8f1] p-5 shadow-[0_8px_24px_rgba(35,71,53,0.035)]">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#dde8d5] text-[#285d46]">
                    <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[1.35rem] font-medium leading-tight text-[#173b2b] [font-family:var(--font-echo-display)]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.65] text-[#65746b]">{body}</p>
                </article>
              </EchoReveal>
            ))}
          </div>
        </section>

        <EchoReveal direction="up" variant="card" duration={620}>
          <section
            className="relative mt-5 overflow-hidden rounded-[20px] border border-[#ccd8c5] bg-[#dde8d5] px-5 py-6 sm:px-7"
            aria-labelledby="choices-title"
          >
          <Leaf
            className="pointer-events-none absolute -bottom-5 -left-3 h-24 w-24 -rotate-12 text-[#78926b]/25"
            strokeWidth={0.8}
            aria-hidden="true"
          />
          <div className="relative grid gap-6 xl:grid-cols-[1.12fr_3fr_auto] xl:items-center xl:gap-5">
            <div>
              <h2
                id="choices-title"
                className="text-[1.65rem] font-medium leading-tight [font-family:var(--font-echo-display)]"
              >
                Your privacy choices
              </h2>
              <p className="mt-1.5 max-w-xs text-xs leading-5 text-[#65746b]">
                Manage your data and consent settings anytime in your account.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-0">
              {privacyActions.map(({ title, body, href, icon: Icon }, index) => (
                <Link
                  key={title}
                  href={href}
                  className={`group flex min-h-16 gap-3 rounded-xl px-2 py-1 outline-none transition-colors duration-150 hover:bg-white/35 focus-visible:ring-2 focus-visible:ring-[#56743b] sm:rounded-none sm:px-5 ${index ? "sm:border-l sm:border-[#bdcbb7]" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#cbdcbe] text-[#234735] transition-transform duration-150 ease-out group-active:scale-[0.96]">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-[#234735]">{title}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#65746b]">{body}</span>
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/settings/privacy"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#123526] px-6 text-xs font-bold text-[#fffaf0] shadow-sm outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-[#1d4934] focus-visible:ring-4 focus-visible:ring-[#123526]/20 active:scale-[0.97] xl:justify-self-end"
            >
              Manage privacy
            </Link>
          </div>
          </section>
        </EchoReveal>

        <section className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.7fr] lg:gap-14" aria-labelledby="full-policy-title">
          <EchoReveal direction="up" variant="text" duration={560} className="pt-2">
            <p className="flex items-center gap-2 text-[#56743b]">
              <Leaf className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
              <span className="sr-only">Policy details</span>
            </p>
            <h2
              id="full-policy-title"
              className="mt-1 text-[2rem] font-medium leading-tight tracking-[-0.025em] [font-family:var(--font-echo-display)]"
            >
              Read the full policy
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[#65746b]">
              Explore the details of how ECHO protects your privacy and data.
            </p>
          </EchoReveal>
          <EchoReveal
            direction="up"
            variant="card"
            delay={60}
            duration={540}
            className="overflow-hidden rounded-[16px] border border-[#d9ddd2] bg-[#fbf8f1]"
          >
            {policySections.map((section, index) => (
              <EchoReveal key={section.title} direction="up" variant="card" delay={index * 65} duration={560}>
                <PolicyAccordion title={section.title} index={index}>
                  {section.content}
                </PolicyAccordion>
              </EchoReveal>
            ))}
          </EchoReveal>
        </section>
      </div>
    </div>
  );
}
