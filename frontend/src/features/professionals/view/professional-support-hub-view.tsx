"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  HeartHandshake,
  Leaf,
  MessageCircle,
  PenLine,
  ShieldCheck,
  Stethoscope,
  Wind,
} from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { EchoMotionSurface } from "@/shared/components/ui/echo-motion-surface";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type ProfessionalHub } from "@/services/professionals/professional-api";
import { ProfessionalSupportNav } from "../components/professional-support-nav";
import { RequestStatus } from "../components/professional-shell";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ProfessionalSupportHubView() {
  const [hub, setHub] = useState<ProfessionalHub | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const controller = new AbortController();
    setError("");
    void professionalApi
      .hub(controller.signal)
      .then(setHub)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(normalizeError(reason).userMessage);
      });
    return () => controller.abort();
  }, []);
  useEffect(load, [load]);

  return (
    <AppShell>
      <header className="echo-workspace-enter relative mb-4 overflow-hidden rounded-[1.4rem] border border-primary/15 bg-[radial-gradient(circle_at_87%_28%,hsl(var(--accent)/0.35)_0%,transparent_16%),linear-gradient(105deg,hsl(var(--card))_35%,hsl(var(--secondary))_100%)] px-5 py-5 sm:px-7">
        <div
          className="pointer-events-none absolute bottom-0 right-0 hidden h-24 w-[43%] opacity-70 md:block"
          aria-hidden="true"
        >
          <div className="absolute inset-x-0 bottom-0 h-16 rounded-t-[100%] bg-[#acc7b2]/50" />
          <div className="absolute -right-10 bottom-0 h-10 w-full rounded-t-[100%] bg-[#49735c]/35" />
          <Leaf className="absolute bottom-5 right-10 h-16 w-16 text-[#467459]/55" strokeWidth={1} />
        </div>
        <div className="relative max-w-[680px]">
          <p className="text-[11px] font-black uppercase tracking-[.17em] text-primary">Professional support</p>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.3rem)] leading-tight [font-family:var(--font-echo-display)]">
            Support Overview
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Find reviewed care, follow requests, manage appointments, and control what you share.
          </p>
        </div>
      </header>
      <ProfessionalSupportNav />
      {!hub && !error ? (
        <div role="status" aria-busy="true" className="grid gap-4 lg:grid-cols-3">
          <span className="sr-only">Loading professional support</span>
          <EchoSkeleton variant="rectangular" className="h-48 lg:col-span-2" />
          <EchoSkeleton variant="rectangular" className="h-48" />
        </div>
      ) : hub ? (
        <OverviewContent hub={hub} />
      ) : null}
      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm">
          {error}{" "}
          <button type="button" className="ml-2 font-bold underline" onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

function OverviewContent({ hub }: { hub: ProfessionalHub }) {
  const [selectedId, setSelectedId] = useState(hub.activeCases[0]?.id ?? "");
  const active = hub.activeCases.find((item) => item.id === selectedId) ?? hub.activeCases[0];
  const organizationName = (id: string) =>
    hub.organizations.find((item) => item.id === id)?.name ?? "Professional organization";
  const appointment = hub.upcomingAppointment;
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {hub.activeCases.length > 1 ? (
          <label className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground">
            Active case
            <select
              className="echo-input max-w-sm"
              value={active.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {hub.activeCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {organizationName(item.organizationId)} · {item.status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <EchoMotionSurface
            tilt={false}
            entryDelay={40}
            className="echo-workspace-tile min-h-48 rounded-[1.35rem] border border-border/70 bg-card/95 p-5 shadow-subtle"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold">Your current support</h2>
              {active ? <RequestStatus status={active.status} /> : null}
            </div>
            {active ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    <Stethoscope size={23} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-base">
                      {active.assignedProfessional?.displayName ?? organizationName(active.organizationId)}
                    </strong>
                    <p className="truncate text-xs text-muted-foreground">
                      {active.assignedProfessional
                        ? `${active.assignedProfessional.credentialLabel ?? active.assignedProfessional.role.replaceAll("_", " ")} · ${organizationName(active.organizationId)}`
                        : active.assignedTo
                          ? "Practitioner assigned"
                          : "Waiting for organization review"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={ROUTES.professionalSupport.request(active.id)}
                    className="echo-button-primary inline-flex min-h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold"
                  >
                    View case <ArrowRight size={14} />
                  </Link>
                  {active.assignedTo ? (
                    <Link
                      href={ROUTES.professionalSupport.messages}
                      className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-primary/25 px-4 text-xs font-bold text-primary"
                    >
                      Messages <MessageCircle size={14} />
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  No active support case. Browse reviewed practitioners and choose when to reach out.
                </p>
                <Link
                  href={ROUTES.professionalSupport.discover}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  Find a professional <ArrowRight size={15} />
                </Link>
              </>
            )}
          </EchoMotionSurface>
          <EchoMotionSurface
            tilt={false}
            entryDelay={90}
            className="echo-workspace-tile min-h-48 rounded-[1.35rem] border border-border/70 bg-card/95 p-5 shadow-subtle"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold">Upcoming appointment</h2>
              <CalendarDays size={18} className="text-primary" aria-hidden="true" />
            </div>
            {appointment ? (
              <>
                <p className="mt-5 text-lg font-semibold">{format(appointment.startsAt)}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {appointment.mode.replaceAll("_", " ")} · {appointment.status}
                </p>
                {appointment.locationHint ? (
                  <p className="mt-1 text-xs text-muted-foreground">{appointment.locationHint}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                No appointment is scheduled. Offers from your support team will appear here.
              </p>
            )}
            <Link
              href={ROUTES.professionalSupport.appointments}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary"
            >
              View schedule <ArrowRight size={15} />
            </Link>
          </EchoMotionSurface>
          <EchoMotionSurface
            tilt={false}
            entryDelay={140}
            className="echo-workspace-tile rounded-[1.35rem] border border-border/70 bg-card/95 p-5 shadow-subtle"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">Recent messages</h2>
              <Link href={ROUTES.professionalSupport.messages} className="text-xs font-bold text-primary">
                See all <ArrowRight size={13} className="inline" />
              </Link>
            </div>
            {hub.recentMessages.length ? (
              <div className="mt-3 divide-y divide-border/70">
                {hub.recentMessages.map((message) => {
                  const request = [...hub.activeCases, ...hub.recentCases].find(
                    (item) => item.id === message.requestId,
                  );
                  return (
                    <Link
                      key={message.id}
                      href={`${ROUTES.professionalSupport.request(message.requestId)}#case-messages`}
                      className="block py-3 transition-colors hover:text-primary"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <strong className="truncate">
                          {request ? organizationName(request.organizationId) : "Support case"}
                        </strong>
                        <time className="shrink-0 text-muted-foreground">{format(message.createdAt)}</time>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {message.sender === "user" ? "You: " : ""}
                        {message.body}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                No case messages yet. Messages appear after a practitioner is assigned.
              </p>
            )}
          </EchoMotionSurface>
          <EchoMotionSurface
            tilt={false}
            entryDelay={190}
            className="echo-workspace-tile rounded-[1.35rem] border border-border/70 bg-card/95 p-5 shadow-subtle"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">My support requests</h2>
              <Link href={ROUTES.professionalSupport.requests} className="text-xs font-bold text-primary">
                See all <ArrowRight size={13} className="inline" />
              </Link>
            </div>
            {hub.recentCases.length ? (
              <div className="mt-3 divide-y divide-border/70">
                {hub.recentCases.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={ROUTES.professionalSupport.request(item.id)}
                    className="flex items-center justify-between gap-2 py-3 hover:text-primary"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-xs">{organizationName(item.organizationId)}</strong>
                      <span className="text-[11px] text-muted-foreground">Updated {format(item.updatedAt)}</span>
                    </span>
                    <RequestStatus status={item.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">No requests yet. You control when to start one.</p>
            )}
          </EchoMotionSurface>
        </div>
        <EchoMotionSurface
          tilt={false}
          entryDelay={230}
          className="rounded-[1.35rem] border border-border/70 bg-card/95 p-4 shadow-subtle"
        >
          <h2 className="text-sm font-bold">Helpful next steps</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link
              href={ROUTES.journal.list}
              className="echo-workspace-tile flex items-center gap-3 rounded-xl bg-secondary/55 p-3 text-xs font-semibold"
            >
              <PenLine size={18} className="shrink-0 text-primary" /> Write a reflection{" "}
              <ArrowRight size={13} className="ml-auto shrink-0" />
            </Link>
            <Link
              href={ROUTES.tools.grounding}
              className="echo-workspace-tile flex items-center gap-3 rounded-xl bg-secondary/55 p-3 text-xs font-semibold"
            >
              <Wind size={18} className="shrink-0 text-primary" /> Try grounding{" "}
              <ArrowRight size={13} className="ml-auto shrink-0" />
            </Link>
            <Link
              href={ROUTES.support.findHelp}
              className="echo-workspace-tile flex items-center gap-3 rounded-xl bg-secondary/55 p-3 text-xs font-semibold"
            >
              <HeartHandshake size={18} className="shrink-0 text-primary" /> Find help{" "}
              <ArrowRight size={13} className="ml-auto shrink-0" />
            </Link>
          </div>
        </EchoMotionSurface>
      </div>
      <aside className="min-w-0 space-y-4">
        <EchoMotionSurface
          tilt={false}
          entryDelay={70}
          className="rounded-[1.35rem] border border-border/70 bg-card/95 p-4 shadow-subtle"
        >
          <h2 className="text-sm font-bold">Quick actions</h2>
          <div className="mt-3 space-y-1.5">
            {[
              {
                href: ROUTES.professionalSupport.discover,
                icon: Compass,
                label: "Find a professional",
                hint: "Browse reviewed practitioners",
              },
              {
                href: ROUTES.professionalSupport.requests,
                icon: Clock3,
                label: "Track my requests",
                hint: "View status and updates",
              },
              {
                href: ROUTES.professionalSupport.appointments,
                icon: CalendarDays,
                label: "View appointments",
                hint: "Manage your schedule",
              },
              {
                href: ROUTES.professionalSupport.messages,
                icon: MessageCircle,
                label: "Messages",
                hint: `${hub.unreadCount} unread ${hub.unreadCount === 1 ? "message" : "messages"}`,
              },
            ].map(({ href, icon: Icon, label, hint }) => (
              <Link
                key={href}
                href={href}
                className="echo-workspace-tile flex items-center gap-2.5 rounded-xl border border-border/65 p-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-xs">{label}</strong>
                  <small className="block truncate text-[11px] text-muted-foreground">{hint}</small>
                </span>
                <ArrowRight size={14} className="ml-auto shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </EchoMotionSurface>
        <EchoMotionSurface
          tilt={false}
          entryDelay={130}
          className="rounded-[1.35rem] border border-border/70 bg-card/95 p-4 shadow-subtle"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-primary" />
            <h2 className="text-sm font-bold">Your sharing</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Your journal stays private by default. Only records you explicitly choose are shared with an assigned
            practitioner while consent is active.
          </p>
          {active ? (
            <>
              <p className="mt-2 text-xs font-semibold">
                {active.sharedJournalCount} journal · {active.sharedPhq8Count} PHQ-8 shared
              </p>
              <Link
                href={ROUTES.professionalSupport.request(active.id)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary"
              >
                Manage sharing <ArrowRight size={13} />
              </Link>
            </>
          ) : null}
        </EchoMotionSurface>
        <div className="rounded-[1.35rem] border border-danger/20 bg-danger/10 p-4">
          <div className="flex items-center gap-2">
            <HeartHandshake size={17} className="text-danger" />
            <h2 className="text-sm font-bold">Need immediate help?</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Support messages are not monitored continuously. If you need help now, use immediate support resources.
          </p>
          <Link
            href="/crisis"
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl bg-danger px-3 text-xs font-bold text-white"
          >
            Open crisis support <ArrowRight size={13} />
          </Link>
        </div>
      </aside>
    </div>
  );
}
