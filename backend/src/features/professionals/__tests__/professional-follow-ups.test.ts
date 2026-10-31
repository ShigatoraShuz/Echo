import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const encryption = createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1);
const input = { title: "Synthetic follow-up", dueAt: "2099-01-01T12:00:00Z", submissionId: ids.owner };
const path = `/api/v1/professional/cases/${ids.request}/follow-ups`;
function harness() {
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: {
    id: ids.owner, request_id: ids.request, organization_id: ids.org, title_encrypted: args.p_title_encrypted ?? encryptText(input.title, encryption), due_at: args.p_due_at ?? input.dueAt,
    responsible_user_id: ids.actor, status: args.p_complete ? "completed" : "pending", revision: 1, submission_id: ids.owner,
  }, error: null }));
  const service = new ProfessionalService({ schema: () => ({ rpc }) } as unknown as SupabaseClient, encryption, {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: ids.actor, assuranceLevel: token === "mfa" ? "aal2" : "aal1" }) }, verificationService: {} as VerificationService } } });
  return { rpc, app };
}
describe("follow-up HTTP contracts", () => {
  it("encrypts titles, derives actor and projects only authorized response fields", async () => {
    const h = harness(); const response = await request(h.app).post(path).set("Authorization", "Bearer mfa").send(input);
    expect(response.status).toBe(201); expect(response.body.data.followUp.title).toBe(input.title);
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_actor: ids.actor, p_request_id: ids.request, p_submission_id: ids.owner });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain(input.title); expect(JSON.stringify(response.body)).not.toMatch(/encrypted|submission_id/);
  });
  it.each([{ responsibleUserId: ids.second }, { organizationId: ids.otherOrg }, { title: "x" }, { dueAt: "infinity" }, { status: "completed" }])("rejects forged or invalid fields %j", async (extra) => {
    const h = harness(); expect((await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ ...input, ...extra })).status).toBe(400); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(["get", "post", "patch", "complete"])("requires MFA for %s", async (method) => {
    const h = harness(); const agent = request(h.app); const call = method === "get" ? agent.get(path) : method === "patch" ? agent.patch(`${path}/${ids.owner}`) : agent.post(method === "complete" ? `${path}/${ids.owner}/complete` : path);
    expect((await call.set("Authorization", "Bearer password").send(input)).status).toBe(403); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("passes completion revision without trusting client completion metadata", async () => {
    const h = harness(); expect((await request(h.app).post(`${path}/${ids.owner}/complete`).set("Authorization", "Bearer mfa").send({ expectedRevision: 3 })).status).toBe(200);
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_complete: true, p_expected_revision: 3, p_title_encrypted: null, p_due_at: null });
  });
  it("does not disclose prior content on changed idempotency intent", async () => {
    const h = harness(); h.rpc.mockResolvedValue({ data: { title_encrypted: encryptText("Prior private title", encryption), due_at: input.dueAt }, error: null });
    const response = await request(h.app).post(path).set("Authorization", "Bearer mfa").send(input); expect(response.status).toBe(409); expect(JSON.stringify(response.body)).not.toContain("Prior private");
  });
  it.each([["INVALID_FOLLOW_UP", 400], ["FOLLOW_UP_CONFLICT", 409], ["MEMBERSHIP_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404], ["Private SQL diagnostic", 503]])("maps %s to %s safely", async (message, status) => {
    const h = harness(); h.rpc.mockResolvedValue({ data: null, error: { message: String(message) } });
    const response = await request(h.app).get(path).set("Authorization", "Bearer mfa"); expect(response.status).toBe(status); expect(JSON.stringify(response.body)).not.toContain("Private SQL diagnostic");
  });
});
