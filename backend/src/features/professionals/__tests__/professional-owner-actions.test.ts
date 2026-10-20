import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, decryptText } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const encryption = createEncryptionService(Buffer.alloc(32, 3).toString("base64"), 1);
const body = { summary: "Fictional request text for owner update tests.", preferredTime: "Synthetic afternoon" };
function harness() {
  const rpc = vi.fn().mockResolvedValue({ data: { id: ids.request, status: "submitted" }, error: null });
  const service = new ProfessionalService({ schema: () => ({ rpc }) } as unknown as SupabaseClient, encryption, {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async () => ({ id: ids.owner, assuranceLevel: "aal1" }) }, verificationService: {} as VerificationService } } });
  return { app, rpc };
}
const path = `/api/v1/professional/my-requests/${ids.request}`;
describe("BE-009 owner request HTTP contracts", () => {
  it("uses the authenticated owner, encrypts updates, and returns metadata only", async () => {
    const h = harness(); const response = await request(h.app).patch(path).set("Authorization", "Bearer synthetic").send(body);
    expect(response.status).toBe(200);
    const args = h.rpc.mock.calls[0][1]; expect(args.p_actor).toBe(ids.owner);
    expect(decryptText(args.p_summary_encrypted, encryption)).toBe(body.summary);
    expect(decryptText(args.p_preferred_time_encrypted, encryption)).toBe(body.preferredTime);
    expect(JSON.stringify(response.body)).not.toContain(body.summary);
  });
  it.each([{ userId: ids.admin }, { organizationId: ids.otherOrg }, { status: "assigned" }, { journalIds: [] }, { summary: "short" }])("rejects overposted or invalid updates %j", async (extra) => {
    const h = harness(); expect((await request(h.app).patch(path).set("Authorization", "Bearer synthetic").send({ ...body, ...extra })).status).toBe(400); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("requires authentication and does not let cancellation impersonate an owner", async () => {
    const h = harness(); expect((await request(h.app).post(`${path}/cancel`)).status).toBe(401);
    expect((await request(h.app).post(`${path}/cancel`).set("Authorization", "Bearer synthetic").send({ userId: ids.admin })).status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
    expect((await request(h.app).post(`${path}/cancel`).set("Authorization", "Bearer synthetic").send({})).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("withdraw_own_request", { p_request_id: ids.request, p_actor: ids.owner });
  });
  it.each([["REQUEST_NOT_FOUND", 404], ["REQUEST_NOT_EDITABLE", 409], ["SHARING_UNAVAILABLE", 409], ["Private database diagnostic", 503]])("maps %s to %s without raw diagnostics", async (message, status) => {
    const h = harness(); h.rpc.mockResolvedValue({ data: null, error: { message } });
    const response = await request(h.app).patch(path).set("Authorization", "Bearer synthetic").send(body);
    expect(response.status).toBe(status); expect(JSON.stringify(response.body)).not.toContain("Private database diagnostic");
  });
});
