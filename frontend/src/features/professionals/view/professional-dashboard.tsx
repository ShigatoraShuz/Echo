"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoSkeleton } from "@/shared/components/ui/echo-skeleton";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalMetrics, ProfessionalNotice, ProfessionalPanel } from "../components/professional-ui";
import { ProfessionalAssignmentPanel } from "../components/professional-assignment-panel";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { useProfessionalWorkspace } from "../hooks/use-professional-workspace";
import { ProfessionalRequestQueue, type ProfessionalQueueHandle } from "../components/professional-request-queue";
import { professionalCaseHref } from "../professional-request.model";
import { appointmentTime, sessionModes } from "../professional-appointments.model";

export function ProfessionalDashboard() {
  const params = useSearchParams();
  return <DashboardWorkspace key={params.toString()} />;
}

function DashboardWorkspace() {
  const { memberships, organizationId, userId, requests, activeMembership, overview, dashboardSummary, summaryUnavailable, error, success, busyId, canClaim, selectionNotice, destination, switchOrganization, refreshWorkspace, retry, claim, canAssign, assign } = useProfessionalWorkspace();
  const queueView = useRef<ProfessionalQueueHandle>(null);
  const scheduledCount = dashboardSummary?.counts.scheduledCount ?? overview.scheduledCases.length;
  const scheduledCases = dashboardSummary?.scheduledCases ?? overview.scheduledCases;

  return (
    <ProfessionalShell
      memberships={memberships ?? undefined}
      organizationId={organizationId}
      organizationDisabled={!!busyId}
      onOrganizationChange={switchOrganization}
    >
      <ProfessionalHeading
        label="Workspace overview"
        title="Today, at a glance"
        description="Requests, assigned cases and scheduling in your organization."
        action={<EchoButton type="button" variant="outline" disabled={!organizationId || !!busyId || !!error || requests === null} onClick={refreshWorkspace}>Refresh overview</EchoButton>}
      />
      {selectionNotice ? <div className="mb-6"><ProfessionalNotice title="Organization selection updated">{selectionNotice}</ProfessionalNotice></div> : null}
      {error ? <ProfessionalAccessError failure={error} destination={destination} retryLabel="Retry workspace" onRetry={retry} /> : memberships === null ? (
        <ProfessionalSkeleton title="Loading your organizations" variant="content" />
      ) : memberships.length === 0 || !organizationId ? (
        <ProfessionalPanel title="Professional access is not active" icon={ShieldCheck} description="Your account and professional access are checked separately.">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            An ECHO administrator must approve your organization and professional role after checking your credentials.
            An ordinary verified account does not grant case access.
          </p>
          <Link href="/professional/request" className="echo-focus-ring mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
            Looking for support as an ECHO user?
          </Link>
        </ProfessionalPanel>
      ) : (
        <>

          <ProfessionalMetrics newRequests={dashboardSummary?.counts.pendingCount ?? overview.pendingCount} activeCases={dashboardSummary?.counts.activeCount ?? overview.activeCount} scheduled={scheduledCount} loading={requests === null} />
          <details className="mb-5 rounded-2xl border border-border/70 px-4 py-2 text-xs leading-6 text-muted-foreground"><summary className="echo-focus-ring min-h-11 cursor-pointer content-center rounded-lg font-semibold text-primary">About these counts</summary><p className="pb-2 break-words">{dashboardSummary ? `Counts cover all pending requests and your authorized active cases in ${activeMembership?.organization?.name ?? "your organization"}. The request list below is a bounded page.` : <>Counts cover the loaded requests for {activeMembership?.organization?.name ?? "your organization"}.{requests !== null && requests.length >= 100 ? " This overview includes the latest 100 requests; older cases may be outside this view." : ""}</>}{summaryUnavailable ? " Organization-wide totals are temporarily unavailable; only loaded-request counts are shown." : ""}</p></details>
          {success ? <p role="status" className="mb-4 text-sm font-semibold text-primary">{success}</p> : null}
          {canAssign && requests ? <ProfessionalAssignmentPanel key={organizationId} organizationId={organizationId} requests={requests} busy={!!busyId} onAssign={assign} /> : null}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ProfessionalRequestQueue key={organizationId} ref={queueView} requests={requests} organizationId={organizationId} organizationName={activeMembership?.organization?.name ?? "your organization"} userId={userId} canClaim={canClaim} canOpenCases={canClaim} busyId={busyId} compact onClaim={(item) => claim(item.id)} />
          <ProfessionalPanel id="calendar" title="Scheduled cases" icon={CalendarDays} description="Assigned to you. Open a case to check appointment time and current status.">
            <div className="space-y-3">
              {requests === null ? (
                <EchoSkeleton variant="rectangular" className="h-10 w-48" />
              ) : (
                scheduledCases
                  .slice(0, 3)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={professionalCaseHref(item.id, organizationId)}
                      className="echo-focus-ring flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary/60 motion-reduce:transition-none"
                    >
                      <span className="min-w-0"><span className="block">Case {item.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">View appointment details</span></span>
                      <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
                    </Link>
                  ))
              )}
              {requests !== null && scheduledCount === 0 ? (
                <EchoEmptyState icon={<CalendarDays size={22} />} title="No scheduled cases in this overview." description="Cases marked scheduled and assigned to you will appear here. Check your active cases for appointment offers." className="py-6" />
              ) : null}
              {requests !== null && scheduledCount > 3 ? dashboardSummary ? <Link href={`/professional/my-cases?organization=${encodeURIComponent(organizationId)}`} className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">Open My cases</Link> : <button type="button" className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline" onClick={() => { queueView.current?.viewScheduled(); }}>View all {scheduledCount} scheduled cases in the queue</button> : null}
              <div className="border-t border-border/70 pt-4 text-xs leading-6 text-muted-foreground">
                {dashboardSummary ? <><h3 className="text-sm font-semibold text-foreground">Upcoming appointments</h3>{!dashboardSummary.clinicalAccess ? <p className="mt-2">Clinical appointment details are unavailable for your role.</p> : dashboardSummary.appointments.length ? <ul className="mt-3 space-y-3">{dashboardSummary.appointments.map((item) => <li key={item.id}><Link href={professionalCaseHref(item.requestId, organizationId)} className="echo-focus-ring flex min-h-11 flex-col justify-center rounded-lg text-primary underline"><span>{appointmentTime(item.startsAt)}</span><span className="text-xs capitalize">{sessionModes[item.mode as keyof typeof sessionModes] ?? "Session"} · {item.status}</span></Link></li>)}</ul> : <p className="mt-2">No upcoming or in-progress appointments.</p>}{dashboardSummary.clinicalAccess ? <p className="mt-2">Showing {dashboardSummary.appointments.length} of {dashboardSummary.appointmentTotal} upcoming or in-progress appointments. Open a case for current details.</p> : null}</> : <p>Upcoming appointment times are available inside your assigned cases. A combined schedule is not available here yet.</p>}
                <h3 className="mt-4 text-sm font-semibold text-foreground">Professional follow-ups</h3>
                <p className="mt-1">A task list is not available here yet. Review your active cases for follow-up actions.</p>
              </div>
            </div>
          </ProfessionalPanel>
          </div>
        </>
      )}
    </ProfessionalShell>
  );
}
