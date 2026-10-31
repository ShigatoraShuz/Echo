import type { CaseDetail, CaseMessage, QueueRequest } from "@/services/professionals/professional-api";
import type { SyntheticFollowUp } from "../components/professional-follow-ups";

export const demoNow = Date.parse("2026-10-13T04:00:00Z");
export const demoOrganization = { id: "demo-fictional-center", name: "Fictional Echo Learning Center" };
export const clinicianPersonas = [
  { id: "counselor", label: "Counselor", name: "Demo Counselor", prefix: "DEMO1" },
  { id: "psychologist", label: "Psychologist", name: "Demo Psychologist", prefix: "DEMO2" },
  { id: "social_worker", label: "Social Worker", name: "Demo Social Worker", prefix: "DEMO3" },
] as const;
export type ClinicianPersona = typeof clinicianPersonas[number]["id"];

/** Deterministic local presentation fixtures. These IDs cannot be mistaken for backend UUIDs. */
export function clinicianDemo(persona: ClinicianPersona) {
  const identity = clinicianPersonas.find(item => item.id === persona) ?? clinicianPersonas[0];
  const actorId = "demo-" + identity.id;
  const cases: CaseDetail[] = (["assigned", "scheduled", "closed"] as const).map((status, index) => {
    const id = identity.prefix + "00" + (index + 1);
    return {
      viewer: "professional", messagingAvailable: true, notesLifecycleAvailable: false,
      request: { id, organizationId: demoOrganization.id, assignedTo: actorId, status, preferredProfileId: null, createdAt: "2026-10-09T04:00:00Z", updatedAt: "2026-10-12T06:00:00Z", preferredTime: "Fictional weekday afternoon preference", summary: "Fictional request: explore a manageable weekly routine in this demonstration. No person is represented.", sharingActive: status !== "closed", sharedJournalCount: 1, sharedPhq8Count: 0 },
      sharedJournals: [{ journalId: id + "-journal", title: "Fictional reflection — a calmer week", body: "Fictional reflection for the Echo clinician demonstration. This is authored demo text, not a person’s journal." }],
      sharedPhq8: [], appointmentChangeRequests: [],
      appointments: status === "scheduled" ? [{ id: id + "-appointment", startsAt: "2026-10-14T06:00:00Z", endsAt: "2026-10-14T07:00:00Z", mode: "online", locationHint: "Fictional meeting instructions · no meeting link", status: "confirmed" }] : [],
      notes: [{ id: id + "-note", body: "Fictional clinician note: review the demo next steps. This note is read-only and cannot be saved or edited.", createdAt: "2026-10-11T04:00:00Z", state: "final", revision: 1 }],
      referrals: [{ id: id + "-referral", resourceName: "Fictional community support directory — demo only", resourceUrl: null, createdAt: "2026-10-12T04:00:00Z" }],
      timeline: { hasMore: false, limit: 3, events: [{ id: id + "-event-one", action: "request.created", at: "2026-10-09T04:00:00Z" }, { id: id + "-event-two", action: "request.claimed", at: "2026-10-10T04:00:00Z" }] },
    };
  });
  const queue: QueueRequest[] = cases.map(({ request }) => ({ id: request.id, organizationId: request.organizationId, assignedTo: request.assignedTo, status: request.status, createdAt: request.createdAt, updatedAt: request.updatedAt }));
  queue.push({ id: identity.prefix + "004", organizationId: demoOrganization.id, assignedTo: null, status: "submitted", createdAt: "2026-10-12T04:00:00Z", updatedAt: "2026-10-12T04:00:00Z" });
  const messages: Record<string, CaseMessage[]> = Object.fromEntries(cases.map(({ request }) => [request.id, [
    { id: request.id + "-message-one", requestId: request.id, sender: "user" as const, body: "Fictional message: I would like to discuss a simple weekly routine.", createdAt: "2026-10-12T04:00:00Z" },
    { id: request.id + "-message-two", requestId: request.id, sender: "professional" as const, body: "Fictional reply: we can review the demo next steps together. No message has been sent.", createdAt: "2026-10-12T04:05:00Z" },
  ]]));
  const tasks: SyntheticFollowUp[] = [
    { id: "demo-follow-up-one", organizationId: demoOrganization.id, caseId: cases[0].request.id, kind: "review", status: "pending", dueAt: "2026-10-14T04:00:00Z", practitioner: identity.name },
    { id: "demo-follow-up-two", organizationId: demoOrganization.id, caseId: cases[1].request.id, kind: "prepare", status: "completed", dueAt: "2026-10-12T04:00:00Z", practitioner: identity.name },
  ];
  return { identity, actorId, cases, queue, messages, tasks };
}
