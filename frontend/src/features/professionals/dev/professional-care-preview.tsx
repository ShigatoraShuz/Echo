"use client";

import { useState } from "react";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { ProfessionalAppointmentAgenda } from "../components/professional-appointment-agenda";
import { ProfessionalAppointmentForm } from "../components/professional-appointment-form";
import { ProfessionalAppointmentCancelDialog } from "../components/professional-appointment-cancel-dialog";
import { ProfessionalFollowUps } from "../components/professional-follow-ups";
import { ProfessionalCaseReferrals } from "../components/professional-case-referrals";
import { ProfessionalNotifications } from "../components/professional-notifications";

const fictionalNow = Date.parse("2026-10-13T04:00:00Z");
const upcoming = { id: "fictional-upcoming", startsAt: "2026-10-14T06:00:00Z", endsAt: "2026-10-14T07:00:00Z", mode: "online", locationHint: "Fictional meeting instructions", status: "proposed" };

function CareScenario({ organizationId }: { organizationId: string }) {
  const [state, setState] = useState<"ready" | "loading" | "empty" | "error">("ready");
  const [cancel, setCancel] = useState(false);
  return <div className="mt-5 space-y-6">
    <p className="text-sm leading-7 text-muted-foreground">Fictional care-coordination examples only. The agenda uses a fixed reference time of 13 October 2026, 04:00 UTC. No live APIs, read-state changes, task completion or external referrals are connected.</p>
    <label className="block text-xs font-semibold">Synthetic care state<select className="echo-input mt-2 min-h-11" value={state} onChange={(event) => { setState(event.target.value as typeof state); setCancel(false); }}><option value="ready">Loaded</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option></select></label>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-6">
        <ProfessionalAppointmentAgenda key={`agenda-${state}`} caseId="fictional-agenda-case" organizationId={organizationId} viewer="professional" preview canCancel now={fictionalNow} state={state === "empty" ? "ready" : state} appointments={state === "empty" ? [] : [upcoming, { ...upcoming, id: "fictional-past", startsAt: "2026-10-11T06:00:00Z", endsAt: "2026-10-11T07:00:00Z", status: "confirmed" }, { ...upcoming, id: "fictional-canceled", status: "canceled" }]}>
          {state === "ready" ? <><p className="mt-5 text-xs leading-6 text-muted-foreground">The proposal form below represents a separate fictional case with no active appointment.</p><ProfessionalAppointmentForm appointments={[]} preview /><EchoButton variant="outline" className="mt-4" onClick={() => setCancel(true)}>Inspect cancellation confirmation</EchoButton></> : null}
        </ProfessionalAppointmentAgenda>
        <ProfessionalFollowUps key={`tasks-${state}`} state={state} now={fictionalNow} preview={{ organizationId, tasks: [
          { id: "fictional-task-one", organizationId, caseId: "fictional-one", kind: "prepare", status: "pending", dueAt: "2026-10-12T04:00:00Z", practitioner: "Sample Practitioner" },
          { id: "fictional-task-two", organizationId, caseId: "fictional-two", kind: "review", status: "completed", dueAt: "2026-10-11T04:00:00Z", practitioner: "Sample Practitioner" },
        ] }} />
      </div>
      <div className="min-w-0 space-y-6">
        {state === "ready" || state === "empty" ? <ProfessionalCaseReferrals key={`referrals-${state}`} preview referrals={state === "empty" ? [] : [{ id: "fictional-referral", resourceName: "Fictional support resource", resourceUrl: "https://example.invalid/resource", createdAt: "2026-10-12T04:00:00Z" }]} /> : null}
        <ProfessionalNotifications key={`notifications-${state}`} state={state} preview={{ organizationId, notifications: [
          { id: "fictional-update", organizationId, kind: "case_updated", createdAt: "2026-10-13T03:00:00Z", readAt: null },
          { id: "fictional-appointment-update", organizationId, kind: "appointment_changed", createdAt: "2026-10-12T03:00:00Z", readAt: "2026-10-12T04:00:00Z" },
          { id: "fictional-reminder", organizationId, kind: "follow_up", createdAt: "2026-10-11T03:00:00Z", readAt: null },
        ] }} />
      </div>
    </div>
    <ProfessionalAppointmentCancelDialog appointment={cancel ? upcoming : null} onClose={() => setCancel(false)} preview />
  </div>;
}

export function ProfessionalCarePreview({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="echo-focus-ring flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-semibold text-primary">Inspect synthetic care coordination</summary>
    {open ? <CareScenario key={organizationId} organizationId={organizationId} /> : null}
  </details>;
}
