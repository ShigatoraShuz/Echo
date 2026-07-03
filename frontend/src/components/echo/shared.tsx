import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  MapPin,
  Shield,
  UserRound,
} from "lucide-react";
import { getEchoImage, type EchoImageKey } from "@/lib/unsplash-images";
import { cn } from "@/lib/utils";
import {
  moodStyles,
  riskBandStyles,
  type EchoMood,
  type EchoRiskBand,
} from "@/lib/theme";
import type { ChatMessage, JournalEntry, Provider, TrendPoint } from "@/types";

export function EchoCard({
  title,
  description,
  action,
  children,
  className,
  compact = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn(compact ? "echo-compact-card" : "echo-card", "min-w-0", className)}>
      {title || description || action ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {label ? <p className="text-sm font-medium text-primary">{label}</p> : null}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function EchoImage({
  imageKey,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  imageKey: EchoImageKey;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const image = getEchoImage(imageKey);

  return (
    <figure className={cn("relative overflow-hidden rounded-2xl bg-secondary", className)}>
      <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} className="object-cover" />
      <figcaption className="sr-only">{image.category}</figcaption>
    </figure>
  );
}

export function MoodBadge({ mood }: { mood: EchoMood }) {
  return <span className={moodStyles[mood]}>{mood}</span>;
}

export function RiskBadge({ band }: { band: EchoRiskBand }) {
  return <span className={riskBandStyles[band]}>{band}</span>;
}

export function RiskScoreRing({
  score,
  band,
  label = "Distress signal",
}: {
  score: number;
  band: EchoRiskBand;
  label?: string;
}) {
  const safeScore = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(hsl(var(--risk-${band})) ${safeScore * 3.6}deg, hsl(var(--risk-${band}-soft)) 0deg)`,
        }}
        aria-label={`${label}: ${safeScore} out of 100, ${band}`}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center shadow-subtle">
          <span className="text-2xl font-semibold text-foreground">{safeScore}</span>
        </div>
      </div>
      <div className="space-y-2">
        <RiskBadge band={band} />
        <p className="text-sm leading-6 text-muted-foreground">
          {label} only. This is not a diagnosis or diagnostic tool.
        </p>
      </div>
    </div>
  );
}

export function CrisisHelpCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-danger/30 bg-crisis-soft p-5", compact && "p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crisis text-danger-foreground">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Immediate support is available</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            If you may be in danger, contact emergency services or a crisis line now. ECHO is not a diagnostic tool.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href="/crisis" className="echo-button-primary bg-crisis text-danger-foreground hover:bg-crisis/90">
          Get crisis support
        </Link>
        <Link href="/crisis-help" className="echo-button-secondary">
          View resources
        </Link>
      </div>
    </div>
  );
}

export function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  return (
    <article className="min-w-0 rounded-2xl border border-border/70 bg-background p-5 shadow-subtle">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{entry.date}</p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">{entry.title}</h2>
        </div>
        <MoodBadge mood={entry.mood} />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{entry.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RiskBadge band={entry.riskBand} />
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <Link href={`/journal/${entry.id}`} className="mt-5 inline-flex text-sm font-semibold text-primary">
        Read reflection
      </Link>
    </article>
  );
}

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isBuddy = message.role === "buddy";
  const Icon = isBuddy ? Bot : UserRound;

  return (
    <div className={cn("flex gap-3", !isBuddy && "justify-end")}>
      {isBuddy ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-subtle",
          isBuddy
            ? "rounded-tl-md border border-border/70 bg-background text-foreground"
            : "rounded-tr-md bg-secondary text-secondary-foreground",
        )}
      >
        <p>{message.content}</p>
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">{message.timestamp}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
        {icon ?? <HeartHandshake className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingState({ label = "Loading ECHO" }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-subtle">
      <Loader2 className="mb-4 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-crisis-soft p-6">
      <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function ConsentCard({
  title,
  description,
  checked = false,
}: {
  title: string;
  description: string;
  checked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-4 rounded-2xl border border-border/70 bg-background p-4 shadow-subtle">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        {checked ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : null}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="echo-compact-card">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

export function BreathingCircle({ label = "Breathe" }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-border/70 bg-background p-8">
      <div className="echo-breathing-circle grid h-48 w-48 place-items-center rounded-full border border-primary/30 bg-secondary text-primary shadow-soft">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-card text-center shadow-subtle">
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <EchoImage imageKey={provider.imageKey as EchoImageKey} className="h-44 rounded-none" sizes="(min-width: 1024px) 33vw, 100vw" />
      <div className="p-5">
        <h2 className="text-base font-semibold text-foreground">{provider.name}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{provider.specialty}</p>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            {provider.distance}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            {provider.availability}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {provider.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function DataChartCard({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
}) {
  return (
    <EchoCard title={title} description={description}>
      <div className="chart-card-grid flex h-56 items-end gap-3 rounded-xl border border-border/70 bg-background p-4">
        {points.map((point, index) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-xl shadow-subtle"
              style={{
                height: `${Math.max(point.value, 8)}%`,
                background: `hsl(var(--chart-${(index % 5) + 1}))`,
              }}
            />
            <span className="truncate text-xs font-medium text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
    </EchoCard>
  );
}

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-secondary/40 p-4", !compact && "sm:p-5")}>
      <div className="flex gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-6 text-muted-foreground">
          ECHO is private by design and is not a diagnostic tool. Mood and distress signals are reflective summaries,
          not medical conclusions.
        </p>
      </div>
    </div>
  );
}
