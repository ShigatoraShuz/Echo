import type { Page } from "@playwright/test";

export const caseId = "fe000000-0000-4000-8000-000000000001";
export const secondCaseId = "fe000000-0000-4000-8000-000000000002";
const organization = (id: string) => ({ id, slug: id, name: `Fictional ${id} organization with a deliberately long professional workspace name`, description: "Synthetic", serviceHours: "Synthetic hours", status: "active" });
export const memberships = ["org-one", "org-two"].map((id) => ({ id: `membership-${id}`, organizationId: id, organization: organization(id), role: "counselor", status: "active", displayName: "Fictional practitioner", credentialLabel: "Synthetic credential", credentialExpiresAt: "2099-12-31", accessState: "active" }));
export const detail = {
  messagingAvailable: false, sharedPhq8: [] as { id: string; label: string; score: number; severity: string; completedAt: string; context: string }[], appointmentChangeRequests: [],
  viewer: "professional", request: { id: caseId, organizationId: "org-one", status: "assigned", assignedTo: "actor-one", createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z", preferredTime: "Synthetic afternoon preference", summary: "Fictional shared message for browser tests", sharingActive: true, sharedJournalCount: 1 },
  sharedJournals: [{ journalId: "fictional-journal", title: "Fictional journal title", body: "Fictional shared snapshot" }],
  notes: [] as { id: string; body: string; createdAt: string }[], appointments: [] as { id: string; startsAt: string; endsAt: string; mode: string; locationHint: string; status: string }[], referrals: [] as { id: string; resourceName: string; resourceUrl: string | null; createdAt: string }[],
};
export async function fixtures(page: Page) {
  const state = { memberships: structuredClone(memberships), mfaRequired: false, detail: structuredClone(detail), claimed: false, emptyQueue: false, holds: {} as Record<string, Promise<void>>, faults: {} as Record<string, { status: number; code: string }>, calls: [] as { method: string; args: unknown[] }[] };
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") return route.abort();
    if (!route.request().url().endsWith("/__fixtures/rpc")) return route.continue();
    const { method, args } = route.request().postDataJSON(); state.calls.push({ method, args });
    await (state.holds[`${method}:${args[0]}`] ?? state.holds[method]);
    const fault = state.faults[method]; if (fault) return route.fulfill({ status: fault.status, json: { code: fault.code } });
    let result: unknown;
    switch (method) {
      case "memberships": result = { userId: "actor-one", mfaRequired: state.mfaRequired, memberships: state.memberships }; break;
      case "queue": result = { requests: [{ id: caseId, organizationId: args[0], status: state.detail.request.status, assignedTo: "actor-one", createdAt: detail.request.createdAt, updatedAt: detail.request.updatedAt }, { id: secondCaseId, organizationId: args[0], status: state.claimed ? "assigned" : "submitted", assignedTo: state.claimed ? "actor-one" : null, createdAt: detail.request.createdAt, updatedAt: detail.request.updatedAt }] }; break;
      case "dashboard": result = { organizationId: args[0], userId: "actor-one", asOf: new Date().toISOString(), counts: { pendingCount: 0, activeCount: 1, scheduledCount: 0 }, appointments: state.detail.appointments.map((item) => ({ id: item.id, startsAt: item.startsAt, endsAt: item.endsAt, mode: item.mode, status: item.status, requestId: caseId })), appointmentTotal: state.detail.appointments.length, appointmentLimit: 5, scheduledCases: [], scheduledLimit: 3, clinicalAccess: true, followUpsAvailable: false }; break;
      case "directory": result = { practitioners: [{ id: "fictional-profile", organizationId: (args[0] as { organizationId?: string })?.organizationId ?? "org-one", displayName: "Fictional clinician", role: "counselor", acceptingRequests: true }], nextCursor: null }; break;
      case "assign": state.claimed = true; result = { request: state.detail.request }; break;
      case "caseMessages": result = { messages: [{ id: "fictional-message", requestId: args[0], sender: "user", body: "Fictional private conversation", createdAt: "2026-10-14T08:00:00Z" }], nextCursor: null }; break;
      case "markCaseMessagesRead": result = { read: true }; break;
      case "sendCaseMessage": result = { message: { id: "fictional-reply", requestId: args[0], sender: "professional", body: (args[1] as { body: string }).body, createdAt: "2026-10-14T08:00:00Z" } }; break;
      case "caseDetail": result = state.detail; break;
      case "claim": state.claimed = true; result = { request: { ...state.detail.request, id: args[0] } }; break;
      case "addNote": state.detail.notes.push({ id: "fixture-note", body: args[1], createdAt: "2026-10-14T08:00:00Z" }); result = { noteId: "fixture-note" }; break;
      case "close": state.detail.request.status = "closed"; result = { request: state.detail.request }; break;
      case "proposeAppointment": state.detail.appointments.push({ id: "fixture-appointment", ...args[1], status: "proposed" }); result = { appointmentId: "fixture-appointment" }; break;
      case "cancelAppointment": state.detail.appointments[0].status = "canceled"; result = { appointmentId: args[0], status: "canceled" }; break;
      case "addReferral": state.detail.referrals.push({ id: "fixture-referral", resourceName: args[1], resourceUrl: args[2], createdAt: "2026-10-14T08:00:00Z" }); result = { referralId: "fixture-referral" }; break;
      case "resources": result = []; break;
      case "prepareMfa": result = { id: "fictional-factor" }; break;
      case "verifyMfa": result = {}; break;
      case "login": result = { success: false, error: { code: "AUTHENTICATION_ERROR", message: "Synthetic sign-in rejection" } }; break;
      default: return route.fulfill({ status: 501, json: { code: "UNSUPPORTED_FIXTURE" } });
    }
    return route.fulfill({ json: method === "queue" && state.emptyQueue ? { requests: [] } : result });
  });
  return state;
}
