import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../../app.js";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { ExternalServiceError, NotFoundError } from "../../../shared/errors/app-error.js";
import type { JournalService } from "../../journals/journals.service.js";
import type { VerificationService } from "../../verification/verification.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const encryption = createEncryptionService(Buffer.alloc(32, 9).toString("base64"), 1);

function harness(auditFails = false) {
  const writes = vi.fn();
  const row = { id: ids.request, user_id: ids.owner, organization_id: ids.org, status: "assigned", assigned_to: ids.actor,
    summary_encrypted: encryptText("Synthetic confidential summary", encryption), preferred_time_encrypted: encryptText("Synthetic preference", encryption), sharing_expires_at: "2099-01-01" };
  const from = vi.fn((table: string) => {
    let inserted = false;
    const data = table === "audit_events" ? [{ id: ids.request, request_id: ids.request, action: "request.closed", actor_user_id: ids.actor, body_encrypted: "private ciphertext", secret: "private field", created_at: "2026-10-15" }] : [];
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: row, error: null }),
      insert: (input: unknown) => { writes(input); inserted = true; return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: inserted && auditFails ? { message: "Private database diagnostic" } : null }).then(resolve) };
    return query;
  });
  return { service: new ProfessionalService({ schema: () => ({ from }) } as unknown as SupabaseClient, encryption, {} as JournalService), from, writes };
}
describe("privacy-safe professional access audits", () => {
  it("audits owner detail before returning plaintext and never reads professional notes", async () => {
    const h = harness(); const result = await h.service.detail(ids.owner, ids.request, "user");
    expect(result.request.summary).toBe("Synthetic confidential summary"); expect(result.notes).toEqual([]);
    expect(h.from).not.toHaveBeenCalledWith("case_notes");
    expect(h.writes).toHaveBeenCalledWith({ organization_id: ids.org, request_id: ids.request, actor_user_id: ids.owner, action: "request.owner_viewed" });
    expect(JSON.stringify(h.writes.mock.calls)).not.toMatch(/Synthetic|encrypted|secret/);
  });
  it("fails the owner read when audit storage is unavailable", async () => {
    const h = harness(true); await expect(h.service.detail(ids.owner, ids.request, "user")).rejects.toMatchObject({ statusCode: 503 });
    await expect(h.service.detail(ids.owner, ids.request, "user")).rejects.not.toThrow("Private database diagnostic");
  });
  it("adds record references to the administrator projection and audits that sensitive access", async () => {
    const h = harness(); const result = await h.service.listAuditForAdmin(ids.org, ids.admin);
    expect(result.events[0].requestId).toBe(ids.request); expect(JSON.stringify(result)).not.toMatch(/private|encrypted|secret/);
    expect(h.writes).toHaveBeenCalledWith({ organization_id: ids.org, actor_user_id: ids.admin, action: "admin.audit_viewed" });
  });
  it("does not return administrator audit records if their read audit fails", async () => {
    await expect(harness(true).service.listAuditForAdmin(ids.org, ids.admin)).rejects.toMatchObject({ statusCode: 503 });
  });
  it.each([200, 404, 503])("records HTTP outcome %s through the existing security sink without identifiers or diagnostics", async (status) => {
    const sink = vi.fn().mockResolvedValue(undefined); const detail = vi.fn().mockResolvedValue({});
    if (status === 404) detail.mockRejectedValue(new NotFoundError());
    if (status === 503) detail.mockRejectedValue(new ExternalServiceError("DATABASE_UNAVAILABLE", "Private internal detail"));
    const app = createApp({ securityAuditSink: sink, v1: { professionals: { service: { detail } as unknown as ProfessionalService,
      verifier: { getUser: async () => ({ id: ids.actor, assuranceLevel: "aal2" }) }, verificationService: {} as VerificationService } } });
    const response = await request(app).get(`/api/v1/professional/cases/${ids.request}?private=synthetic-secret`).set("Authorization", "Bearer private-synthetic-token");
    expect(response.status).toBe(status);
    await vi.waitFor(() => expect(sink).toHaveBeenCalledTimes(1));
    expect(sink.mock.calls[0][0]).toMatchObject({ event: "professional.request", outcome: status === 200 ? "allowed" : status === 404 ? "denied" : "failed", statusCode: status });
    expect(JSON.stringify(sink.mock.calls)).not.toMatch(/synthetic-secret|private-synthetic-token|Private internal|fb000000/);
  });
});
