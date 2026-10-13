"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  ExternalLink,
  Globe2,
  HandHeart,
  HeartHandshake,
  Leaf,
  LoaderCircle,
  MapPin,
  MessageCircleHeart,
  Phone,
  Search,
  ShieldCheck,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/shared/components/layout/echo-shells";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { experienceApi, type SupportResource } from "@/services/experience/experience-api";
import { normalizeError } from "@/shared/errors/normalize-error";

type SupportFilter = "all" | "emergency" | "crisis_hotline" | "clinic";
type MobilePanel = "directory" | "guidance";

const filters: Array<{ id: SupportFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Globe2 },
  { id: "emergency", label: "Emergency", icon: AlertTriangle },
  { id: "crisis_hotline", label: "Crisis hotlines", icon: HeartHandshake },
  { id: "clinic", label: "Clinics", icon: Building2 },
];

const selfHelpLinks = [
  {
    href: "/tools/grounding",
    title: "Grounding tools",
    description: "Settle into a short, guided reset.",
    icon: Wind,
  },
  {
    href: "/journal/new",
    title: "Write privately",
    description: "Put what is present into your own words.",
    icon: BookOpen,
  },
  {
    href: "/buddy",
    title: "Reflect with Buddy",
    description: "Continue with supportive guided reflection.",
    icon: MessageCircleHeart,
  },
  {
    href: "/professional-support/requests/new",
    title: "Professional support",
    description: "Send a private support request.",
    icon: HandHeart,
  },
] as const;

function phoneHref(phoneNumber: string): string {
  return `tel:${phoneNumber.replace(/[^\d+]/g, "")}`;
}

function checkedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Review date unavailable";
  return `Checked ${new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

function resourceIcon(type: string): LucideIcon {
  if (type === "emergency") return AlertTriangle;
  if (type === "clinic") return Building2;
  return Phone;
}

function ResourceRow({ resource }: { resource: SupportResource }) {
  const Icon = resourceIcon(resource.type);
  const isEmergency = resource.type === "emergency";

  return (
    <li>
      <article
        className={`grid gap-3 rounded-2xl border px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-150 focus-within:ring-4 focus-within:ring-primary/10 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-4 ${
          isEmergency
            ? "border-[#ef6f61]/25 bg-[#fff3f0] shadow-[0_10px_24px_rgba(143,53,43,0.06)]"
            : "border-[var(--landing-primary-10)] bg-white/62 hover:border-[var(--landing-primary-20)] hover:bg-white/80"
        }`}
      >
        <span
          className={`grid h-11 w-11 place-items-center rounded-full ${
            isEmergency ? "bg-[#ffe1dc] text-[#b84235]" : "bg-[#e5f1e5] text-primary"
          }`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 sm:col-start-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-sm font-bold tracking-[-0.015em] text-foreground sm:text-[15px]">
              {resource.name}
            </h2>
            {resource.availability ? (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                isEmergency ? "bg-[#ffe1dc] text-[#a3392f]" : "bg-secondary text-primary"
              }`}>
                {resource.availability}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
            {resource.organizationName}
          </p>
          {resource.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:max-w-2xl">
              {resource.description}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Verified
            </span>
            <span>{checkedDate(resource.lastVerifiedAt)}</span>
            {resource.verificationSource ? (
              <a
                href={resource.verificationSource}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end">
          {resource.phoneNumber ? (
            <a
              href={phoneHref(resource.phoneNumber)}
              aria-label={`Call ${resource.name} at ${resource.phoneNumber}`}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold outline-none transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/20 ${
                isEmergency
                  ? "bg-[#ffd8d2] text-[#8d2f27] hover:bg-[#ffc9c1]"
                  : "bg-[#e3f0e5] text-primary hover:bg-[#d5e8d8]"
              }`}
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {resource.phoneNumber}
            </a>
          ) : null}
          {resource.websiteUrl ? (
            <a
              href={resource.websiteUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Visit ${resource.name} website`}
              className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card text-primary outline-none transition-[background-color,transform] duration-150 hover:bg-secondary active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function DangerNotice({ titleId }: { titleId: string }) {
  return (
    <section className="shrink-0 rounded-[1.35rem] border border-[#ef6f61]/20 bg-[linear-gradient(135deg,#fff1ed,#eef6ed)] p-3.5" aria-labelledby={titleId}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffddd7] text-[#b43c31]" aria-hidden="true">
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-bold text-foreground">If you are in immediate danger</h2>
          <p className="mt-1 text-[11px] leading-[1.55] text-muted-foreground">
            Contact emergency services or open ECHO&apos;s immediate crisis guidance now.
          </p>
          <Link href="/crisis" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#9e352c] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef6f61]/30">
            Open crisis support <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function GuidancePanel() {
  return (
    <div className="grid min-h-0 content-start gap-3">
      <section className="rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-card/84 p-3.5 shadow-[0_14px_34px_rgba(30,53,34,0.06)]" aria-labelledby="self-help-title">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary" aria-hidden="true">
            <Leaf className="h-4 w-4" />
          </span>
          <h2 id="self-help-title" className="text-sm font-bold text-foreground">Self-help resources</h2>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {selfHelpLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={`${item.title}. ${item.description}`}
                className="group flex min-h-14 items-center gap-2 rounded-xl border border-border/65 bg-white/58 px-2.5 py-2 outline-none transition-[background-color,transform] duration-150 hover:translate-x-0.5 hover:bg-white/85 focus-visible:ring-4 focus-visible:ring-primary/15 active:scale-[0.99] motion-reduce:transform-none"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e5f1e5] text-primary" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[11px] leading-4 text-foreground">{item.title}</strong>
                  <span className="sr-only">{item.description}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-[var(--landing-primary-10)] bg-card/84 p-3.5 shadow-[0_14px_34px_rgba(30,53,34,0.06)]" aria-labelledby="reach-out-title">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff2cf] text-[#80662a]" aria-hidden="true">
            <HandHeart className="h-4 w-4" />
          </span>
          <h2 id="reach-out-title" className="text-sm font-bold text-foreground">Before you reach out</h2>
        </div>
        <ul className="mt-3 grid gap-2 text-[11px] leading-4 text-muted-foreground">
          <li className="flex gap-2"><span className="font-bold text-primary">01</span> Find a safe and private place if you can.</li>
          <li className="flex gap-2"><span className="font-bold text-primary">02</span> Be honest about what you are feeling.</li>
          <li className="flex gap-2"><span className="font-bold text-primary">03</span> Share only what you are ready to say.</li>
        </ul>
      </section>

    </div>
  );
}

export default function FindHelpPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SupportFilter>("all");
  const [activePanel, setActivePanel] = useState<MobilePanel>("directory");
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setResources(await experienceApi.getSupportResources({ country: "PH" }));
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return resources.filter((resource) => {
      if (type !== "all" && resource.type !== type) return false;
      if (!normalizedQuery) return true;
      return [resource.name, resource.organizationName, resource.description, resource.availability]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, resources, type]);

  const availableTypes = useMemo(() => new Set(resources.map((resource) => resource.type)), [resources]);

  return (
    <AppShell containedViewport publicAccess>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <header className="grid shrink-0 gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_21rem] min-[900px]:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">Support directory</p>
            <h1 className="mt-1 text-[2.15rem] font-medium leading-none tracking-[-0.05em] text-foreground [font-family:var(--font-echo-display)] sm:text-[2.65rem]">
              Find help
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-[13px]">
              Access reviewed mental-health support resources in the Philippines. ECHO is not an emergency service or a substitute for professional care.
            </p>
          </div>
          <EchoMotionSurface
            as="div"
            tilt={false}
            className="hidden items-center gap-3 rounded-[1.25rem] border border-[var(--landing-primary-10)] bg-[linear-gradient(120deg,rgba(251,247,238,0.92),rgba(222,236,219,0.78))] px-4 py-3 shadow-[0_12px_30px_rgba(30,53,34,0.06)] min-[900px]:flex"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-primary" aria-hidden="true">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground [font-family:var(--font-echo-display)]">You are not alone.</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Help is always within reach.</p>
            </div>
          </EchoMotionSurface>
        </header>

        <div className="shrink-0 min-[1180px]:hidden">
          <DangerNotice titleId="mobile-danger-title" />
        </div>

        <div className="grid shrink-0 grid-cols-2 rounded-full border border-border/70 bg-card/70 p-1 min-[1180px]:hidden" role="tablist" aria-label="Find help sections">
          {(["directory", "guidance"] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              role="tab"
              id={`${panel}-tab`}
              aria-label={panel === "directory" ? "Directory" : "Guidance"}
              aria-selected={activePanel === panel}
              aria-controls={`${panel}-panel`}
              onClick={() => setActivePanel(panel)}
              className={`min-h-9 rounded-full px-4 text-xs font-bold capitalize outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-primary/15 ${
                activePanel === panel ? "bg-primary text-primary-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {panel}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 min-[1180px]:grid-cols-[minmax(0,1fr)_19rem] min-[1180px]:gap-3">
          <EchoMotionSurface
            as="section"
            tilt={false}
            id="directory-panel"
            role="tabpanel"
            aria-labelledby="directory-tab"
            aria-label="Support directory"
            className={`${activePanel === "directory" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-[1.45rem] border border-[var(--landing-primary-10)] bg-card/72 shadow-[0_18px_48px_rgba(30,53,34,0.07)] min-[1180px]:flex`}
          >
            <div className="shrink-0 border-b border-border/65 px-3 py-2.5 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filters.map((filter) => {
                    const Icon = filter.icon;
                    const unavailable = filter.id !== "all" && !availableTypes.has(filter.id);
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setType(filter.id)}
                        disabled={unavailable && !isLoading}
                        aria-pressed={type === filter.id}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold outline-none transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 ${
                          type === filter.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/70 bg-white/60 text-foreground hover:border-primary/25 hover:bg-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search resources"
                      aria-label="Search support resources"
                      className="h-9 w-full rounded-full border border-border/70 bg-white/70 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/30 focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <span className="hidden min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-white/60 px-3 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Philippines
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground" role="status" aria-live="polite">
                {isLoading ? "Loading reviewed resources" : `${filteredResources.length} reviewed resource${filteredResources.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div
              data-testid="support-resource-list"
              tabIndex={0}
              aria-label="Reviewed support resources"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/15 sm:px-4"
            >
              {isLoading ? (
                <div className="grid h-full min-h-40 place-items-center text-center" role="status">
                  <div>
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                    <p className="mt-2 text-xs font-semibold text-foreground">Loading reviewed support resources</p>
                  </div>
                </div>
              ) : error ? (
                <div className="grid h-full min-h-40 place-items-center text-center" role="alert">
                  <div className="max-w-sm">
                    <AlertTriangle className="mx-auto h-6 w-6 text-[#b43c31]" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-foreground">The directory could not be loaded.</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
                    <button type="button" onClick={() => void load()} className="mt-3 min-h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                      Try again
                    </button>
                  </div>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="grid h-full min-h-40 place-items-center text-center">
                  <div className="max-w-sm">
                    <Search className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-foreground">No reviewed matches found.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try another name or return to all resources.</p>
                    <button type="button" onClick={() => { setQuery(""); setType("all"); }} className="mt-3 min-h-10 rounded-full border border-border bg-card px-4 text-xs font-bold text-primary outline-none focus-visible:ring-4 focus-visible:ring-primary/15">
                      View all resources
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="grid gap-2.5">
                  {filteredResources.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
                </ul>
              )}
            </div>
          </EchoMotionSurface>

          <section
            id="guidance-panel"
            role="tabpanel"
            aria-labelledby="guidance-tab"
            aria-label="Support guidance"
            className={`${activePanel === "guidance" ? "grid" : "hidden"} min-h-0 content-start gap-3 overflow-hidden min-[1180px]:grid`}
          >
            <div className="hidden min-[1180px]:block">
              <DangerNotice titleId="desktop-danger-title" />
            </div>
            <GuidancePanel />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
