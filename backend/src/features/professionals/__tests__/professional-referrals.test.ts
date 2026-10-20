import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const path = `/api/v1/professional/cases/${ids.request}/referrals`;
function harness() {
  const rpc = vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: { id: ids.owner, status: "completed", revision: 2, private_diagnostic: "not for response" }, error: null }));
  const service = new ProfessionalService({ schema: () => ({ rpc }) } as unknown as SupabaseClient, createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1), {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: ids.actor, assuranceLevel: token === "mfa" ? "aal2" : "aal1" }) }, verificationService: {} as VerificationService } } });
  return { rpc, app, service };
}
describe("referral HTTP lifecycle", () => {
  it("passes current authenticated actor and revision with no delivery claim", async () => {
    const h = harness(); const response = await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer mfa").send({ status: "completed", expectedRevision: 1 });
    expect(response.status).toBe(200); expect(response.body.data).toEqual({ referralId: ids.owner, status: "completed", revision: 2, delivery: "not_integrated" });
    expect(h.rpc).toHaveBeenCalledWith("set_referral_status", expect.objectContaining({ p_actor: ids.actor, p_request_id: ids.request, p_expected_revision: 1 }));
  });
  it.each([{ status: "delivered" }, { actor: ids.second }, { expectedRevision: 0 }])("rejects forged status or identity %j", async (extra) => {
    const h = harness(); expect((await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer mfa").send({ status: "completed", expectedRevision: 1, ...extra })).status).toBe(400); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("requires MFA for list and mutation", async () => {
    const h = harness(); expect((await request(h.app).get(path).set("Authorization", "Bearer password")).status).toBe(403);
    expect((await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer password").send({ status: "completed", expectedRevision: 1 })).status).toBe(403); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each([["INVALID_REFERRAL", 400], ["REFERRAL_CONFLICT", 409], ["MEMBERSHIP_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404], ["Private SQL diagnostic", 503]])("maps %s safely to %s", async (message, status) => {
    const h = harness(); h.rpc.mockResolvedValue({ data: null, error: { message: String(message) } });
    const response = await request(h.app).get(path).set("Authorization", "Bearer mfa"); expect(response.status).toBe(status); expect(JSON.stringify(response.body)).not.toContain("Private SQL diagnostic");
  });
});
