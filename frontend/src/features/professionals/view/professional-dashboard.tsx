"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ClipboardList, ShieldCheck, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { normalizeError } from "@/shared/errors/normalize-error";
import { professionalApi, type Membership, type PractitionerProfile, type QueueRequest } from "@/services/professionals/professional-api";
import { ProfessionalShell, ProfessionalSkeleton, RequestStatus } from "../components/professional-shell";

const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function ProfessionalDashboard() {
  const searchParams = useSearchParams();
  const requestedOrganization = searchParams.get("organization");
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [userId, setUserId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [requests, setRequests] = useState<QueueRequest[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [practitioners, setPractitioners] = useState<PractitionerProfile[]>([]);
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const queueRequest = useRef(0);

  useEffect(() => {
    let active = true;
    professionalApi
      .memberships()
      .then(({ memberships: items, userId: actor }) => {
        if (!active) return;
        setMemberships(items);
        setUserId(actor);
        const selected = items.find((item) => item.accessState === "active" && item.organizationId === requestedOrganization);
        const first = selected ?? items.find((item) => item.accessState === "active");
        if (first) setOrganizationId(first.organizationId);
      })
      .catch((reason) => {
        if (active) {
          setError(normalizeError(reason).userMessage);
          setMemberships([]);
        }
      });
    return () => {
      active = false;
    };
  }, [requestedOrganization]);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    const current = ++queueRequest.current;
    setError("");
    setRequests(null);
    try {
      const result = await professionalApi.queue(organizationId);
      if (current === queueRequest.current) setRequests(result.requests);
    } catch (reason) {
      if (current === queueRequest.current) {
        setError(normalizeError(reason).userMessage);
        setRequests([]);
      }
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
    return () => {
      queueRequest.current += 1;
    };
  }, [refresh]);
  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    void professionalApi.directory({ organizationId, limit: 30 }).then((result) => {
      if (active) setPractitioners(result.practitioners);
    }).catch(() => { if (active) setPractitioners([]); });
    return () => { active = false; };
  }, [organizationId]);
  const activeMembership = memberships?.find((item) => item.organizationId === organizationId);
  const canClaim =
    activeMembership?.role === "counselor" ||
    activeMembership?.role === "psychologist" ||
    activeMembership?.role === "social_worker";
  const canAssign = activeMembership?.role === "coordinator" || activeMembership?.role === "org_admin";
  const visible = useMemo(
    () => (requests ?? []).filter((item) => filter === "all" || item.status === filter),
    [requests, filter],
  );
  const openCount = requests?.filter((item) => item.status === "submitted").length ?? 0;
  const mineCount = requests?.filter((item) => item.assignedTo === userId && item.status !== "closed").length ?? 0;
  const scheduledCount =
    requests?.filter((item) => item.status === "scheduled" && item.assignedTo === userId).length ?? 0;

  async function claim(id: string) {
    setBusyId(id);
    setError("");
    try {
      await professionalApi.claim(id);
      await refresh();
    } catch (reason) {
      setError(normalizeError(reason).userMessage);
    } finally {
      setBusyId("");
    }
  }
  async function assign(id: string) {
    const profileId = assignee[id];
    if (!profileId) return;
    setBusyId(id); setError("");
    try { await professionalApi.assign(id, profileId); await refresh(); }
    catch (reason) { setError(normalizeError(reason).userMessage); }
    finally { setBusyId(""); }
  }

  return (
    <ProfessionalShell
      memberships={memberships ?? undefined}
      organizationId={organizationId}
      onOrganizationChange={(id) => {
        queueRequest.current += 1;
        setRequests(null);
        setOrganizationId(id);
      }}
    >
      <PageHeader
        title="Today, at a glance"
        description="Requests, appointments, and follow-ups for your active organization. Only assigned professionals can open private case details."
      />
      {memberships === null ? (
        <ProfessionalSkeleton title="Loading your organizations" />
      ) : memberships.length === 0 || !organizationId ? (
        <section className="rounded-3xl border border-border bg-card p-6 shadow-subtle sm:p-9">
          <ShieldCheck className="mb-4 text-primary" size={27} aria-hidden="true" />
          <h2 className="text-2xl [font-family:var(--font-echo-display)]">Professional access is not active</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            An ECHO administrator must approve your organization and professional role after checking your credentials.
            An ordinary verified account does not grant case access.
          </p>
          <Link href="/professional-support" className="mt-5 inline-flex text-sm font-semibold text-primary underline">
            Looking for support as an ECHO user?
          </Link>
        </section>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "New requests", value: openCount, icon: ClipboardList },
              { label: "My active cases", value: mineCount, icon: UserRoundCheck },
              { label: "Scheduled", value: scheduledCount, icon: CalendarDays },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-3xl border border-border/70 bg-card p-5 shadow-subtle">
                <Icon className="mb-4 text-primary" size={20} aria-hidden="true" />
                {requests === null ? (
                  <EchoSkeleton className="h-9 w-12" />
                ) : (
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <section
            id="requests"
            className="scroll-mt-32 rounded-3xl border border-border/70 bg-card p-4 shadow-subtle sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl [font-family:var(--font-echo-display)]">Request queue</h2>
                <p className="text-sm text-muted-foreground">
                  Showing only {activeMembership?.organization?.name ?? "your organization"}.
                </p>
              </div>
              <label className="text-xs font-semibold text-muted-foreground">
                Status
                <select
                  className="ml-2 min-h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="submitted">New</option>
                  <option value="assigned">Accepted</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>
            {requests === null ? (
              <ProfessionalSkeleton title="Loading request queue" />
            ) : visible.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
                No requests match this view.
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-border/70">
                {visible.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-foreground">Request {item.id.slice(0, 8).toUpperCase()}</strong>
                        <RequestStatus status={item.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Submitted {date(item.createdAt)}</p>
                    </div>
                    {item.assignedTo === userId ? (
                      <Link
                        href={`/professional/cases/${item.id}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/25 px-4 text-sm font-semibold text-primary hover:bg-secondary"
                      >
                        Open case <ArrowRight size={15} />
                      </Link>
                    ) : item.status === "submitted" && canClaim ? (
                      <EchoButton
                        size="small"
                        isLoading={busyId === item.id}
                        loadingText="Accepting"
                        onClick={() => void claim(item.id)}
                      >
                        Accept request
                      </EchoButton>
                    ) : item.status === "submitted" && canAssign ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label><span className="sr-only">Choose practitioner for request {item.id.slice(0, 8)}</span><select className="min-h-10 rounded-xl border border-border bg-background px-3 text-xs" value={assignee[item.id] ?? ""} onChange={(event) => setAssignee((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">Choose practitioner</option>{practitioners.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label>
                        <EchoButton size="small" disabled={!assignee[item.id]} isLoading={busyId === item.id} onClick={() => void assign(item.id)}>Assign</EchoButton>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Assigned elsewhere</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section id="calendar" className="mt-6 scroll-mt-32 rounded-3xl border border-border/70 bg-card p-5 sm:p-6">
            <h2 className="text-2xl [font-family:var(--font-echo-display)]">Scheduled cases</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open a case to see its confirmed appointment details.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {requests === null ? (
                <EchoSkeleton variant="rectangular" className="h-10 w-48" />
              ) : (
                requests
                  .filter((item) => item.status === "scheduled" && item.assignedTo === userId)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={`/professional/cases/${item.id}`}
                      className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-primary"
                    >
                      Case {item.id.slice(0, 8)} →
                    </Link>
                  ))
              )}
              {requests !== null && scheduledCount === 0 ? (
                <span className="text-sm text-muted-foreground">No confirmed appointments yet.</span>
              ) : null}
            </div>
          </section>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-foreground">
          {error}{" "}
          <Link href="/settings/security" className="font-semibold text-primary underline">
            Review account security
          </Link>
        </p>
      ) : null}
    </ProfessionalShell>
  );
}
