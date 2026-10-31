"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { Appointment } from "@/services/professionals/professional-api";
import { EchoButton } from "@/shared/components/ui/echo-button";
import { agendaGroups, appointmentTime, appointmentZone, sessionModes, type AgendaPeriod } from "../professional-appointments.model";
import { professionalCaseHref } from "../professional-request.model";
import { ProfessionalPanel } from "./professional-ui";

export function ProfessionalAppointmentAgenda({ appointments, caseId, organizationId, viewer, canCancel = false, onCancel, onReschedule, busy = false, preview = false, state = "ready", now = Date.now(), children, period: selectedPeriod, onPeriodChange }: {
  appointments: Appointment[]; caseId: string; organizationId: string; viewer: "professional" | "user";
  canCancel?: boolean; onCancel?: (appointment: Appointment) => void; onReschedule?: (appointment: Appointment) => void; busy?: boolean; preview?: boolean;
  state?: "ready" | "loading" | "error" | "denied"; now?: number; children?: React.ReactNode;
  period?: AgendaPeriod; onPeriodChange?: (period: AgendaPeriod) => void;
}) {
  const [localPeriod, setLocalPeriod] = useState<AgendaPeriod>("upcoming");
  const period = selectedPeriod ?? localPeriod;
  const setPeriod = (value: AgendaPeriod) => { setLocalPeriod(value); onPeriodChange?.(value); };
  const groups = state === "ready" ? agendaGroups(appointments, period, now) : [];
  const invalidTimes = state === "ready" && appointments.some((item) => !Number.isFinite(Date.parse(item.startsAt)) || !Number.isFinite(Date.parse(item.endsAt)) || Date.parse(item.endsAt) <= Date.parse(item.startsAt));
  return <ProfessionalPanel title="Appointments" icon={CalendarDays} description={`${preview ? "Synthetic agenda only." : "This authorized case only; no organization-wide calendar is connected."} Times use ${appointmentZone()} with UTC offsets.`}>
    {state !== "ready" ? <p role={state === "loading" ? "status" : "alert"} className="text-sm leading-7 text-muted-foreground">{state === "loading" ? "Loading case appointments" : state === "denied" ? "Appointments are unavailable with your current access." : "Appointments could not be loaded. Refresh the case to check access and try again."}</p> : <>
      <div role="group" aria-label="Appointment period" className="mb-5 flex flex-wrap gap-2">{(["upcoming", "past", "canceled"] as const).map((value) => <EchoButton key={value} size="small" variant="outline" className="min-h-11" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "upcoming" ? "Upcoming and in progress" : value === "past" ? "Past" : "Canceled"}</EchoButton>)}</div>
      {groups.length ? <div className="space-y-6">{groups.map(({ day, items }) => <section key={day} aria-label={day}><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h3><ul className="space-y-3">{items.map((item) => <li key={item.id} className="rounded-2xl border border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold"><time dateTime={item.startsAt}>{appointmentTime(item.startsAt)}</time><span className="block text-xs font-normal text-muted-foreground">Until <time dateTime={item.endsAt}>{appointmentTime(item.endsAt)}</time></span></p><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-primary">{["proposed", "confirmed", "canceled", "completed"].includes(item.status) ? item.status : "Status unavailable"}</span></div>
        {item.replacesAppointmentId ? <p className="mt-2 text-xs font-semibold text-primary">Replacement proposal - a new response is required</p> : appointments.some(next => next.replacesAppointmentId === item.id) ? <p className="mt-2 text-xs font-semibold text-primary">Rescheduled - replaced by another appointment</p> : null}
        <p className="mt-3 break-words text-sm">{Object.hasOwn(sessionModes, item.mode) ? sessionModes[item.mode as keyof typeof sessionModes] : "Session type unavailable"}</p>
        <p className="mt-1 break-words whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{item.locationHint || "Meeting details to be arranged"}</p>
        {item.status === "proposed" ? <p className="mt-2 text-xs leading-6 text-muted-foreground">Awaiting the request owner&apos;s response. Practitioners cannot accept on their behalf.</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3">
          {preview ? <span className="text-xs text-muted-foreground">Fictional case {caseId}</span> : viewer === "professional" ? <Link href={professionalCaseHref(caseId, organizationId)} className="echo-focus-ring inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-primary underline">Case {caseId.slice(0, 8).toUpperCase()}</Link> : null}
          {viewer === "professional" && canCancel && onReschedule && ["proposed", "confirmed"].includes(item.status) ? <EchoButton size="small" variant="outline" className="min-h-11" disabled={preview || busy} onClick={() => onReschedule(item)}>Reschedule appointment</EchoButton> : null}
          {viewer === "professional" && canCancel && ["proposed", "confirmed"].includes(item.status) ? <EchoButton size="small" variant="outline" className="min-h-11" disabled={preview || busy || !onCancel} onClick={() => onCancel?.(item)}>Cancel appointment</EchoButton> : null}
        </div>
      </li>)}</ul></section>)}</div> : <p role="status" className="py-4 text-sm text-muted-foreground">{period === "upcoming" ? "No upcoming or in-progress appointments in this case." : period === "past" ? "No past appointments in this case." : "No canceled appointments in this case."}</p>}
      {invalidTimes ? <p className="mt-4 text-xs text-muted-foreground">Some appointment times are unavailable and cannot be placed in the agenda. Refresh the case before taking action.</p> : null}
      {children}
    </>}
  </ProfessionalPanel>;
}
