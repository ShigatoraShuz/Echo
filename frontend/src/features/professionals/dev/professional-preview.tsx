"use client";
import { ProfessionalCasePreview } from "./professional-case-preview";
import { ProfessionalCarePreview } from "./professional-care-preview";
import { ProfessionalCrisisPreview } from "./professional-crisis-preview";

import { useState } from "react";
import { ArrowRight, CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, ListChecks, LogOut, ShieldCheck } from "lucide-react";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import { EchoButton } from "@/shared/components/ui/echo-button";
import type { Membership } from "@/services/professionals/professional-api";
import { ProfessionalShell } from "../components/professional-shell";
import { ProfessionalAppointment, ProfessionalHeading, ProfessionalMetrics, ProfessionalNotice, ProfessionalPanel, ProfessionalQueueLoading, ProfessionalRequestRow, ProfessionalRequestStatus as RequestStatus } from "../components/professional-ui";
import { ProfessionalOnboardingPreview } from "./professional-onboarding-preview";
import { ProfessionalOrganizationChooser } from "../components/professional-organization-selector";
import { ProfessionalAccessPreview } from "./professional-access-preview";
import { isMyActiveCase, professionalDashboardOverview } from "../professional-dashboard.model";
import { ProfessionalRequestPreview } from "./professional-request-preview";

const path = "/dev/professional-preview";
const navigationItems = [
  { label: "Today", href: path, icon: LayoutDashboard },
  { label: "Requests", href: `${path}#requests`, icon: ClipboardList },
  { label: "Calendar", href: `${path}#calendar`, icon: CalendarDays },
  { label: "Resources", href: `${path}#resources`, icon: HeartHandshake },
  { label: "Onboarding", href: `${path}#onboarding`, icon: ShieldCheck },
  { label: "Access states", href: `${path}#access-states`, icon: ShieldCheck },
  { label: "Request management", href: `${path}#request-management`, icon: ClipboardList },
];
const memberships: Membership[] = [
  "Preview Care Center",
  "Preview Community Organization With a Long Name for Layout QA",
].map((name, index) => ({
  id: `preview-membership-${index}`,
  organizationId: `preview-org-${index}`,
  organization: { id: `preview-org-${index}`, slug: `preview-${index}`, name, description: "Synthetic organization", location: "", serviceTypes: [], consultationMethods: [], serviceHours: "Demo hours", status: "active" },
  role: "counselor", status: "active", displayName: "Preview Professional",
  credentialLabel: "Synthetic credential", credentialExpiresAt: null, accessState: "active",
}));
const requests = [
  { id: "DEMO0001", status: "submitted" as const, assignedTo: null, createdAt: "2026-10-12T09:00:00Z" },
  { id: "DEMO0002", status: "assigned" as const, assignedTo: "preview-professional", createdAt: "2026-10-11T14:30:00Z" },
  { id: "DEMO0003", status: "scheduled" as const, assignedTo: "preview-professional", createdAt: "2026-10-10T10:00:00Z" },
];
const sampleCase = {
  id: "DEMO0003", summary: "This fictional request is for visual layout review only. It contains no personal or patient information.",
  preferredTime: "Weekday afternoons (synthetic)",
  appointment: { startsAt: "14 Oct 2026, 14:00", mode: "Online", location: "Preview meeting room", status: "confirmed" },
};

/** Temporary presentation-only fixtures: never mount the live dashboard or case view here. */
export function ProfessionalPreview() {
  const [organizationId, setOrganizationId] = useState(memberships[0].organizationId);
  const [filter, setFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const organization = memberships.find((item) => item.organizationId === organizationId)?.organization;
  const organizationRequests = requests.map((item) => ({ ...item, organizationId, updatedAt: item.createdAt, id: organizationId === memberships[0].organizationId ? item.id : item.id.replace("DEMO", "ALT0") }));
  const activeCase = organizationId === memberships[0].organizationId ? sampleCase : { ...sampleCase, id: "ALT00003", summary: "This fictional request belongs to the alternate preview organization. No real case data is loaded.", appointment: { ...sampleCase.appointment, startsAt: "15 Oct 2026, 10:00" } };
  const overview = professionalDashboardOverview(organizationRequests, organizationId, "preview-professional");
  const visible = overview.requests.filter((item) => (filter === "all" || item.status === filter) && (!mineOnly || isMyActiveCase(item, "preview-professional")));
  function changeOrganization(id: string) {
    if (!memberships.some((item) => item.organizationId === id && item.accessState === "active")) return;
    setOrganizationId(id);
    setFilter("all");
    setMineOnly(false);
  }

  return (
    <ProfessionalShell
      memberships={memberships}
      organizationId={organizationId}
      onOrganizationChange={changeOrganization}
      navigationItems={navigationItems}
      accountActions={<>
        <span className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-primary" aria-disabled="true">My ECHO</span>
        <button type="button" disabled className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary disabled:opacity-50">
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      </>}
    >
      <div className="mb-6"><ProfessionalNotice title="Local development preview">
        Synthetic data only. Account and mutation controls are inactive. Organization changes and filtering affect only this preview.
      </ProfessionalNotice></div>
      <ProfessionalHeading label="Workspace overview" title="Today, at a glance" description="Requests, appointments, and follow-ups for a fictional organization. This preview grants no professional access." />
      <ProfessionalMetrics newRequests={overview.pendingCount} activeCases={overview.activeCount} scheduled={overview.scheduledCases.length} />
      <details className="mb-6 rounded-2xl border border-border bg-card p-5">
        <summary className="echo-focus-ring cursor-pointer rounded-lg text-sm font-semibold text-primary">Inspect synthetic organization choices</summary>
        <p className="my-4 text-xs leading-6 text-muted-foreground">Fictional memberships only. Selection updates the local preview; unavailable membership remains disabled.</p>
        <ProfessionalOrganizationChooser memberships={[...memberships, { ...memberships[0], id: "preview-pending", organizationId: "preview-pending-org", status: "pending", accessState: "pending_membership", organization: { ...memberships[0].organization!, id: "preview-pending-org", name: "Preview Organization Awaiting Approval" } }]} organizationId={organizationId} onChange={changeOrganization} />
      </details>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <ProfessionalPanel id="requests" title="Request queue" icon={ClipboardList} description={`Showing synthetic requests for ${organization?.name}.`}
        action={<div className="flex flex-wrap items-center gap-3"><EchoButton type="button" size="small" variant="outline" className="min-h-11" aria-pressed={mineOnly} onClick={() => { setMineOnly((value) => !value); setFilter("all"); }}>My active cases</EchoButton><label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Status
            <select className="echo-focus-ring min-h-11 max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option><option value="submitted">New</option><option value="assigned">Accepted</option><option value="scheduled">Scheduled</option><option value="closed">Closed</option><option value="declined">Declined</option>
            </select>
          </label></div>}
      >
        {visible.length ? <ul className="divide-y divide-border/70">
          {visible.map((item) => (
            <ProfessionalRequestRow key={item.id} id={item.id} status={item.status} submittedAt={`${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))} · Synthetic`}
              action={item.status === "submitted" ? <EchoButton size="small" className="min-h-11" disabled>Accept request</EchoButton> : <a href="#sample-case" className="echo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary motion-reduce:transition-none">Inspect sample case <ArrowRight size={15} aria-hidden="true" /></a>}
            />
          ))}
        </ul> : <EchoEmptyState icon={<ClipboardList size={22} />} title="No requests match this view." description="Try another status to inspect the synthetic request queue." className="py-8" />}
      </ProfessionalPanel>
      <div className="min-w-0 space-y-6">
        <ProfessionalPanel id="calendar" title="Upcoming appointments" icon={CalendarDays} description="Synthetic schedule only. The real dashboard links scheduled cases to their appointment details.">
          <ProfessionalAppointment startsAt={activeCase.appointment.startsAt} status={activeCase.appointment.status} mode={activeCase.appointment.mode} location="Synthetic meeting room" action={<a href="#sample-case" className="echo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary">Inspect sample case {activeCase.id}<ArrowRight size={16} aria-hidden="true" /></a>} />
        </ProfessionalPanel>
        <ProfessionalPanel title="Professional follow-ups" icon={ListChecks} description="Synthetic tasks for visual QA. No task API or real records are connected.">
          <ul className="divide-y divide-border/70 text-sm">
            {[{ caseId: organizationRequests[1].id, label: "Review agreed next steps", due: "Due tomorrow · Synthetic" }, { caseId: activeCase.id, label: "Prepare appointment follow-up", due: "Before the sample appointment · Synthetic" }].map((task) => <li key={task.caseId} className="py-3 first:pt-0 last:pb-0"><p className="font-semibold text-foreground">{task.label}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">Case {task.caseId} · {task.due}</p><EchoButton type="button" size="small" variant="outline" className="mt-2 min-h-11" disabled>Complete synthetic task</EchoButton></li>)}
          </ul>
        </ProfessionalPanel>
      </div>
      </div>
      <section id="sample-case" className="mt-10 scroll-mt-32">
        <ProfessionalHeading level="h2" label="Case workspace" title={`Case ${activeCase.id}`} description="Representative synthetic case content. Live case screens and mutations are not mounted." action={<RequestStatus status="scheduled" />} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <ProfessionalPanel title="What the user shared" icon={ShieldCheck} description="The request and sharing choices agreed by the user.">
            <p className="break-words whitespace-pre-wrap text-sm leading-7">{activeCase.summary}</p>
            <p className="mt-5 break-words rounded-xl border border-border/70 bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">Preferred time: {activeCase.preferredTime}</p>
          </ProfessionalPanel>
          <ProfessionalPanel title="Appointments" icon={CalendarDays} description="Appointment offers and confirmed arrangements for this case.">
            <ProfessionalAppointment startsAt={activeCase.appointment.startsAt} status={activeCase.appointment.status} mode={activeCase.appointment.mode} location={activeCase.appointment.location}
              action={<EchoButton size="small" variant="outline" className="min-h-11" disabled>Cancel appointment</EchoButton>}
            />
          </ProfessionalPanel>
        </div>
      </section>
      <ProfessionalPanel id="resources" title="Resources" icon={HeartHandshake} className="mt-6">
        <p className="text-sm leading-6 text-muted-foreground">Preview navigation destination only. No live resource or referral actions are available.</p>
      </ProfessionalPanel>
      <ProfessionalOnboardingPreview />
      <ProfessionalRequestPreview key={organizationId} organizationId={organizationId} organizationName={organization?.name ?? "Synthetic organization"} />
      <ProfessionalAccessPreview />
      <ProfessionalCasePreview key={`case-${organizationId}`} organizationId={organizationId} />
      <ProfessionalCarePreview key={`care-${organizationId}`} organizationId={organizationId} />
      <ProfessionalCrisisPreview key={`crisis-${organizationId}`} />
      <ProfessionalPanel title="Interface states" description="Synthetic examples for local visual QA only." className="mt-6">
        <div className="space-y-3">
          <details className="rounded-2xl border border-border bg-background p-4">
            <summary className="echo-focus-ring cursor-pointer rounded-lg text-sm font-semibold text-primary">Inspect queue loading</summary>
            <div className="mt-5"><ProfessionalQueueLoading /></div>
          </details>
          <details className="rounded-2xl border border-border bg-background p-4">
            <summary className="echo-focus-ring cursor-pointer rounded-lg text-sm font-semibold text-primary">Inspect error state</summary>
            <div className="mt-5"><ProfessionalNotice tone="danger" title="Workspace could not update">Synthetic error example. No request has been made and no real account is affected.</ProfessionalNotice></div>
          </details>
        </div>
      </ProfessionalPanel>
    </ProfessionalShell>
  );
}
