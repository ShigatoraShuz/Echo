import { describe, expect, it } from "vitest";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { caseActivity, noteValidation } from "./professional-case.model";

const detail: CaseDetail = { viewer: "professional", sharedPhq8: [], appointmentChangeRequests: [], request: { id: "synthetic", organizationId: "org", assignedTo: "actor", status: "scheduled", sharingActive: true, summary: "Private summary", preferredTime: "", preferredProfileId: null, sharedPhq8Count: 0, sharedJournalCount: 0, createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z" }, sharedJournals: [], notes: [{ id: "note", body: "Private note", createdAt: "2026-10-03T08:00:00Z" }], referrals: [{ id: "referral", resourceName: "Private resource", resourceUrl: null, createdAt: "2026-10-01T10:00:00+08:00" }], appointments: [{ id: "appointment", startsAt: "2026-10-04T08:00:00Z", endsAt: "2026-10-04T09:00:00Z", mode: "online", locationHint: "Private location", status: "confirmed" }] };
describe("FE-014 activity projection", () => {
  it("uses recorded transitions when present and excludes unknown audit actions and private fields", () => {
    const timeline = { limit: 200, hasMore: false, events: [
      { id: "closed", action: "request.closed", at: "2026-10-04T08:00:00Z", secret: "Private audit content" },
      { id: "access", action: "case.opened", at: "2026-10-03T08:00:00Z" },
      { id: "claimed", action: "request.claimed", at: "2026-10-02T08:00:00Z" },
    ] };
    const events = caseActivity({ ...detail, timeline });
    expect(events.map((event) => event.label)).toEqual(["Case assigned", "Case closed"]);
    expect(JSON.stringify(events)).not.toMatch(/Private|case.opened|appointment/);
  });
  it("orders timestamps by instant including offsets without changing source arrays", () => {
    const original = structuredClone(detail); const events = caseActivity(detail);
    expect(events.map((item) => item.id)).toEqual(["referral-referral", "submitted", "updated", "note-note", "appointment-appointment"]);
    expect(detail).toEqual(original);
  });
  it("never includes content or invents transition times", () => {
    const serialized = JSON.stringify(caseActivity({ ...detail, audit: [{ secret: "internal audit" }] } as CaseDetail));
    expect(serialized).not.toMatch(/Private|internal audit/);
    expect(serialized).toContain("not the time its status changed");
    expect(serialized).not.toContain("Case closed");
  });
  it("omits invalid dates and repeated creation/update timestamps", () => {
    expect(caseActivity({ ...detail, request: { ...detail.request, createdAt: "invalid", updatedAt: "invalid" }, notes: [], referrals: [], appointments: [] })).toEqual([]);
    expect(caseActivity({ ...detail, request: { ...detail.request, updatedAt: detail.request.createdAt }, notes: [], referrals: [], appointments: [] })).toHaveLength(1);
  });
});
describe("FE-017 note contract", () => {
  it.each(["", "  ", " x ", "x".repeat(4001)])("rejects invalid trimmed note length", (body) => expect(noteValidation(body)).not.toBe(""));
  it.each([" ab ", "x".repeat(4000)])("accepts the API length boundaries", (body) => expect(noteValidation(body)).toBe(""));
});
