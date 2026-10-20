import type { CaseDetail } from "@/services/professionals/professional-api";

export interface CaseActivity { id: string; at: string; label: string; context: string }

/** Discard shared plaintext if the server no longer reports active consent. */
export function consentLimitedCase(detail: CaseDetail): CaseDetail {
  return detail.request.sharingActive === true ? detail : {
    ...detail, request: { ...detail.request, summary: null, preferredTime: "", sharingActive: false }, sharedJournals: [], sharedPhq8: [],
  };
}

const activityLabels: Record<string, string> = {
  "request.created": "Request submitted", "request.updated": "Request updated", "request.withdrawn": "Request withdrawn",
  "request.claimed": "Case assigned", "request.closed": "Case closed", "request.declined": "Case declined",
  "request.transferred": "Case transferred",
  "sharing.revoked": "Sharing revoked", "appointment.proposed": "Appointment proposed", "appointment.confirmed": "Appointment confirmed",
  "appointment.declined": "Appointment declined", "appointment.canceled": "Appointment canceled",
  "appointment.rescheduled": "Appointment rescheduled",
  "note.created": "Case note recorded", "note.finalized": "Case note finalized", "referral.created": "Referral recorded",
};

/** Use recorded actions when supplied; older deployments retain timestamp context. */
export function caseActivity(detail: CaseDetail): CaseActivity[] {
  if (detail.timeline) return detail.timeline.events.filter((event) => Object.hasOwn(activityLabels, event.action) && Number.isFinite(Date.parse(event.at)))
    .map((event) => ({ id: event.id, at: event.at, label: activityLabels[event.action], context: "Recorded case action" }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  const events: CaseActivity[] = [
    { id: "submitted", at: detail.request.createdAt, label: "Request submitted", context: "Submission time" },
    ...detail.notes.map((note) => ({ id: `note-${note.id}`, at: note.createdAt, label: "Case note recorded", context: "Recorded action" })),
    ...detail.referrals.map((referral) => ({ id: `referral-${referral.id}`, at: referral.createdAt, label: "Referral recorded", context: "Recorded action" })),
    ...detail.appointments.map((appointment) => ({ id: `appointment-${appointment.id}`, at: appointment.startsAt, label: "Appointment time", context: `Current status: ${["proposed", "confirmed", "canceled"].includes(appointment.status) ? appointment.status : "unavailable"}. This is the appointment start, not the time its status changed.` })),
  ];
  if (detail.request.updatedAt !== detail.request.createdAt) events.push({ id: "updated", at: detail.request.updatedAt, label: "Case record updated", context: "Latest record update; its cause is not supplied." });
  return events.filter((item) => Number.isFinite(Date.parse(item.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
}

export function noteValidation(body: string) {
  const length = body.trim().length;
  return length < 2 || length > 4000 ? "Enter between 2 and 4,000 characters after trimming spaces." : "";
}
