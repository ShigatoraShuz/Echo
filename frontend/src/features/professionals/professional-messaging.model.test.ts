import { describe, expect, it } from "vitest";
import type { CaseDetail, CaseMessage } from "@/services/professionals/professional-api";
import { mergeCaseMessages, messageEligibility, validateCaseMessages, validateSentCaseMessage } from "./professional-messaging.model";
const detail = { viewer: "professional", messagingAvailable: true, request: { id: "case", organizationId: "org", assignedTo: "actor", status: "assigned", sharingActive: true }, notes: [{ body: "Never retain this" }] } as unknown as CaseDetail;
describe("Professional messaging isolation", () => {
  it("retains only eligibility flags from the clinical payload", () => expect(messageEligibility(detail, "case", "org", "actor")).toEqual({ available: true, writable: true }));
  it.each([{ viewer: "user" }, { request: { ...detail.request, id: "other" } }, { request: { ...detail.request, organizationId: "other" } }, { request: { ...detail.request, assignedTo: "other" } }])("rejects an inconsistent participant or organization: %j", change => expect(() => messageEligibility({ ...detail, ...change } as CaseDetail, "case", "org", "actor")).toThrow());
  it.each([{ status: "closed" }, { sharingActive: false }, { status: "declined" }])("keeps history read-only when sending is unauthorized: %j", change => expect(messageEligibility({ ...detail, request: { ...detail.request, ...change } } as CaseDetail, "case", "org", "actor").writable).toBe(false));
  it("does not infer missing messaging capability", () => expect(messageEligibility({ ...detail, messagingAvailable: undefined }, "case", "org", "actor")).toEqual({ available: false, writable: false }));
  it("rejects transcript data from another case", () => expect(() => validateCaseMessages([{ requestId: "other", sender: "user" } as CaseMessage], "case")).toThrow());
  it("rejects an unverified send acknowledgement", () => expect(() => validateSentCaseMessage({ requestId: "case", sender: "user", body: "reply" } as CaseMessage, "case", "reply")).toThrow());
  it("deduplicates overlapping pages while preserving order", () => { const a = { id: "a" }, b = { id: "b" }, c = { id: "c" }; expect(mergeCaseMessages([a, b] as CaseMessage[], [b, c] as CaseMessage[])).toEqual([a, b, c]); });
});
