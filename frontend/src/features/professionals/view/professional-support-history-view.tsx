"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, HeartHandshake } from "lucide-react";
import { ROUTES } from "@/config/routes.config";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { ProfessionalSupportHeader } from "../components/professional-support-header";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import {
  professionalApi,
  type CaseDetail,
  type CaseEvent,
  type Organization,
  type SupportRequest,
} from "@/services/professionals/professional-api";
import { ProfessionalSupportNav } from "../components/professional-support-nav";
import { RequestStatus } from "../components/professional-shell";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const closedStatuses = ["closed", "declined", "withdrawn"];

export function ProfessionalSupportHistoryView() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [timelineError, setTimelineError] = useState("");

  useEffect(() => {
    let active = true;
    void professionalApi
      .ownRequests()
      .then((own) => {
        if (!active) return;
        const previous = own.requests.filter((item) => closedStatuses.includes(item.status));
        setRequests(previous);
        setSelectedId(previous[0]?.id ?? "");
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setRequests([]);
        }
      });
    void professionalApi
      .organizations()
      .then((result) => {
        if (active) setOrganizations(result.organizations);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoadingDetail(true);
    setError("");
    setDetail(null);
    setEvents([]);
    setTimelineError("");
    void professionalApi
      .ownDetail(selectedId)
      .then((caseDetail) => {
        if (active) setDetail(caseDetail);
      })
      .catch((reason) => {
        if (active) setError(normalizeError(reason).userMessage);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    void professionalApi
      .timeline(selectedId)
      .then((timeline) => {
        if (active) setEvents(timeline.events);
      })
      .catch((reason) => {
        if (active) setTimelineError(normalizeError(reason).userMessage);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const visible = requests?.filter((item) => filter === "all" || item.status === filter) ?? [];
  const organizationName = (id: string) =>
    organizations.find((item) => item.id === id)?.name ?? "Professional organization";
  return (
    <AppShell>
      <ProfessionalSupportNav />
      <ProfessionalSupportHeader
        label="Your past support"
        title="Support History"
        description="Review previous cases, consultations, referrals, and the updates your support team recorded. Your private professional notes are not shown here."
      />
      {requests === null ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading support history</span>
          <EchoSkeleton variant="rectangular" className="h-80" />
        </div>
      ) : error && requests.length === 0 ? null : requests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-7">
          <Clock3 className="text-primary" />
          <h2 className="mt-3 text-lg font-semibold">No past cases yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Closed, declined, and withdrawn requests will appear here.
          </p>
          <Link
            href={ROUTES.professionalSupport.requests}
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary"
          >
            View current requests <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter support history">
            {[
              ["all", "All"],
              ["closed", "Closed"],
              ["declined", "Declined"],
              ["withdrawn", "Withdrawn"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  const first = requests.find((item) => value === "all" || item.status === value);
                  setSelectedId(first?.id ?? "");
                  if (!first) {
                    setDetail(null);
                    setEvents([]);
                  }
                }}
                className={`min-h-9 rounded-full px-4 text-xs font-bold transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {visible.length ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[270px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
              <nav
                aria-label="Previous support cases"
                className="min-w-0 space-y-2 rounded-[1.3rem] border border-border/70 bg-card/95 p-3 shadow-subtle lg:max-h-[70vh] lg:overflow-y-auto"
              >
                {visible.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-current={selectedId === item.id ? "true" : undefined}
                    className={`echo-workspace-tile w-full rounded-xl border p-3 text-left ${selectedId === item.id ? "border-primary/30 bg-secondary" : "border-border/60 hover:bg-secondary/50"}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <strong className="min-w-0 truncate text-sm">{organizationName(item.organizationId)}</strong>
                      <RequestStatus status={item.status} />
                    </span>
                    <time className="mt-2 block text-xs text-muted-foreground">Updated {format(item.updatedAt)}</time>
                  </button>
                ))}
              </nav>
              <section
                aria-label="Selected case history"
                className="min-w-0 rounded-[1.3rem] border border-border/70 bg-card/95 p-5 shadow-subtle sm:p-6"
              >
                {loadingDetail ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading case history…
                  </p>
                ) : detail ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                      <div>
                        <h2 className="text-xl [font-family:var(--font-echo-display)]">
                          {organizationName(detail.request.organizationId)}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted {format(detail.request.createdAt)}
                        </p>
                      </div>
                      <RequestStatus status={detail.request.status} />
                    </div>
                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold">Your request</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {detail.request.summary || "Your request summary is unavailable."}
                        </p>
                      </div>
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <CalendarDays size={16} className="text-primary" /> Consultations
                        </h3>
                        {detail.appointments.length ? (
                          <ul className="mt-2 space-y-2">
                            {detail.appointments.map((item) => (
                              <li key={item.id} className="rounded-xl bg-secondary/50 p-3 text-xs">
                                <strong className="block">{format(item.startsAt)}</strong>
                                <span className="capitalize text-muted-foreground">
                                  {item.mode.replaceAll("_", " ")} · {item.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No appointments were recorded for this case.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-5 border-t border-border pt-5 xl:grid-cols-2">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <HeartHandshake size={16} className="text-primary" /> Referrals & follow-up resources
                        </h3>
                        {detail.referrals.length ? (
                          <ul className="mt-2 space-y-2">
                            {detail.referrals.map((item) => (
                              <li key={item.id} className="rounded-xl bg-secondary/50 p-3 text-xs">
                                {item.resourceUrl ? (
                                  <a
                                    href={item.resourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary underline"
                                  >
                                    {item.resourceName}
                                  </a>
                                ) : (
                                  <strong>{item.resourceName}</strong>
                                )}
                                <time className="mt-1 block text-muted-foreground">{format(item.createdAt)}</time>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No referrals or follow-up resources were recorded.
                          </p>
                        )}
                      </div>
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Clock3 size={16} className="text-primary" /> Case updates
                        </h3>
                        {timelineError ? (
                          <p role="alert" className="mt-2 text-xs text-danger">
                            Case updates could not be loaded. {timelineError}
                          </p>
                        ) : events.length ? (
                          <ol className="mt-2 space-y-2">
                            {events.map((item) => (
                              <li key={item.id} className="border-l-2 border-primary/25 pl-3 text-xs">
                                <strong className="block">{item.label}</strong>
                                <time className="text-muted-foreground">{format(item.createdAt)}</time>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">No case updates were recorded.</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={ROUTES.professionalSupport.request(detail.request.id)}
                      className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary"
                    >
                      Open full case <ArrowRight size={13} />
                    </Link>
                  </>
                ) : null}
              </section>
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No {filter} cases in your recent history.
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            History currently includes your 50 most recent support requests.
          </p>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}
