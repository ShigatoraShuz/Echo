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
function harness() {
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({ data: { id: ids.owner, body_encrypted: args.p_body_encrypted, state: args.p_state ?? (args.p_finalize ? "final" : "draft"), revision: 1 }, error: null as { message: string } | null }));
  const from = (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "support_requests" ? { id: ids.request, organization_id: ids.org, assigned_to: ids.actor, status: "assigned" } : table === "memberships" ? { status: "active", role: "counselor", credential_expires_at: "2099-12-31" } : { status: "active" }, error: null }) }; return query;
  };
  const service = new ProfessionalService({ schema: () => ({ from, rpc }) } as unknown as SupabaseClient, encryption, {} as JournalService);
  const app = createApp({ v1: { professionals: { service, verifier: { getUser: async (token) => ({ id: ids.actor, assuranceLevel: token === "mfa" ? "aal2" : "aal1" }) }, verificationService: {} as VerificationService } } });
  return { app, rpc };
}
const path = `/api/v1/professional/cases/${ids.request}/notes`;
describe("note HTTP and replay contracts", () => {
  it("accepts legacy final-note input and encrypts it with a server-generated submission UUID", async () => {
    const h = harness(); const response = await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ body: " Synthetic note " });
    expect(response.status).toBe(201); expect(response.body.data.state).toBe("final");
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_actor: ids.actor, p_state: "final", p_submission_id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain("Synthetic note"); expect(JSON.stringify(response.body)).not.toContain("encrypted");
  });
  it("passes explicit draft state and submission identifier while deriving the author from authentication", async () => {
    const h = harness(); expect((await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ body: "Synthetic draft", state: "draft", submissionId: ids.owner })).status).toBe(201);
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_actor: ids.actor, p_state: "draft", p_submission_id: ids.owner });
  });
  it.each([{ authorUserId: ids.owner }, { state: "approved" }, { submissionId: "wrong" }, { body: "x" }])("rejects forged/invalid fields %j", async (extra) => {
    const h = harness(); expect((await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ body: "Synthetic note", ...extra })).status).toBe(400); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("rejects reused identifiers with different content without returning the old note", async () => {
    const h = harness(); h.rpc.mockResolvedValue({ data: { id: ids.owner, body_encrypted: encryptText("Private prior note", encryption), state: "final", revision: 1 }, error: null });
    const response = await request(h.app).post(path).set("Authorization", "Bearer mfa").send({ body: "Different note", submissionId: ids.owner });
    expect(response.status).toBe(409); expect(response.body.error.code).toBe("NOTE_SUBMISSION_CONFLICT"); expect(JSON.stringify(response.body)).not.toMatch(/Private|encrypted/);
  });
  it("requires MFA for editing and passes optimistic revision rather than trusting client author fields", async () => {
    const h = harness(); const input = { body: "Updated synthetic draft", expectedRevision: 1, finalize: true };
    expect((await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer password").send(input)).status).toBe(403); expect(h.rpc).not.toHaveBeenCalled();
    expect((await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer mfa").send(input)).status).toBe(200);
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_request_id: ids.request, p_note_id: ids.owner, p_actor: ids.actor, p_expected_revision: 1, p_finalize: true });
  });
  it.each([["NOTE_IMMUTABLE", 409], ["NOTE_REVISION_CONFLICT", 409], ["MEMBERSHIP_REQUIRED", 403], ["REQUEST_NOT_FOUND", 404], ["Private SQL diagnostic", 503]])("maps %s to safe %s", async (message, status) => {
    const h = harness(); h.rpc.mockImplementation(async () => ({ data: { id: "", body_encrypted: "", state: "", revision: 0 }, error: { message: String(message) } }));
    const response = await request(h.app).patch(`${path}/${ids.owner}`).set("Authorization", "Bearer mfa").send({ body: "Synthetic draft", expectedRevision: 1, finalize: false });
    expect(response.status).toBe(status); expect(JSON.stringify(response.body)).not.toContain("Private SQL diagnostic");
  });
});
