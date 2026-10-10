"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { AppShell } from "@/shared/components/layout/echo-shells";
import { PageHeader } from "@/shared/components/layout/page-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import {
  professionalApi,
  type CaseDetail,
  type Organization,
  type SupportRequest,
} from "@/services/professionals/professional-api";
import { RequestStatus } from "../components/professional-shell";

const format = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function MyRequestsView() {
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([professionalApi.ownRequests(), professionalApi.organizations()])
      .then(([own, orgs]) => {
        if (active) {
          setRequests(own.requests);
          setOrganizations(orgs.organizations);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setRequests([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <AppShell>
      <PageHeader
        title="My support requests"
        description="Follow each request and review exactly what you chose to share."
        action={
          <Link href="/professional/request" className="echo-button-primary inline-flex rounded-xl px-5 py-3 text-sm">
            New request
          </Link>
        }
      />
      {requests === null ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Loading support requests</span>
          {[0, 1, 2].map((item) => (
            <EchoSkeleton key={item} variant="rectangular" className="h-28 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
          No support requests yet. Your private journal remains yours until you choose to share something.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <Link
              key={item.id}
              href={`/professional/my-requests/${item.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-subtle transition-colors hover:border-primary/30"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">
                    {organizations.find((org) => org.id === item.organizationId)?.name ?? "Professional organization"}
                  </strong>
                  <RequestStatus status={item.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Submitted {format(item.createdAt)} · {item.sharingActive ? "Sharing active" : "Sharing stopped"}
                </p>
              </div>
              <ArrowRight size={19} className="text-primary" />
            </Link>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}

export function MyRequestDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      setDetail(await professionalApi.ownDetail(id));
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function act(action: "revoke" | "accept" | "decline" | "cancel", appointmentId?: string) {
    setBusy(action);
    setError("");
    try {
      if (action === "revoke") await professionalApi.revoke(id);
      else if (appointmentId && action === "cancel") await professionalApi.cancelAppointment(appointmentId);
      else if (appointmentId) await professionalApi.respondAppointment(appointmentId, action === "accept");
      await refresh();
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusy("");
    }
  }
  return (
    <AppShell>
      <Link
        href="/professional/my-requests"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={16} />
        All requests
      </Link>
      <PageHeader
        title="Your support request"
        description="Track the response and control future access to the information you shared."
      />
      {!detail && !error ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading request</span>
          <EchoSkeleton variant="rectangular" className="h-52 w-full" />
          <EchoSkeleton variant="rectangular" className="h-40 w-full" />
        </div>
      ) : detail ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">What you sent</h2>
                <RequestStatus status={detail.request.status} />
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{detail.request.summary}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Preferred time: {detail.request.preferredTime || "Not specified"}
              </p>
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="text-2xl [font-family:var(--font-echo-display)]">Journal snapshots selected</h2>
              {detail.sharedJournals.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No journal entries were included.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.sharedJournals.map((item) => (
                    <details key={item.journalId} className="rounded-xl border border-border p-4">
                      <summary className="cursor-pointer font-semibold text-primary">
                        {item.title || "Untitled reflection"}
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                    </details>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
              <h2 className="flex items-center gap-2 text-2xl [font-family:var(--font-echo-display)]">
                <CalendarDays size={20} />
                Appointments
              </h2>
              {detail.appointments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No appointment has been offered yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {detail.appointments.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-background p-4">
                      <strong className="text-sm">{format(item.startsAt)}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.mode.replace("_", " ")} · {item.locationHint || "Details will be arranged"} ·{" "}
                        {item.status}
                      </p>
                      {item.status === "proposed" ? (
                        <div className="mt-3 flex gap-2">
                          <EchoButton size="small" disabled={Boolean(busy)} onClick={() => void act("accept", item.id)}>
                            Accept
                          </EchoButton>
                          <EchoButton
                            size="small"
                            variant="outline"
                            disabled={Boolean(busy)}
                            onClick={() => void act("decline", item.id)}
                          >
                            Decline
                          </EchoButton>
                        </div>
                      ) : item.status === "confirmed" ? (
                        <EchoButton
                          size="small"
                          variant="outline"
                          className="mt-3"
                          disabled={Boolean(busy)}
                          onClick={() => void act("cancel", item.id)}
                        >
                          Cancel appointment
                        </EchoButton>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {detail.referrals.length > 0 ? (
              <section className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7">
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">Referrals</h2>
                <ul className="mt-3 space-y-2">
                  {detail.referrals.map((item) => (
                    <li key={item.id} className="text-sm">
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
                        item.resourceName
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <aside className="rounded-3xl border border-primary/20 bg-secondary/60 p-5">
            <ShieldCheck className="mb-3 text-primary" />
            <h2 className="text-xl [font-family:var(--font-echo-display)]">Sharing control</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {detail.request.sharingActive
                ? "Only your assigned professional can open your message and selected journal snapshots. You can stop future access at any time."
                : "Future professional access to your message and selected journal snapshots has stopped. Existing professional records follow the organization's retention policy."}
            </p>
            {detail.request.sharingActive ? (
              <EchoButton
                variant="outline"
                size="small"
                className="mt-4"
                isLoading={busy === "revoke"}
                loadingText="Stopping"
                onClick={() => void act("revoke")}
              >
                Stop sharing
              </EchoButton>
            ) : null}
            <Link href="/crisis" className="mt-5 block text-sm font-semibold text-primary underline">
              Need urgent help now?
            </Link>
          </aside>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
          {error}
        </p>
      ) : null}
    </AppShell>
  );
}
