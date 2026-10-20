"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { EchoEmptyState } from "@/shared/components/feedback/echo-empty-state";
import { ProfessionalShell, ProfessionalSkeleton } from "../components/professional-shell";
import { ProfessionalHeading, ProfessionalNotice, ProfessionalPanel } from "../components/professional-ui";
import { ProfessionalAccessError } from "../components/professional-access-error";
import { useProfessionalWorkspace } from "../hooks/use-professional-workspace";
import { agendaGroups, appointmentTime, appointmentZone, sessionModes } from "../professional-appointments.model";
import { professionalCaseHref } from "../professional-request.model";

export function ProfessionalCalendarView() {
  const params = useSearchParams();
  return <CalendarWorkspace key={params.toString()} />;
}

function CalendarWorkspace() {
  const workspace = useProfessionalWorkspace("/professional/calendar", "schedule");
  const { memberships, organizationId, activeMembership, dashboardSummary: schedule, error, selectionNotice } = workspace;
  const organizationCalendar = !!activeMembership && (!workspace.canClaim || schedule?.clinicalAccess === false);
  const loading = memberships === null || !organizationId || (!organizationCalendar && !schedule);
  const appointments = schedule?.appointments ?? [];
  const groups = agendaGroups(appointments.map((item) => ({ ...item, locationHint: "" })), "upcoming", Date.parse(schedule?.asOf ?? ""));
  const caseIds = new Map(appointments.map((item) => [item.id, item.requestId]));
  return <ProfessionalShell memberships={memberships ?? undefined} organizationId={organizationId} onOrganizationChange={workspace.switchOrganization}>
    <ProfessionalHeading title={organizationCalendar ? "Organization Calendar" : "Calendar"} label={organizationCalendar ? "Organization scheduling" : "Your professional schedule"} description={organizationCalendar ? "Scheduling access for your active organization, with confidential clinical calendars kept separate." : "Upcoming and in-progress appointments for your assigned cases in the active organization."} action={<EchoButton variant="outline" onClick={workspace.refreshWorkspace} disabled={loading || !!error}>{organizationCalendar ? "Refresh access" : "Refresh schedule"}</EchoButton>} />
    {selectionNotice ? <div className="mb-6"><ProfessionalNotice title="Organization selection updated">{selectionNotice}</ProfessionalNotice></div> : null}
    {error ? <ProfessionalAccessError failure={error} destination={workspace.destination} onRetry={workspace.retry} retryLabel="Retry schedule" /> : loading ? <ProfessionalSkeleton title="Loading professional schedule" variant="content" /> : organizationCalendar ? <ProfessionalPanel title="Organization scheduling" icon={CalendarDays} description={activeMembership?.organization?.name ?? "Your organization"}>
      <div role="status"><EchoEmptyState icon={<CalendarDays size={22} />} title="Organization-wide scheduling is not available yet" description="Your organization access is active. ECHO does not currently provide an administrative scheduling overview, so no organization appointment totals or availability are shown here." className="py-6" /></div>
      <p className="text-sm leading-7 text-muted-foreground">Clinical appointment times and private case details are available only to appropriately authorized professionals assigned to those cases. An administrator role does not grant clinical access.</p>
      <Link href={`/professional/requests?organization=${encodeURIComponent(organizationId)}`} className="echo-focus-ring mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">View organization requests</Link>
    </ProfessionalPanel> : schedule ? <ProfessionalPanel title="Upcoming appointments" icon={CalendarDays} description={`${activeMembership?.organization?.name ?? "Your organization"}. Times use ${appointmentZone()} with UTC offsets.`}>
        {groups.length ? <div className="space-y-6">{groups.map(({ day, items }) => <section key={day} aria-label={day}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h3>
          <ul className="space-y-3">{items.map((item) => <li key={item.id} className="rounded-2xl border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 text-sm font-semibold"><time dateTime={item.startsAt}>{appointmentTime(item.startsAt)}</time><span className="mt-1 block text-xs font-normal text-muted-foreground">Until <time dateTime={item.endsAt}>{appointmentTime(item.endsAt)}</time></span></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-primary">{item.status}</span></div>
            <p className="mt-3 text-sm">{Object.hasOwn(sessionModes, item.mode) ? sessionModes[item.mode as keyof typeof sessionModes] : "Session"}</p>
            {item.status === "proposed" ? <p className="mt-2 text-xs leading-6 text-muted-foreground">Awaiting the request owner&apos;s response.</p> : null}
            <Link href={professionalCaseHref(caseIds.get(item.id)!, organizationId)} className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">Open case {caseIds.get(item.id)!.slice(0, 8).toUpperCase()}</Link>
          </li>)}</ul>
        </section>)}</div> : schedule.appointmentTotal === 0 ? <EchoEmptyState icon={<CalendarDays size={22} />} title="No upcoming appointments" description="No upcoming or in-progress appointments are recorded for you in this organization." className="py-6" /> : <p role="status" className="text-sm leading-7 text-muted-foreground">No appointments from this response can be placed in the upcoming agenda. Refresh the schedule or open your cases for current details.</p>}
        <p className="mt-5 text-xs leading-6 text-muted-foreground">Showing {groups.reduce((count, group) => count + group.items.length, 0)} of {schedule.appointmentTotal} upcoming or in-progress appointments. This API returns up to {schedule.appointmentLimit}; additional appointments and meeting details are available in your assigned cases.</p>
      <Link href={`/professional/my-cases?organization=${encodeURIComponent(organizationId)}`} className="echo-focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline">Open My cases</Link>
    </ProfessionalPanel> : null}
  </ProfessionalShell>;
}
