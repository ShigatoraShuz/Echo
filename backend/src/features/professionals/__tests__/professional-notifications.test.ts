import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const path = `/api/v1/professional/organizations/${ids.org}/notifications`;
function harness() {
  const rpc = vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: { items: [], total: 0 }, error: null }));
  const service = new ProfessionalService({ schema: () => ({ rpc }) } as unknown as SupabaseClient, createEncryptionService(Buffer.alloc(32, 8).toString("base64"), 1), {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: ids.actor, assuranceLevel: token === "mfa" ? "aal2" : "aal1" }) }, verificationService: {} as VerificationService } } });
  return { rpc, app };
}
describe("professional notification API", () => {
  it("does not expose queue processing over HTTP", async () => {
    const h = harness();
    expect((await request(h.app).post("/api/v1/professional/events/process").set("Authorization", "Bearer mfa").send({})).status).toBe(404);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("passes authenticated actor and organization to unread query", async () => {
    const h = harness(); expect((await request(h.app).get(`${path}?status=unread`).set("Authorization", "Bearer mfa")).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("list_notifications", { p_actor: ids.actor, p_organization_id: ids.org, p_unread_only: true });
  });
  it("requires MFA and rejects forged scope/read timestamp", async () => {
    const h = harness(); expect((await request(h.app).get(path).set("Authorization", "Bearer password")).status).toBe(403);
    expect((await request(h.app).get(`${path}?actor=${ids.second}`).set("Authorization", "Bearer mfa")).status).toBe(400);
    expect((await request(h.app).patch(`${path}/${ids.owner}/read`).set("Authorization", "Bearer mfa").send({ readAt: "2099-01-01" })).status).toBe(400); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each([["MEMBERSHIP_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404], ["Private SQL diagnostic", 503]])("maps %s to %s safely", async (message, status) => {
    const h = harness(); h.rpc.mockResolvedValue({ data: null, error: { message: String(message) } });
    const response = await request(h.app).get(path).set("Authorization", "Bearer mfa"); expect(response.status).toBe(status); expect(JSON.stringify(response.body)).not.toContain("Private SQL diagnostic");
  });
});
