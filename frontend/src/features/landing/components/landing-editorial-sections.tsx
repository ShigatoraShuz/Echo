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

export function ReflectiveBuddySection() {
  const cards = [
    {
      image: echoImages.plantDeskWarmLight,
      label: "Name what is present",
      detail: "Start with a simple prompt that helps you put the moment into your own words.",
      icon: MessageCircle,
    },
    {
      image: echoImages.calmChairPlant,
      label: "Reflect without judgment",
      detail: "Explore a thought at your pace, with room for uncertainty and no pressure to solve it.",
      icon: Brain,
    },
    {
      image: echoImages.wellnessInteriorPlantsChair,
      label: "Choose a next step",
      detail: "Turn reflection into one small, realistic action you can carry into the rest of your day.",
      icon: BookOpen,
    },
  ];

  return (
    <section id="buddy-experience" className="bg-[var(--landing-mist)] px-4 py-8 [font-family:var(--font-echo-sans)] sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto grid min-h-[720px] max-w-[1440px] overflow-hidden rounded-[var(--landing-card-radius)] bg-[var(--landing-surface)] lg:grid-cols-[0.9fr_1.1fr]">
        <EchoReveal variant="text" className="flex flex-col justify-center p-7 sm:p-12 lg:p-16 xl:p-20">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--landing-primary)]">Reflective support</p>
          <h2 className="mt-5 max-w-xl text-[clamp(2.75rem,5vw,5.75rem)] font-medium leading-[0.95] tracking-[-0.055em] text-[var(--landing-ink)] [text-wrap:balance]">
            Build a clearer connection with yourself
          </h2>
          <p className="mt-7 max-w-lg text-base leading-7 text-[var(--landing-muted)]">
            Reflective Buddy offers guided prompts that help you name what is present, explore a thought, and choose a gentle next step.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PillLink href="/buddy" filled>Try Buddy</PillLink>
            <PillLink href="/about">Learn more</PillLink>
          </div>

          <div className="mt-14 flex flex-wrap gap-2 text-xs font-semibold text-[var(--landing-muted)]">
            {["Private", "At your pace", "Always optional"].map((item) => (
              <span key={item} className="rounded-full border border-[var(--landing-primary-20)] px-3 py-1.5">{item}</span>
            ))}
          </div>
        </EchoReveal>

        <div className="relative min-h-[620px] overflow-hidden bg-[#e8eeeb] p-5 sm:p-8 lg:min-h-[720px]">
          <div className="grid h-full grid-cols-2 gap-4 sm:gap-5">
            <div className="flex flex-col justify-center gap-5 pt-14">
              {cards.slice(0, 2).map(({ image, label, detail, icon: Icon }, index) => (
                <EchoReveal
                  key={label}
                  variant="card"
                  delay={revealDelay(index)}
                  className={index === 0 ? "h-[250px]" : "h-[330px]"}
                >
                  <FlipMediaCard
                    image={image}
                    sizes="(min-width: 1024px) 28vw, 50vw"
                    href="/buddy"
                    backLabel="Reflective Buddy"
                    backTitle={label}
                    backDescription={detail}
                    backIcon={<Icon aria-hidden="true" />}
                    actionLabel="Open Buddy"
                    compact
                    className="h-full bg-[var(--landing-inverse)] shadow-[0_18px_55px_rgba(41,49,27,0.12)]"
                    frontContent={(
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-full bg-[var(--landing-inverse-90)] px-4 py-3 text-xs font-bold text-[var(--landing-ink)] backdrop-blur-md">
                        {label}
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                    )}
                  />
                </EchoReveal>
              ))}
            </div>

            <div className="flex flex-col gap-5">
              <EchoReveal variant="card" delay={120}>
                <div className="rounded-[var(--landing-card-radius)] bg-[#dce9b7] p-5 text-[var(--landing-ink)]">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  <p className="mt-8 text-2xl font-medium leading-tight tracking-[-0.04em]">Your words stay yours.</p>
                </div>
              </EchoReveal>
              {cards.slice(2).map(({ image, label, detail, icon: Icon }) => (
                <EchoReveal key={label} variant="card" delay={180} className="h-[390px]">
                  <FlipMediaCard
                    image={image}
                    sizes="(min-width: 1024px) 28vw, 50vw"
                    href="/buddy"
                    priority
                    backLabel="Reflective Buddy"
                    backTitle={label}
                    backDescription={detail}
                    backIcon={<Icon aria-hidden="true" />}
                    actionLabel="Open Buddy"
                    compact
                    className="h-full bg-[var(--landing-inverse)] shadow-[0_18px_55px_rgba(41,49,27,0.12)]"
                    frontContent={(
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-full bg-[var(--landing-inverse-90)] px-4 py-3 text-xs font-bold text-[var(--landing-ink)] backdrop-blur-md">
                        {label}
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                    )}
                  />
                </EchoReveal>
              ))}
              <EchoReveal variant="card" delay={240}>
                <div className="grid min-h-24 place-items-center rounded-[var(--landing-card-radius)] bg-[var(--landing-primary)] text-[var(--landing-inverse)]">
                  <HeartHandshake className="h-7 w-7" aria-hidden="true" />
                </div>
              </EchoReveal>
            </div>
          </div>
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
      className="relative isolate flex min-h-[680px] overflow-hidden bg-[#f8f7f3] text-[var(--landing-ink)] [font-family:var(--font-echo-sans)] sm:min-h-[720px] md:min-h-[620px] lg:min-h-[780px] xl:min-h-[820px]"
    >
      <div
        data-testid="growth-background"
        className="echo-growth-drift absolute inset-0 -z-10 bg-no-repeat [background-position:55%_bottom] [background-size:auto_70%] sm:[background-position:60%_bottom] sm:[background-size:auto_85%] md:[background-position:center_center] md:[background-size:cover]"
        style={{ backgroundImage: `url(${growthBackground.src})` }}
        aria-hidden="true"
      />

      <div className="mx-auto flex w-full max-w-[1440px] items-start px-5 pb-72 pt-24 sm:px-8 sm:pb-80 sm:pt-28 md:items-center md:px-10 md:py-20 lg:px-14 lg:py-24 xl:px-20">
        <EchoReveal variant="text" direction="right" className="max-w-[35rem]">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--landing-primary)]">
            A gentle beginning
          </p>
          <h2
            id="growth-heading"
            className="mt-5 max-w-[20rem] text-[clamp(3.375rem,7vw,6.75rem)] font-medium leading-[0.84] tracking-[-0.055em] text-[var(--landing-primary)] [font-family:var(--font-echo-display)] [text-wrap:balance] md:max-w-none"
          >
            Room to grow,
            <span className="block">at your pace</span>
          </h2>
          <p className="mt-7 max-w-[20rem] text-sm font-medium leading-6 text-[var(--landing-ink-75)] sm:max-w-[27rem] sm:text-base sm:leading-7">
            Notice what you feel, put it into words, and let ECHO help you find one gentle next step-privately, whenever you&apos;re ready.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex min-h-12 min-w-44 items-center justify-center rounded-full bg-[var(--landing-ink)] px-6 text-sm font-bold text-[var(--landing-inverse)] outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--landing-primary)] focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97]"
          >
            Begin a check-in
          </Link>
        </EchoReveal>
      </div>
    </section>
  );
}

export function CommunityStoriesSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--landing-cream)] px-4 py-20 text-[var(--landing-ink)] [font-family:var(--font-echo-sans)] sm:px-6 sm:py-24 lg:min-h-[780px] lg:px-8 lg:py-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[390px] lg:block" aria-hidden="true">
        {portraitImages.map((image, index) => (
          <EchoReveal
            key={image.src}
            variant="media"
            delay={revealDelay(index)}
            className={`absolute overflow-hidden rounded-[var(--landing-media-radius)] bg-[var(--landing-mist)] shadow-[0_14px_35px_rgba(41,49,27,0.1)] ${portraitPositions[index]}`}
          >
            <Image src={image.src} alt="" fill className="object-cover" sizes="128px" />
          </EchoReveal>
        ))}
      </div>

      <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-3 lg:hidden">
        {portraitImages.slice(0, 4).map((image, index) => (
          <EchoReveal key={image.src} variant="media" delay={revealDelay(index)} className="relative aspect-[0.78] overflow-hidden rounded-[var(--landing-media-radius)] bg-[var(--landing-mist)]">
            <Image src={image.src} alt={image.alt} fill className="object-cover" sizes="25vw" />
          </EchoReveal>
        ))}
      </div>

      <EchoReveal variant="text" className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center lg:pt-[330px]">
        <p className="mt-12 inline-flex rounded-full bg-[var(--landing-mist)] px-3 py-1.5 text-xs font-bold lg:mt-0">Private by design</p>
        <h2 className="mt-5 text-[clamp(2.75rem,5vw,5.75rem)] font-medium leading-[0.95] tracking-[-0.055em] [text-wrap:balance]">
          One space for
          <span className="block text-[var(--landing-muted)]">everyday reflection</span>
