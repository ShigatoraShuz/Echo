import { ArrowRight, BookOpenText, MessageCircle, ShieldCheck, Sparkles, Wind, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import reflectionDesk from "../../../../assets/landing-page/image 10.jpg";
import growthDoorwayHill from "../../../../assets/growth-doorway-hill.png";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import { LandingHowItWorks } from "./landing-how-it-works";

const reflectionPaths: Array<{
  title: string;
  body: string;
  detail: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "Write without performing",
    body: "A private page for the thoughts that are still taking shape.",
    detail: "Journal entries stay connected to your account and are saved only when you choose.",
    href: "/signup",
    icon: BookOpenText,
  },
  {
    title: "Talk it through gently",
    body: "Reflective prompts help you slow down and see another angle.",
    detail: "Buddy is optional, non-clinical, and easy to pause whenever you need space.",
    href: "/signup",
    icon: MessageCircle,
  },
  {
    title: "Reset in the moment",
    body: "Grounding exercises offer one practical next step when your mind feels busy.",
    detail: "Choose paced breathing, a sensory reset, or a quick mood check-in.",
    href: "/signup",
    icon: Wind,
  },
];

function ReflectionPath({
  title,
  body,
  detail,
  href,
  icon: Icon,
  delay,
}: (typeof reflectionPaths)[number] & { delay: number }) {
  return (
    <EchoReveal variant="card" delay={delay} className="lg:h-full">
      <Link
        href={href}
        className="group flex items-start gap-4 border-t border-[var(--landing-primary-20)] py-5 outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] lg:grid lg:h-full lg:grid-cols-[3rem_1fr_auto] lg:items-start"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--landing-sage-soft)] text-[var(--landing-primary)] transition-transform duration-200 group-hover:-translate-y-0.5">
          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 lg:flex-auto">
          <span className="block text-xl font-medium tracking-[-0.025em] [font-family:var(--font-echo-display)]">
            {title}
          </span>
          <span className="mt-1 block text-sm font-medium leading-6 text-[var(--landing-ink-75)]">{body}</span>
          <span className="mt-2 block text-xs leading-5 text-[var(--landing-muted)]">{detail}</span>
        </span>
        <ArrowRight className="hidden h-5 w-5 text-[var(--landing-primary)] transition-transform duration-200 group-hover:translate-x-1 sm:block" aria-hidden="true" />
      </Link>
    </EchoReveal>
  );
}

export function MindfulnessOfferingsSection() {
  return (
    <section
      id="features"
      aria-labelledby="reflection-paths-title"
      className="scroll-mt-24 bg-[var(--landing-cream)] px-5 py-20 text-[var(--landing-ink)] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
    >
      <div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-12 lg:items-center">
        <EchoReveal variant="text" className="lg:col-span-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--landing-primary)]">Ways to reflect</p>
          <h2
            id="reflection-paths-title"
            className="mt-4 max-w-md text-[clamp(3rem,5vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.055em] text-[var(--landing-primary)] [font-family:var(--font-echo-display)]"
          >
            Meet the moment where it is.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--landing-muted)]">
            Start with a blank page, a guided conversation, or one grounding exercise. Every path stays optional and
            connected to the same private space.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--landing-primary)] px-6 text-sm font-bold text-[var(--landing-inverse)] outline-none transition-[transform,background-color] duration-200 hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]"
          >
            Start privately
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </EchoReveal>

        <EchoReveal variant="media" delay={65} className="lg:col-span-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--landing-media-radius)] bg-[var(--landing-sage-soft)] shadow-[0_24px_70px_rgba(24,52,34,0.14)]">
            <Image
              src={reflectionDesk}
              alt="A quiet desk prepared for private reflection"
              fill
              sizes="(min-width: 1024px) 34vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,rgba(14,42,28,0.82))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Your pace, your words</p>
              <p className="mt-2 text-3xl font-medium leading-none tracking-[-0.035em] [font-family:var(--font-echo-display)]">
                No streaks. No pressure to explain.
              </p>
            </div>
          </div>
        </EchoReveal>

        <div className="lg:col-span-4">
          {reflectionPaths.map((path, index) => (
            <ReflectionPath key={path.title} {...path} delay={(index + 2) * 65} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function GrowthInvitationSection() {
  return (
    <section
      id="growth"
      data-testid="growth-section"
      aria-labelledby="growth-heading"
      className="relative isolate overflow-hidden bg-[#dfe8da] px-5 py-20 text-[var(--landing-ink)] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
    >
      <div
        data-testid="growth-background"
        className="echo-growth-drift absolute inset-0 -z-20 bg-cover bg-[center_70%] opacity-70"
        style={{ backgroundImage: `url(${growthDoorwayHill.src})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(247,243,234,0.97)_0%,rgba(247,243,234,0.9)_45%,rgba(247,243,234,0.32)_100%)]" aria-hidden="true" />

      <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:items-end">
        <EchoReveal variant="text" className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--landing-primary)]">Growth with boundaries</p>
          <h2
            id="growth-heading"
            className="mt-4 text-[clamp(3.25rem,6.5vw,6.5rem)] font-medium leading-[0.88] tracking-[-0.055em] text-[var(--landing-primary)] [font-family:var(--font-echo-display)]"
          >
            Room to grow, at your pace.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--landing-ink-75)]">
            Notice what you feel, decide what is useful, and keep control over the reflections and optional features you
            choose to use.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--landing-primary)] px-6 text-sm font-bold text-[var(--landing-inverse)] outline-none transition-[transform,background-color] duration-200 hover:bg-[var(--landing-primary-hover)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.98]"
            >
              Start privately
            </Link>
            <Link
              href="/privacy-policy"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--landing-primary-25)] bg-[var(--landing-inverse-80)] px-6 text-sm font-bold text-[var(--landing-primary)] outline-none transition-colors duration-200 hover:bg-[var(--landing-inverse)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)]"
            >
              Read our privacy approach
            </Link>
          </div>
        </EchoReveal>

        <EchoReveal variant="card" delay={65}>
          <aside className="rounded-[var(--landing-card-radius)] border border-white/55 bg-[rgba(255,253,247,0.88)] p-6 shadow-[0_24px_70px_rgba(24,52,34,0.13)] backdrop-blur-md sm:p-7">
            <div className="flex items-center gap-3 text-[var(--landing-primary)]">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--landing-sage-soft)]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-bold">Clear boundaries, from the start</p>
            </div>
            <ul className="mt-6 divide-y divide-[var(--landing-primary-15)]">
              {[
                "Journal content is treated as sensitive private data.",
                "AI-assisted reflection stays optional and user initiated.",
                "ECHO supports reflection and does not provide diagnosis or emergency monitoring.",
              ].map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-6 text-[var(--landing-muted)]">
                  <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[var(--landing-primary)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/crisis" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#a84443] underline-offset-4 hover:underline">
              Need immediate support?
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </EchoReveal>
      </div>
    </section>
  );
}

export function LandingEditorialSections() {
  return (
    <>
      <MindfulnessOfferingsSection />
      <LandingHowItWorks />
      <GrowthInvitationSection />
    </>
  );
}
