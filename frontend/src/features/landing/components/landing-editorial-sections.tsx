import {
  ArrowUpRight,
  BookOpen,
  Brain,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { echoImages } from "@/lib/unsplash-images";
import { cn } from "@/lib/utils";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import growthBackground from "../../../../assets/3bg.png";

const portraitImages = [
  {
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling in an everyday setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=85",
    alt: "A person photographed in natural light.",
  },
  {
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=85",
    alt: "A calm portrait in an everyday setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling at the camera.",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=85",
    alt: "A person photographed indoors.",
  },
  {
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=85",
    alt: "A friendly portrait in soft light.",
  },
  {
    src: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling in a bright setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=500&q=85",
    alt: "A person in a calm indoor setting.",
  },
];

const portraitPositions = [
  "left-[2%] top-[15%] h-40 w-28",
  "left-[13%] top-[3%] h-44 w-32",
  "left-[24%] top-[16%] h-36 w-28",
  "left-[35%] top-[4%] h-40 w-28",
  "right-[35%] top-[5%] h-40 w-28",
  "right-[24%] top-[17%] h-36 w-28",
  "right-[13%] top-[3%] h-44 w-32",
  "right-[2%] top-[15%] h-40 w-28",
];

function revealDelay(index: number) {
  return Math.min(index * 60, 240);
}

function PillLink({ href, children, filled = false }: { href: string; children: React.ReactNode; filled?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold outline-none transition-[transform,background-color,border-color] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-20)] active:scale-[0.97] ${
        filled
          ? "bg-[var(--landing-primary)] text-[var(--landing-inverse)] hover:bg-[var(--landing-primary-hover)]"
          : "border border-[var(--landing-primary-25)] bg-[var(--landing-inverse-80)] text-[var(--landing-primary)] hover:bg-[var(--landing-inverse)]"
      }`}
    >
      {children}
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function FlipMediaCard({
  image,
  sizes,
  frontContent,
  backLabel,
  backTitle,
  backDescription,
  backIcon,
  href,
  actionLabel = "Explore",
  priority = false,
  compact = false,
  className,
}: {
  image: { src: string; alt: string };
  sizes: string;
  frontContent: React.ReactNode;
  backLabel: string;
  backTitle: string;
  backDescription: string;
  backIcon: React.ReactNode;
  href?: string;
  actionLabel?: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const content = (
    <div className="echo-flip-card__inner h-full w-full">
      <div className="echo-flip-card__face relative h-full w-full overflow-hidden bg-[#d7dfd9]">
        <Image src={image.src} alt={image.alt} fill priority={priority} className="object-cover" sizes={sizes} />
        {frontContent}
      </div>

      <div
        className={cn(
          "echo-flip-card__face echo-flip-card__back absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden bg-[var(--landing-primary)] text-[var(--landing-inverse)]",
          compact ? "p-5" : "p-6 sm:p-7",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <span className={cn("font-extrabold uppercase tracking-[0.14em] text-white/70", compact ? "text-[10px]" : "text-xs")}>{backLabel}</span>
          <span className={cn("grid shrink-0 place-items-center rounded-full bg-white/[0.12] text-white", compact ? "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4" : "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5")}>
            {backIcon}
          </span>
        </div>

        <div>
          <h3 className={cn("max-w-sm font-medium leading-[0.94] tracking-[-0.045em] [font-family:var(--font-echo-display)]", compact ? "text-[clamp(1.5rem,2.2vw,2.25rem)]" : "text-[clamp(2rem,3.2vw,3.5rem)]")}>
            {backTitle}
          </h3>
          <p className={cn("max-w-sm font-medium text-white/75", compact ? "mt-2 text-xs leading-5" : "mt-4 text-sm leading-6")}>{backDescription}</p>
          {href ? (
            <span className={cn("inline-flex items-center gap-2 rounded-full bg-[var(--landing-inverse)] text-xs font-extrabold text-[var(--landing-primary)]", compact ? "mt-3 px-3 py-2" : "mt-6 px-4 py-2.5")}>
              {actionLabel}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${backTitle}. ${actionLabel}`}
        className={cn(
          "echo-flip-card group block rounded-[var(--landing-card-radius)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)]",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      tabIndex={0}
      aria-label={backTitle}
      className={cn(
        "echo-flip-card group rounded-[var(--landing-card-radius)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)]",
        className,
      )}
    >
      {content}
    </article>
  );
}

export function MindfulnessOfferingsSection() {
  return (
    <section
      id="features"
      className="bg-[var(--landing-mist)] px-4 py-16 text-[var(--landing-ink)] [font-family:var(--font-echo-sans)] sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-12 lg:items-stretch">
        <EchoReveal variant="card" className="h-full lg:col-span-3">
          <div className="flex h-full flex-col justify-between rounded-[var(--landing-card-radius)] bg-[var(--landing-surface)] p-6 sm:p-8 lg:min-h-[690px]">
            <div>
              <p className="inline-flex rounded-full bg-[var(--landing-inverse)] px-3 py-1.5 text-xs font-bold shadow-sm">Grounding tools</p>
              <h2 className="mt-8 text-[clamp(2.75rem,3.8vw,4rem)] font-medium leading-[0.95] tracking-[-0.055em] [text-wrap:balance]">
                A calmer way to
                <span className="block text-[var(--landing-primary)]">pause and reset</span>
              </h2>
            </div>

            <div className="mt-12">
              <div className="flex gap-3">
                {[Brain, Wind, Sparkles].map((Icon, index) => (
                  <span key={index} className="grid h-12 w-12 place-items-center rounded-full bg-[var(--landing-inverse)] text-[var(--landing-primary)] shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                ))}
              </div>
              <p className="mt-7 max-w-sm border-t border-[var(--landing-primary-15)] pt-5 text-base leading-7 text-[var(--landing-muted)]">
                Try paced breathing, a 5-4-3-2-1 grounding exercise, or one of six mood check-ins whenever you want a clearer next step.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <PillLink href="/signup" filled>Get started</PillLink>
                <PillLink href="/tools/grounding">Explore</PillLink>
              </div>
            </div>
          </div>
        </EchoReveal>

        <EchoReveal variant="media" delay={60} className="h-full lg:col-span-6">
          <FlipMediaCard
            image={echoImages.meditationRoomPlant}
            sizes="(min-width: 1024px) 50vw, 100vw"
            href="/tools/grounding"
            priority
            backLabel="Grounding practice"
            backTitle="Reset in the moment"
            backDescription="Choose paced breathing, a sensory reset, or a quick mood check-in whenever you need steadier ground."
            backIcon={<Wind aria-hidden="true" />}
            actionLabel="Explore grounding"
            className="h-full min-h-[560px] bg-[#d6dfd8] lg:min-h-[690px]"
            frontContent={(
              <>
                <span className="absolute left-5 top-5 rounded-full bg-[var(--landing-inverse-90)] px-3 py-1.5 text-xs font-bold backdrop-blur-sm">Grounding practice</span>
                <span className="absolute right-5 top-5 rounded-full bg-[var(--landing-ink-80)] px-3 py-1.5 text-xs font-bold text-[var(--landing-inverse)] backdrop-blur-sm">Private by design</span>

                <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-[290px] rounded-[var(--landing-panel-radius)] bg-[var(--landing-ink-80)] p-5 text-[var(--landing-inverse)] backdrop-blur-md">
                    <p className="text-4xl font-medium tracking-[-0.05em]">6 moods</p>
                    <p className="mt-1 text-sm text-white/85">for quick, personal check-ins</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--landing-inverse-90)] px-3 py-2 text-xs font-bold backdrop-blur-sm">Paced breathing</span>
                    <span className="rounded-full bg-[var(--landing-inverse-90)] px-3 py-2 text-xs font-bold backdrop-blur-sm">5-4-3-2-1</span>
                  </div>
                </div>
              </>
            )}
          />
        </EchoReveal>

        <div className="grid gap-5 lg:col-span-3 lg:grid-rows-[auto_1fr]">
          <EchoReveal variant="card" delay={120}>
            <div className="rounded-[var(--landing-card-radius)] bg-[var(--landing-surface)] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--landing-primary)]">Explore ECHO</p>
              <h3 className="mt-3 text-[clamp(2.25rem,3vw,3rem)] font-medium leading-[0.98] tracking-[-0.045em]">Tools that stay close</h3>
              <p className="mt-5 max-w-sm text-base leading-7 text-[var(--landing-muted)]">
                Move naturally between writing, guided reflection, mood patterns, and grounding without losing your place.
              </p>
            </div>
          </EchoReveal>

          <EchoReveal variant="media" delay={180} className="h-full">
            <FlipMediaCard
              image={echoImages.cozyChairWindow}
              sizes="(min-width: 1024px) 25vw, 100vw"
              href="/buddy"
              priority
              backLabel="Reflective Buddy"
              backTitle="Talk it through gently"
              backDescription="Follow a calm prompt, explore what is present, and choose one next step without pressure or judgment."
              backIcon={<MessageCircle aria-hidden="true" />}
              actionLabel="Try Buddy"
              className="h-full min-h-[360px] bg-[#d7dfd9]"
              frontContent={(
                <>
                  <span className="absolute left-4 top-4 rounded-full bg-[var(--landing-inverse-90)] px-3 py-1.5 text-xs font-bold">Reflective Buddy</span>
                  <div className="absolute inset-x-4 bottom-4 rounded-[var(--landing-panel-radius)] bg-[var(--landing-ink-82)] p-4 text-[var(--landing-inverse)] backdrop-blur-md">
                    <p className="text-3xl font-medium tracking-[-0.04em]">One gentle step</p>
                    <p className="mt-1 text-sm text-white/85">Guided prompts, at your pace.</p>
                  </div>
                </>
              )}
            />
          </EchoReveal>
        </div>
      </div>
    </section>
  );
}
