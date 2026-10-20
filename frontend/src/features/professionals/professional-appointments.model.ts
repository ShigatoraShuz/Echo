import type { Appointment } from "@/services/professionals/professional-api";

export const sessionModes = { in_person: "In person", online: "Online", phone: "Phone" } as const;
export interface AppointmentDraft { start: string; end: string; mode: string; locationHint: string }
export interface AppointmentProposal { startsAt: string; endsAt: string; mode: keyof typeof sessionModes; locationHint: string }

/** datetime-local is interpreted in the browser's zone; reject normalized/nonexistent local times. */
export function localAppointmentTime(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!parts) return null;
  const date = new Date(value);
  const actual = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
  return actual.every((part, index) => part === Number(parts[index + 1])) ? date : null;
}

export function validateAppointment(draft: AppointmentDraft, appointments: Appointment[], now = Date.now()): string {
  const start = localAppointmentTime(draft.start); const end = localAppointmentTime(draft.end);
  if (!start || !end) return "Choose valid start and end times in your local time zone.";
  if (start.getTime() <= now) return "Choose a start time in the future.";
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return "Choose an end time after the start time.";
  if (duration > 2 * 60 * 60 * 1000) return "An appointment may last no longer than two hours.";
  if (!Object.hasOwn(sessionModes, draft.mode)) return "Choose an available session type.";
  if (draft.locationHint.trim().length > 240) return "Meeting details must be 240 characters or fewer.";
  const active = appointments.filter((item) => item.status === "proposed" || item.status === "confirmed");
  if (active.some((item) => start.getTime() < Date.parse(item.endsAt) && end.getTime() > Date.parse(item.startsAt))) return "This time overlaps an active appointment in this case.";
  return active.length ? "Cancel the current proposed or confirmed appointment before proposing another." : "";
}

export function appointmentProposal(draft: AppointmentDraft): AppointmentProposal {
  return { startsAt: localAppointmentTime(draft.start)!.toISOString(), endsAt: localAppointmentTime(draft.end)!.toISOString(), mode: draft.mode as AppointmentProposal["mode"], locationHint: draft.locationHint.trim() };
}

export function appointmentTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" }).format(date) : "Time unavailable";
}
export function appointmentZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Browser local time"; }

export type AgendaPeriod = "upcoming" | "past" | "canceled";
export function agendaGroups(appointments: Appointment[], period: AgendaPeriod, now: number) {
  const selected = appointments.filter((item) => {
    const start = Date.parse(item.startsAt); const end = Date.parse(item.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    if (period === "canceled") return item.status === "canceled";
    return item.status !== "canceled" && (period === "past" ? end <= now : end > now);
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  const groups = new Map<string, Appointment[]>();
  for (const item of selected) {
    const day = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(new Date(item.startsAt));
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return Array.from(groups, ([day, items]) => ({ day, items }));
}
